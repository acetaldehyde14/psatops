package com.psap.palletisation.algorithm;

import com.psap.palletisation.algorithm.util.RotationUtils;
import com.psap.palletisation.algorithm.util.ScoringUtils;
import com.psap.palletisation.algorithm.util.StabilityUtils;
import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.ItemRequest;
import com.psap.palletisation.dto.request.PalletiseRequest;
import com.psap.palletisation.dto.response.*;
import com.psap.palletisation.enums.AlgorithmType;
import com.psap.palletisation.enums.FractionalQuantityMode;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Main optimiser entry point.
 * Handles box expansion, sorting, business rules, and dispatches to algorithms.
 * Faithful port of optimiser.py.
 */
@Service
public class OptimiserService {

    private final FirstFitAlgorithm firstFit;
    private final BestFitAlgorithm bestFit;
    private final ExtremePointAlgorithm extremePoint;
    private final GeneticAlgorithm genetic;

    public OptimiserService(FirstFitAlgorithm firstFit, BestFitAlgorithm bestFit,
                             ExtremePointAlgorithm extremePoint, GeneticAlgorithm genetic) {
        this.firstFit = firstFit;
        this.bestFit = bestFit;
        this.extremePoint = extremePoint;
        this.genetic = genetic;
    }

    public PalletiseResponse runOptimisation(PalletiseRequest req, String jobId) {
        ExpandResult expandResult = expandItems(req);
        List<Box> boxes = expandResult.boxes();
        List<Object> warnings = new ArrayList<>(expandResult.warnings());

        boxes = applyBusinessRules(boxes, req);

        Constraints constraints = req.getConstraints();
        AlgorithmType algo = req.getAlgorithm();
        List<Pallet> pallets;
        String algoUsed;

        if (algo == AlgorithmType.AUTO) {
            List<Box> epBoxes = deepCopyBoxes(boxes);
            List<Box> gaBoxes = deepCopyBoxes(boxes);
            List<Pallet> ep = extremePoint.run(epBoxes, req.getPallet(), constraints);
            List<Pallet> ga = genetic.run(gaBoxes, req.getPallet(), constraints);
            double epScore = ScoringUtils.scoreSolution(ep, constraints);
            double gaScore = ScoringUtils.scoreSolution(ga, constraints);
            if (epScore <= gaScore) {
                pallets = ep;
                algoUsed = "AUTO(EXTREME_POINT)";
            } else {
                pallets = ga;
                algoUsed = "AUTO(GENETIC)";
            }
        } else if (algo == AlgorithmType.FIRST_FIT) {
            pallets = firstFit.run(boxes, req.getPallet(), constraints);
            algoUsed = "FIRST_FIT";
        } else if (algo == AlgorithmType.BEST_FIT) {
            pallets = bestFit.run(boxes, req.getPallet(), constraints);
            algoUsed = "BEST_FIT";
        } else if (algo == AlgorithmType.GENETIC) {
            pallets = genetic.run(boxes, req.getPallet(), constraints);
            algoUsed = "GENETIC";
        } else {
            // EXTREME_POINT (default)
            pallets = extremePoint.run(boxes, req.getPallet(), constraints);
            algoUsed = "EXTREME_POINT";
        }

        // Find unplaced boxes
        Set<String> placedIds = pallets.stream()
                .flatMap(p -> p.getBoxes().stream())
                .map(Box::getBoxId)
                .collect(Collectors.toSet());

        List<UnplacedBox> unplaced = boxes.stream()
                .filter(b -> !placedIds.contains(b.getBoxId()))
                .map(b -> {
                    UnplacedBox ub = new UnplacedBox();
                    ub.setBoxId(b.getBoxId());
                    ub.setSku(b.getSku());
                    ub.setReason(constraints.isDoNotAllowStabilityIssues()
                            ? "No stable placement found under current constraints"
                            : "No placement found under current constraints");
                    return ub;
                })
                .toList();

        Map<String, Object> constraintsUsed = new LinkedHashMap<>();
        constraintsUsed.put("do_not_allow_stability_issues", constraints.isDoNotAllowStabilityIssues());
        constraintsUsed.put("prefer_larger_base", constraints.isPreferLargerBase());
        constraintsUsed.put("enforce_no_load_on_top", constraints.isEnforceNoLoadOnTop());

        Map<String, CenterTotal> centerTotals = buildCenterTotals(req, boxes);

        PalletiseResponse result = palletsToResponse(
                jobId, req.getOrderId(), algoUsed, pallets, warnings,
                constraintsUsed, unplaced, centerTotals);

        // Build request sku totals
        Map<String, Integer> requestSkuTotals = new TreeMap<>();
        for (ItemRequest item : req.getItems()) {
            if (item.getQuantity() > 0) {
                int count;
                try {
                    count = cartonCount(item.getQuantity(), req.getConstraints().getFractionalQuantityMode(), item.getSku()).count();
                } catch (IllegalArgumentException e) {
                    count = 0;
                }
                requestSkuTotals.merge(item.getSku(), count, Integer::sum);
            }
        }
        result.getSummary().setRequestTotalBoxes(requestSkuTotals.values().stream().mapToInt(Integer::intValue).sum());
        result.getSummary().setRequestSkuTotals(requestSkuTotals);

        return result;
    }

    // ── Item Expansion ────────────────────────────────────────────────────────

    record ExpandResult(List<Box> boxes, List<Object> warnings) {}

    private ExpandResult expandItems(PalletiseRequest req) {
        List<Box> boxes = new ArrayList<>();
        List<Object> warnings = new ArrayList<>();

        int lineIndex = 1;
        for (ItemRequest item : req.getItems()) {
            String lineId = item.getLineId() != null ? item.getLineId() : ("line_" + lineIndex);
            String storeNo = item.resolvedStoreNo();
            String dcNo = item.resolvedDcNo();
            String description = item.resolvedDescription();

            // Warn on small dimensions
            double[] dims = {item.getLengthMm(), item.getWidthMm(), item.getHeightMm()};
            String[] dimNames = {"length_mm", "width_mm", "height_mm"};
            for (int i = 0; i < 3; i++) {
                if (dims[i] < 5) {
                    WarningItem wi = new WarningItem();
                    wi.setId("small_dimension:" + item.getSku() + ":" + dimNames[i] + ":" + formatG(dims[i]));
                    wi.setType("small_dimension");
                    wi.setSku(item.getSku());
                    wi.setMessage(String.format("SKU %s has very small dimension %s=%.6gmm. Confirm units are correct.",
                            item.getSku(), dimNames[i], dims[i]));
                    wi.setDismissible(true);
                    warnings.add(wi);
                }
            }

            double quantity = item.getQuantity();
            CartonCountResult ccr;
            try {
                ccr = cartonCount(quantity, req.getConstraints().getFractionalQuantityMode(), item.getSku());
            } catch (IllegalArgumentException e) {
                warnings.add(e.getMessage());
                lineIndex++;
                continue;
            }
            if (ccr.warning() != null) {
                warnings.add(ccr.warning());
            }

            for (int cartonIndex = 1; cartonIndex <= ccr.count(); cartonIndex++) {
                Box b = new Box();
                b.setBoxId(item.getSku() + "-" + lineIndex + "-" + cartonIndex);
                b.setSku(item.getSku());
                b.setLength(item.getLengthMm());
                b.setWidth(item.getWidthMm());
                b.setHeight(item.getHeightMm());
                b.setWeight(item.getWeightKg());
                b.setOriginalLength(item.getLengthMm());
                b.setOriginalWidth(item.getWidthMm());
                b.setOriginalHeight(item.getHeightMm());
                b.setNiItemCode(item.getNiItemCode());
                b.setDescriptionOfGoods(item.getDescriptionOfGoods() != null ? item.getDescriptionOfGoods() : description);
                b.setLotNo(item.getLotNo());
                b.setLineId(lineId);
                b.setSourceRow(item.getSourceRow());
                b.setStoreNo(storeNo);
                b.setDcNo(dcNo);
                b.setCenterLabel(item.getCenterLabel());
                b.setCenterExpectedCartons(item.getCenterExpectedCartons());
                b.setOriginalQuantity(quantity);
                b.setPartialCarton(ccr.hasPartial() && cartonIndex == ccr.count());
                b.setCartonIndex(cartonIndex);
                b.setExpiryDate(item.getExpiryDate());
                b.setLocation(item.getLocation());
                b.setRequestedDeliveryDate(item.getRequestedDeliveryDate());
                b.setStandUprightOnly(item.isStandUprightOnly());
                b.setNoLoadOnTop(item.resolvedNoLoadOnTop());
                boxes.add(b);
            }
            lineIndex++;
        }
        return new ExpandResult(boxes, warnings);
    }

    private String formatG(double v) {
        if (v == Math.floor(v) && !Double.isInfinite(v)) {
            return String.valueOf((long) v);
        }
        return String.valueOf(v);
    }

    record CartonCountResult(int count, boolean hasPartial, String warning) {}

    private CartonCountResult cartonCount(double quantity, FractionalQuantityMode mode, String sku) {
        if (quantity <= 0) return new CartonCountResult(0, false, null);
        if (!isFractional(quantity)) return new CartonCountResult((int) Math.round(quantity), false, null);

        int count;
        String warning;
        if (mode == FractionalQuantityMode.EXACT_ERROR) {
            throw new IllegalArgumentException(
                    String.format("Fractional carton quantity %s for SKU %s is not allowed.", formatG(quantity), sku));
        } else if (mode == FractionalQuantityMode.FLOOR) {
            count = (int) Math.floor(quantity);
            warning = String.format("Fractional carton quantity %s for SKU %s rounded down to %d cartons.",
                    formatG(quantity), sku, count);
        } else if (mode == FractionalQuantityMode.IGNORE_FRACTIONAL_ZERO && quantity < 1) {
            count = 0;
            warning = String.format("Fractional carton quantity %s for SKU %s ignored because it is less than 1 carton.",
                    formatG(quantity), sku);
        } else {
            count = (int) Math.ceil(quantity);
            warning = String.format("Fractional carton quantity %s for SKU %s rounded up to %d cartons.",
                    formatG(quantity), sku, count);
        }
        return new CartonCountResult(count, true, warning);
    }

    private boolean isFractional(double value) {
        return Math.abs(value - Math.round(value)) > 1e-9;
    }

    // ── Business Rules ────────────────────────────────────────────────────────

    private List<Box> applyBusinessRules(List<Box> boxes, PalletiseRequest req) {
        Constraints c = req.getConstraints();
        List<Box> result = new ArrayList<>(boxes);

        if (c.isRespectFefo()) {
            result.sort(Comparator.comparing(b -> b.getExpiryDate() != null ? b.getExpiryDate() : "9999-12-31"));
        }

        if (c.isRespectDeliveryDate()) {
            result.sort(Comparator.comparing(
                    (Box b) -> b.getRequestedDeliveryDate() != null ? b.getRequestedDeliveryDate() : "9999-12-31")
                    .thenComparing(b -> b.getExpiryDate() != null ? b.getExpiryDate() : "9999-12-31"));
        }

        if (c.isPreferLocationCluster()) {
            result.sort(Comparator.comparing(b -> locationKey(b.getLocation())));
        }

        return result;
    }

    private String locationKey(String location) {
        if (location == null) return "Z\u0000Z\u0000Z\u0000Z";
        String[] parts = location.split("-");
        String[] padded = new String[]{"Z", "Z", "Z", "Z"};
        for (int i = 0; i < Math.min(parts.length, 4); i++) padded[i] = parts[i];
        return String.join("\u0000", padded);
    }

    // ── Response Builder ──────────────────────────────────────────────────────

    private PalletiseResponse palletsToResponse(
            String jobId, String orderId, String algorithm,
            List<Pallet> pallets, List<Object> warnings,
            Map<String, Object> constraintsUsed,
            List<UnplacedBox> unplacedBoxes,
            Map<String, CenterTotal> centerTotals) {

        List<Pallet> visiblePallets = pallets.stream()
                .filter(p -> !p.getBoxes().isEmpty()).toList();

        double palletVol = visiblePallets.isEmpty() ? 1 :
                visiblePallets.get(0).getVolumeCapacity();
        double palletArea = visiblePallets.isEmpty() ? 1 :
                visiblePallets.get(0).getFootprintArea();

        List<Object> allWarnings = new ArrayList<>(warnings);
        List<StabilityIssue> stabilityIssues = new ArrayList<>();
        int totalFloating = 0, totalUnstable = 0;
        double totalWeight = 0;
        int totalBoxes = 0;
        List<Double> volUtils = new ArrayList<>(), areaUtils = new ArrayList<>();
        Map<String, Integer> responseSkuTotals = new TreeMap<>();
        List<PalletResult> palletResults = new ArrayList<>();

        for (Pallet pallet : visiblePallets) {
            StabilityUtils.StabilityResult stab = StabilityUtils.validatePallet(pallet, pallet.getPalletNo());
            totalFloating += stab.floatingCount();
            totalUnstable += stab.unstableCount();
            allWarnings.addAll(stab.warnings());
            stabilityIssues.addAll(stab.issues());

            double usedVol = pallet.getUsedVolume();
            double volUtil = palletVol > 0 ? usedVol / palletVol * 100 : 0;
            double usedArea = pallet.getBoxes().stream().mapToDouble(b -> b.getLength() * b.getWidth()).sum();
            double areaUtil = Math.min(palletArea > 0 ? usedArea / palletArea * 100 : 0, 100.0);
            volUtils.add(volUtil);
            areaUtils.add(areaUtil);

            double w = pallet.getUsedWeight();
            totalWeight += w;
            totalBoxes += pallet.getBoxes().size();

            List<BoxResult> boxResults = new ArrayList<>();
            Map<String, Integer> palletSkuTotals = new TreeMap<>();

            for (Box b : pallet.getBoxes()) {
                palletSkuTotals.merge(b.getSku(), 1, Integer::sum);
                responseSkuTotals.merge(b.getSku(), 1, Integer::sum);

                BoxResult br = new BoxResult();
                br.setBoxId(b.getBoxId());
                br.setSku(b.getSku());
                br.setNiItemCode(b.getNiItemCode());
                br.setDescriptionOfGoods(b.getDescriptionOfGoods());
                br.setLotNo(b.getLotNo());
                br.setLineId(b.getLineId());
                br.setSourceRow(b.getSourceRow());
                br.setStoreNo(b.getStoreNo());
                br.setDcNo(b.getDcNo());
                br.setCenterLabel(b.getCenterLabel());
                br.setCenterExpectedCartons(b.getCenterExpectedCartons());
                br.setOriginalQuantity(b.getOriginalQuantity());
                br.setPartialCarton(b.isPartialCarton());
                br.setCartonIndex(b.getCartonIndex());
                br.setXMm(round2(b.getX()));
                br.setYMm(round2(b.getY()));
                br.setZMm(round2(b.getZ()));
                br.setLengthMm(round2(b.getLength()));
                br.setWidthMm(round2(b.getWidth()));
                br.setHeightMm(round2(b.getHeight()));
                br.setWeightKg(b.getWeight());
                br.setRotation(b.getRotation());
                br.setBaseAreaMm2(round2(b.getLength() * b.getWidth()));
                br.setIsLargerBaseOrientation(
                        RotationUtils.isLargestBaseOrientation(b, b.getLength(), b.getWidth(), b.getHeight(), true));
                br.setLayer(b.getLayer());
                br.setPickSequence(b.getPickSequence());
                br.setLocation(b.getLocation());
                br.setExpiryDate(b.getExpiryDate());
                br.setStandUprightOnly(b.isStandUprightOnly());
                br.setNoLoadOnTop(b.isNoLoadOnTop());
                br.setOriginalHeightMm(round2(b.getOriginalHeight() != null ? b.getOriginalHeight() : b.getHeight()));
                boxResults.add(br);
            }

            PalletResult pr = new PalletResult();
            pr.setPalletNo(pallet.getPalletNo());
            pr.setVolumeUtilisationPct(round2(volUtil));
            pr.setAreaUtilisationPct(round2(areaUtil));
            pr.setWeightKg(round3(w));
            pr.setBoxCount(pallet.getBoxes().size());
            pr.setSkuTotals(palletSkuTotals);
            pr.setBoxes(boxResults);
            palletResults.add(pr);
        }

        double avgVol = volUtils.isEmpty() ? 0 : volUtils.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double avgArea = areaUtils.isEmpty() ? 0 : areaUtils.stream().mapToDouble(Double::doubleValue).average().orElse(0);

        SummaryResult summary = new SummaryResult();
        summary.setPalletsUsed(visiblePallets.size());
        summary.setTotalBoxes(totalBoxes);
        summary.setAverageVolumeUtilisationPct(round2(avgVol));
        summary.setAverageAreaUtilisationPct(round2(avgArea));
        summary.setTotalWeightKg(round3(totalWeight));
        summary.setFloatingBoxes(totalFloating);
        summary.setUnstableBoxes(totalUnstable);
        summary.setStabilityIssues(stabilityIssues);
        summary.setSkuTotals(responseSkuTotals);
        summary.setCenterTotals(centerTotals);
        summary.setWarnings(allWarnings);

        StabilitySummary stabSummary = new StabilitySummary(!stabilityIssues.isEmpty() ? false : true);
        stabSummary.setIsStable(stabilityIssues.isEmpty());
        stabSummary.setIssues(stabilityIssues);

        PalletiseResponse response = new PalletiseResponse();
        response.setJobId(jobId);
        response.setOrderId(orderId);
        response.setStatus("completed");
        response.setAlgorithmUsed(algorithm);
        response.setSummary(summary);
        response.setPallets(palletResults);
        response.setConstraintsUsed(constraintsUsed);
        response.setStability(stabSummary);
        response.setUnplacedBoxes(unplacedBoxes != null ? unplacedBoxes : new ArrayList<>());

        return response;
    }

    // ── Center Totals ─────────────────────────────────────────────────────────

    private Map<String, CenterTotal> buildCenterTotals(PalletiseRequest req, List<Box> boxes) {
        Map<String, Integer> inputLines = new TreeMap<>();
        Map<String, Double> quantitySum = new TreeMap<>();
        Map<String, Double> expectedMap = new TreeMap<>();
        Map<String, Integer> expanded = new TreeMap<>();

        for (ItemRequest item : req.getItems()) {
            String label = item.getCenterLabel();
            if (label == null) continue;
            inputLines.merge(label, 1, Integer::sum);
            quantitySum.merge(label, item.getQuantity(), Double::sum);
            if (item.getCenterExpectedCartons() != null) {
                expectedMap.put(label, item.getCenterExpectedCartons());
            }
        }
        for (Box box : boxes) {
            if (box.getCenterLabel() != null) {
                expanded.merge(box.getCenterLabel(), 1, Integer::sum);
            }
        }

        Set<String> labels = new TreeSet<>();
        labels.addAll(inputLines.keySet());
        labels.addAll(expanded.keySet());

        Map<String, CenterTotal> result = new LinkedHashMap<>();
        for (String label : labels) {
            CenterTotal ct = new CenterTotal();
            ct.setInputLines(inputLines.getOrDefault(label, 0));
            ct.setExpectedCartons(expectedMap.getOrDefault(label, null));
            ct.setExpandedCartons(expanded.getOrDefault(label, 0));
            double qSum = quantitySum.getOrDefault(label, 0.0);
            ct.setQuantitySumRaw(Math.round(qSum * 1e6) / 1e6);
            result.put(label, ct);
        }
        return result;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<Box> deepCopyBoxes(List<Box> boxes) {
        return boxes.stream().map(Box::new).collect(Collectors.toList());
    }

    private double round2(double v) { return Math.round(v * 100.0) / 100.0; }
    private double round3(double v) { return Math.round(v * 1000.0) / 1000.0; }
}
