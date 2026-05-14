package com.psap.palletisation.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psap.palletisation.dto.request.LayoutPatchRequest;
import com.psap.palletisation.dto.request.PalletPatch;
import com.psap.palletisation.dto.request.BoxPatch;
import com.psap.palletisation.dto.response.*;
import com.psap.palletisation.service.ExportService;
import com.psap.palletisation.service.JobStoreService;
import com.psap.palletisation.service.LayoutValidationService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class JobController {

    private final JobStoreService jobStore;
    private final LayoutValidationService layoutValidation;
    private final ExportService exportService;
    private final ObjectMapper objectMapper;

    public JobController(JobStoreService jobStore, LayoutValidationService layoutValidation,
                         ExportService exportService, ObjectMapper objectMapper) {
        this.jobStore = jobStore;
        this.layoutValidation = layoutValidation;
        this.exportService = exportService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<Map<String, Object>> getJob(@PathVariable String jobId) {
        PalletiseResponse result = jobStore.get(jobId);
        if (result == null) {
            JobStatus status = jobStore.getStatus(jobId);
            if (status != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = objectMapper.convertValue(status, Map.class);
                return ResponseEntity.ok(m);
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Job " + jobId + " not found");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> data = objectMapper.convertValue(result, Map.class);
        data.put("manually_adjusted", jobStore.isManuallyAdjusted(jobId));
        data.put("layout_source", jobStore.isManuallyAdjusted(jobId) ? "manual_adjusted" : "generated");
        return ResponseEntity.ok(data);
    }

    @PatchMapping("/jobs/{jobId}/layout")
    public ResponseEntity<LayoutPatchResponse> patchLayout(
            @PathVariable String jobId,
            @RequestBody LayoutPatchRequest req) {

        PalletiseResponse original = jobStore.getOriginal(jobId);
        if (original == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Job " + jobId + " not found");
        }

        Map<String, Object> palletConfig = jobStore.getPalletConfig(jobId);
        if (palletConfig == null) {
            palletConfig = new LinkedHashMap<>();
            palletConfig.put("length_mm", 1200.0);
            palletConfig.put("width_mm", 1100.0);
            palletConfig.put("max_height_mm", 1150.0);
            palletConfig.put("max_weight_kg", 1500.0);
        }

        Set<String> originalBoxIds = jobStore.getAllBoxIds(jobId);
        Map<String, BoxResult> origBoxMap = new LinkedHashMap<>();
        original.getPallets().forEach(p -> p.getBoxes().forEach(b -> origBoxMap.put(b.getBoxId(), b)));

        AdjustmentValidation validationResult = layoutValidation.validateAdjustedLayout(
                req, palletConfig, originalBoxIds, origBoxMap);

        String adjustedAt = ZonedDateTime.now(ZoneOffset.UTC)
                .format(DateTimeFormatter.ISO_INSTANT);

        // Build adjusted PalletResult objects
        List<PalletResult> adjustedPallets = new ArrayList<>();
        for (PalletPatch pp : req.getPallets()) {
            List<BoxResult> newBoxes = new ArrayList<>();
            for (BoxPatch bp : pp.getBoxes()) {
                BoxResult orig = origBoxMap.get(bp.getBoxId());
                if (orig != null) {
                    BoxResult updated = copyBoxResult(orig);
                    updated.setXMm(bp.getXMm());
                    updated.setYMm(bp.getYMm());
                    updated.setZMm(bp.getZMm());
                    updated.setLengthMm(bp.getLengthMm());
                    updated.setWidthMm(bp.getWidthMm());
                    updated.setHeightMm(bp.getHeightMm());
                    updated.setRotation(bp.getRotation());
                    updated.setLayer(bp.getLayer());
                    newBoxes.add(updated);
                }
            }
            double pVol = toDouble(palletConfig.get("length_mm"))
                    * toDouble(palletConfig.get("width_mm"))
                    * toDouble(palletConfig.get("max_height_mm"));
            double pArea = toDouble(palletConfig.get("length_mm"))
                    * toDouble(palletConfig.get("width_mm"));
            double usedVol = newBoxes.stream().mapToDouble(b -> b.getLengthMm() * b.getWidthMm() * b.getHeightMm()).sum();
            double usedArea = newBoxes.stream().mapToDouble(b -> b.getLengthMm() * b.getWidthMm()).sum();

            PalletResult pr = new PalletResult();
            pr.setPalletNo(pp.getPalletNo());
            pr.setVolumeUtilisationPct(pVol > 0 ? Math.round(usedVol / pVol * 10000) / 100.0 : 0);
            pr.setAreaUtilisationPct(pArea > 0 ? Math.min(Math.round(usedArea / pArea * 10000) / 100.0, 100.0) : 0);
            pr.setWeightKg(Math.round(newBoxes.stream().mapToDouble(BoxResult::getWeightKg).sum() * 1000) / 1000.0);
            pr.setBoxCount(newBoxes.size());
            pr.setBoxes(newBoxes);
            adjustedPallets.add(pr);
        }

        boolean canSave = validationResult.getIsValid() || !req.getSettings().isDoNotAllowStabilityIssues();
        if (canSave) {
            jobStore.saveAdjusted(jobId, adjustedPallets, adjustedAt);
        }

        LayoutPatchResponse resp = new LayoutPatchResponse();
        resp.setJobId(jobId);
        resp.setStatus(canSave ? "saved" : "rejected");
        resp.setManuallyAdjusted(canSave);
        resp.setAdjustedAt(adjustedAt);
        resp.setLayoutSource("manual_adjusted");
        resp.setValidation(validationResult);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/jobs/{jobId}/visualisation")
    public ResponseEntity<Map<String, Object>> getVisualisation(@PathVariable String jobId) {
        PalletiseResponse result = jobStore.get(jobId);
        if (result == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Job " + jobId + " not found");
        }

        List<Map<String, Object>> pallets = new ArrayList<>();
        for (PalletResult p : result.getPallets()) {
            List<Map<String, Object>> boxes = new ArrayList<>();
            for (BoxResult b : p.getBoxes()) {
                Map<String, Object> bm = new LinkedHashMap<>();
                bm.put("box_id", b.getBoxId());
                bm.put("sku", b.getSku());
                bm.put("x", b.getXMm());
                bm.put("y", b.getYMm());
                bm.put("z", b.getZMm());
                bm.put("l", b.getLengthMm());
                bm.put("w", b.getWidthMm());
                bm.put("h", b.getHeightMm());
                bm.put("rotation", b.getRotation());
                bm.put("layer", b.getLayer());
                boxes.add(bm);
            }
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("pallet_no", p.getPalletNo());
            pm.put("boxes", boxes);
            pallets.add(pm);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("job_id", jobId);
        response.put("manually_adjusted", jobStore.isManuallyAdjusted(jobId));
        response.put("pallets", pallets);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/jobs/{jobId}/export/csv")
    public ResponseEntity<byte[]> exportCsv(@PathVariable String jobId) {
        PalletiseResponse result = jobStore.get(jobId);
        if (result == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Job " + jobId + " not found");
        }
        String layoutSource = jobStore.isManuallyAdjusted(jobId) ? "manual_adjusted" : "generated";
        String csv = exportService.toCsv(result, layoutSource);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.setContentDispositionFormData("attachment", jobId + ".csv");
        return new ResponseEntity<>(csv.getBytes(), headers, HttpStatus.OK);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private BoxResult copyBoxResult(BoxResult src) {
        BoxResult copy = new BoxResult();
        copy.setBoxId(src.getBoxId());
        copy.setSku(src.getSku());
        copy.setNiItemCode(src.getNiItemCode());
        copy.setDescriptionOfGoods(src.getDescriptionOfGoods());
        copy.setLotNo(src.getLotNo());
        copy.setLineId(src.getLineId());
        copy.setSourceRow(src.getSourceRow());
        copy.setStoreNo(src.getStoreNo());
        copy.setDcNo(src.getDcNo());
        copy.setCenterLabel(src.getCenterLabel());
        copy.setCenterExpectedCartons(src.getCenterExpectedCartons());
        copy.setOriginalQuantity(src.getOriginalQuantity());
        copy.setPartialCarton(src.isPartialCarton());
        copy.setCartonIndex(src.getCartonIndex());
        copy.setXMm(src.getXMm()); copy.setYMm(src.getYMm()); copy.setZMm(src.getZMm());
        copy.setLengthMm(src.getLengthMm()); copy.setWidthMm(src.getWidthMm()); copy.setHeightMm(src.getHeightMm());
        copy.setWeightKg(src.getWeightKg());
        copy.setRotation(src.getRotation());
        copy.setBaseAreaMm2(src.getBaseAreaMm2());
        copy.setIsLargerBaseOrientation(src.getIsLargerBaseOrientation());
        copy.setLayer(src.getLayer());
        copy.setPickSequence(src.getPickSequence());
        copy.setLocation(src.getLocation());
        copy.setExpiryDate(src.getExpiryDate());
        copy.setStandUprightOnly(src.isStandUprightOnly());
        copy.setNoLoadOnTop(src.isNoLoadOnTop());
        copy.setOriginalHeightMm(src.getOriginalHeightMm());
        return copy;
    }

    private double toDouble(Object val) {
        if (val instanceof Number) return ((Number) val).doubleValue();
        if (val == null) return 0.0;
        try { return Double.parseDouble(val.toString()); } catch (NumberFormatException e) { return 0.0; }
    }
}
