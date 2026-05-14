package com.psap.palletisation.service;

import com.psap.palletisation.dto.request.BoxPatch;
import com.psap.palletisation.dto.request.LayoutPatchRequest;
import com.psap.palletisation.dto.request.ManualAdjustmentSettings;
import com.psap.palletisation.dto.request.PalletPatch;
import com.psap.palletisation.dto.response.AdjustmentValidation;
import com.psap.palletisation.dto.response.BoxResult;
import com.psap.palletisation.dto.response.StabilityIssue;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Comprehensive validation for manually adjusted layouts.
 * Port of layout_validation_service.py.
 */
@Service
public class LayoutValidationService {

    private static final double SUPPORT_THRESHOLD = 0.70;

    public AdjustmentValidation validateAdjustedLayout(
            LayoutPatchRequest layout,
            Map<String, Object> palletConfig,
            Set<String> originalBoxIds,
            Map<String, BoxResult> origBoxMap) {

        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<Map<String, Object>> allBoxes = new ArrayList<>();
        Set<String> submittedIds = new LinkedHashSet<>();
        Map<String, int[]> boxMeta = new LinkedHashMap<>(); // boxId → [palletNo, sku_placeholder]

        double L = toDouble(palletConfig.get("length_mm"));
        double W = toDouble(palletConfig.get("width_mm"));
        double H = toDouble(palletConfig.get("max_height_mm"));
        double maxW = toDouble(palletConfig.get("max_weight_kg"));

        ManualAdjustmentSettings settings = layout.getSettings();

        for (PalletPatch palletPatch : layout.getPallets()) {
            List<Map<String, Object>> boxes = toBoxMaps(palletPatch.getBoxes());
            allBoxes.addAll(boxes);
            for (Map<String, Object> b : boxes) {
                String bid = (String) b.get("box_id");
                boxMeta.put(bid, new int[]{palletPatch.getPalletNo()});
            }

            checkBoundaryWithThreshold(boxes, palletConfig, settings, errors);
            checkMaxHeight(boxes, palletConfig, errors);
            checkMaxWeight(boxes, palletPatch.getPalletNo(), palletConfig, errors);
            checkOverlap(boxes, palletPatch.getPalletNo(), errors);
            checkFloating(boxes, palletPatch.getPalletNo(), errors, warnings, settings.isDoNotAllowStabilityIssues());
            checkNoLoadOnTop(boxes, origBoxMap, palletPatch.getPalletNo(), errors, warnings,
                    settings.isEnforceNoLoadOnTop(), settings.isDoNotAllowStabilityIssues());
            checkStandUprightOnly(boxes, origBoxMap, palletPatch.getPalletNo(), errors);

            for (Map<String, Object> b : boxes) {
                submittedIds.add((String) b.get("box_id"));
            }
        }

        checkDuplicateBoxIds(allBoxes, errors);
        checkMissingAndExtraBoxes(submittedIds, originalBoxIds, warnings, errors);

        // Build issues from error/warning messages
        Map<String, Object[]> boxMetaForIssues = new LinkedHashMap<>();
        for (Map.Entry<String, int[]> e : boxMeta.entrySet()) {
            BoxResult orig = origBoxMap.get(e.getKey());
            boxMetaForIssues.put(e.getKey(), new Object[]{e.getValue()[0], orig != null ? orig.getSku() : null});
        }
        List<StabilityIssue> issues = issuesFromMessages(errors, warnings, boxMetaForIssues);
        List<String> invalidBoxIds = issues.stream()
                .filter(i -> i.getBoxId() != null && "error".equals(i.getSeverity()))
                .map(StabilityIssue::getBoxId)
                .distinct()
                .sorted()
                .toList();

        AdjustmentValidation result = new AdjustmentValidation();
        result.setIsValid(errors.isEmpty());
        result.setInvalidBoxIds(new ArrayList<>(invalidBoxIds));
        result.setIssues(issues);
        result.setErrors(errors);
        result.setWarnings(warnings);
        return result;
    }

    // ── Check functions ───────────────────────────────────────────────────────

    private void checkBoundaryWithThreshold(List<Map<String, Object>> boxes,
                                              Map<String, Object> palletConfig,
                                              ManualAdjustmentSettings settings,
                                              List<String> errors) {
        double tl = settings.getEdgeThresholdLengthMm();
        double tw = settings.getEdgeThresholdWidthMm();
        double L = toDouble(palletConfig.get("length_mm"));
        double W = toDouble(palletConfig.get("width_mm"));

        for (Map<String, Object> b : boxes) {
            String bid = (String) b.get("box_id");
            double x = toDouble(b.get("x_mm")), y = toDouble(b.get("y_mm"));
            double l = toDouble(b.get("length_mm")), w = toDouble(b.get("width_mm"));
            if (x < tl - 0.5) errors.add(String.format("Box '%s': x=%.1f violates length edge threshold (%.1f mm).", bid, x, tl));
            if (y < tw - 0.5) errors.add(String.format("Box '%s': y=%.1f violates width edge threshold (%.1f mm).", bid, y, tw));
            if (x + l > L - tl + 0.5) errors.add(String.format("Box '%s': right edge %.1f violates length edge threshold (max %.1f).", bid, x + l, L - tl));
            if (y + w > W - tw + 0.5) errors.add(String.format("Box '%s': front edge %.1f violates width edge threshold (max %.1f).", bid, y + w, W - tw));
        }
    }

    private void checkMaxHeight(List<Map<String, Object>> boxes, Map<String, Object> palletConfig, List<String> errors) {
        double H = toDouble(palletConfig.get("max_height_mm"));
        for (Map<String, Object> b : boxes) {
            double top = toDouble(b.get("z_mm")) + toDouble(b.get("height_mm"));
            if (top > H + 0.5)
                errors.add(String.format("Box '%s': top %.1f mm exceeds pallet max height %.1f mm.", b.get("box_id"), top, H));
        }
    }

    private void checkMaxWeight(List<Map<String, Object>> boxes, int palletNo,
                                  Map<String, Object> palletConfig, List<String> errors) {
        double total = boxes.stream().mapToDouble(b -> toDouble(b.getOrDefault("weight_kg", 0))).sum();
        double maxW = toDouble(palletConfig.get("max_weight_kg"));
        if (total > maxW + 0.001)
            errors.add(String.format("Pallet %d: total weight %.2f kg exceeds max %.1f kg.", palletNo, total, maxW));
    }

    private void checkOverlap(List<Map<String, Object>> boxes, int palletNo, List<String> errors) {
        for (int i = 0; i < boxes.size(); i++) {
            for (int j = i + 1; j < boxes.size(); j++) {
                Map<String, Object> a = boxes.get(i), b = boxes.get(j);
                if (overlaps(a, b))
                    errors.add(String.format("Pallet %d: boxes '%s' and '%s' overlap.", palletNo, a.get("box_id"), b.get("box_id")));
            }
        }
    }

    private void checkFloating(List<Map<String, Object>> boxes, int palletNo,
                                 List<String> errors, List<String> warnings, boolean strict) {
        for (Map<String, Object> box : boxes) {
            if (toDouble(box.get("z_mm")) < 0.5) continue;
            double baseArea = toDouble(box.get("length_mm")) * toDouble(box.get("width_mm"));
            if (baseArea == 0) continue;
            double supported = 0;
            for (Map<String, Object> other : boxes) {
                if (other.get("box_id").equals(box.get("box_id"))) continue;
                if (Math.abs((toDouble(other.get("z_mm")) + toDouble(other.get("height_mm"))) - toDouble(box.get("z_mm"))) < 1.0) {
                    supported += xyOverlapArea(
                            toDouble(box.get("x_mm")), toDouble(box.get("y_mm")),
                            toDouble(box.get("length_mm")), toDouble(box.get("width_mm")),
                            toDouble(other.get("x_mm")), toDouble(other.get("y_mm")),
                            toDouble(other.get("length_mm")), toDouble(other.get("width_mm")));
                }
            }
            double frac = Math.min(supported / baseArea, 1.0);
            if (frac == 0.0) {
                String msg = String.format("Pallet %d: box '%s' is floating (z=%.1f, no support below).",
                        palletNo, box.get("box_id"), toDouble(box.get("z_mm")));
                (strict ? errors : warnings).add(msg);
            } else if (frac < SUPPORT_THRESHOLD) {
                String msg = String.format("Pallet %d: box '%s' has only %.0f%% support (minimum %.0f%%).",
                        palletNo, box.get("box_id"), frac * 100, SUPPORT_THRESHOLD * 100);
                (strict ? errors : warnings).add(msg);
            }
        }
    }

    private void checkNoLoadOnTop(List<Map<String, Object>> boxes, Map<String, BoxResult> origMap,
                                    int palletNo, List<String> errors, List<String> warnings,
                                    boolean enforceNoLoadOnTop, boolean strict) {
        if (!enforceNoLoadOnTop) return;
        for (Map<String, Object> box : boxes) {
            BoxResult orig = origMap.get(box.get("box_id"));
            boolean noLoad = (orig != null && orig.isNoLoadOnTop()) ||
                    Boolean.TRUE.equals(box.get("no_load_on_top"));
            if (!noLoad) continue;
            double topZ = toDouble(box.get("z_mm")) + toDouble(box.get("height_mm"));
            for (Map<String, Object> other : boxes) {
                if (other.get("box_id").equals(box.get("box_id"))) continue;
                if (Math.abs(toDouble(other.get("z_mm")) - topZ) < 1.0) {
                    double overlap = xyOverlapArea(
                            toDouble(box.get("x_mm")), toDouble(box.get("y_mm")),
                            toDouble(box.get("length_mm")), toDouble(box.get("width_mm")),
                            toDouble(other.get("x_mm")), toDouble(other.get("y_mm")),
                            toDouble(other.get("length_mm")), toDouble(other.get("width_mm")));
                    if (overlap > 1.0) {
                        String msg = String.format("Pallet %d: box '%s' is on top of '%s' which has no_load_on_top constraint.",
                                palletNo, other.get("box_id"), box.get("box_id"));
                        (strict ? errors : warnings).add(msg);
                    }
                }
            }
        }
    }

    private void checkStandUprightOnly(List<Map<String, Object>> boxes, Map<String, BoxResult> origMap,
                                         int palletNo, List<String> errors) {
        for (Map<String, Object> box : boxes) {
            BoxResult orig = origMap.get(box.get("box_id"));
            boolean upright = (orig != null && orig.isStandUprightOnly()) ||
                    Boolean.TRUE.equals(box.get("stand_upright_only"));
            if (!upright) continue;
            Double origH = orig != null ? (orig.getOriginalHeightMm() != null ? orig.getOriginalHeightMm() : orig.getHeightMm()) : null;
            if (origH == null) continue;
            if (Math.abs(toDouble(box.get("height_mm")) - origH) > 0.5) {
                errors.add(String.format("Pallet %d: box '%s' has stand_upright_only constraint but height changed from %.1f to %.1f mm.",
                        palletNo, box.get("box_id"), origH, toDouble(box.get("height_mm"))));
            }
        }
    }

    private void checkDuplicateBoxIds(List<Map<String, Object>> allBoxes, List<String> errors) {
        Set<String> seen = new LinkedHashSet<>();
        for (Map<String, Object> b : allBoxes) {
            String bid = (String) b.get("box_id");
            if (!seen.add(bid))
                errors.add(String.format("Duplicate box_id '%s' found in adjusted layout.", bid));
        }
    }

    private void checkMissingAndExtraBoxes(Set<String> submitted, Set<String> original,
                                             List<String> warnings, List<String> errors) {
        Set<String> missing = new TreeSet<>(original);
        missing.removeAll(submitted);
        Set<String> extra = new TreeSet<>(submitted);
        extra.removeAll(original);
        for (String bid : missing)
            warnings.add(String.format("Box '%s' from generated layout is missing in adjusted layout.", bid));
        for (String bid : extra)
            errors.add(String.format("Box '%s' is not in the original generated layout (unknown box).", bid));
    }

    // ── Geometry helpers ──────────────────────────────────────────────────────

    private boolean overlaps(Map<String, Object> a, Map<String, Object> b) {
        double EPS = 0.5;
        double ax = toDouble(a.get("x_mm")), ay = toDouble(a.get("y_mm")), az = toDouble(a.get("z_mm"));
        double al = toDouble(a.get("length_mm")), aw = toDouble(a.get("width_mm")), ah = toDouble(a.get("height_mm"));
        double bx = toDouble(b.get("x_mm")), by = toDouble(b.get("y_mm")), bz = toDouble(b.get("z_mm"));
        double bl = toDouble(b.get("length_mm")), bw = toDouble(b.get("width_mm")), bh = toDouble(b.get("height_mm"));
        return ax < bx + bl - EPS && ax + al > bx + EPS
                && ay < by + bw - EPS && ay + aw > by + EPS
                && az < bz + bh - EPS && az + ah > bz + EPS;
    }

    private double xyOverlapArea(double ax, double ay, double al, double aw,
                                   double bx, double by, double bl, double bw) {
        double ox = Math.min(ax + al, bx + bl) - Math.max(ax, bx);
        double oy = Math.min(ay + aw, by + bw) - Math.max(ay, by);
        return (ox > 0 && oy > 0) ? ox * oy : 0.0;
    }

    // ── Issue builder ─────────────────────────────────────────────────────────

    private List<StabilityIssue> issuesFromMessages(List<String> errors, List<String> warnings,
                                                      Map<String, Object[]> boxMeta) {
        List<StabilityIssue> issues = new ArrayList<>();
        for (String[] entry : new String[][]{}) {} // placeholder
        for (int pass = 0; pass < 2; pass++) {
            String severity = pass == 0 ? "error" : "warning";
            List<String> messages = pass == 0 ? errors : warnings;
            for (String message : messages) {
                List<String> ids = extractBoxIds(message);
                if (ids.isEmpty()) {
                    StabilityIssue issue = new StabilityIssue();
                    issue.setType(issueType(message));
                    issue.setSeverity(severity);
                    issue.setMessage(message);
                    issues.add(issue);
                } else {
                    for (String bid : ids) {
                        Object[] meta = boxMeta.get(bid);
                        StabilityIssue issue = new StabilityIssue();
                        issue.setType(issueType(message));
                        issue.setSeverity(severity);
                        issue.setBoxId(bid);
                        if (meta != null) {
                            issue.setPalletNo((Integer) meta[0]);
                            issue.setSku((String) meta[1]);
                        }
                        issue.setMessage(message);
                        issues.add(issue);
                    }
                }
            }
        }
        return issues;
    }

    private static final Pattern BOX_ID_PATTERN = Pattern.compile("'([A-Za-z0-9_-]+)'");

    private List<String> extractBoxIds(String message) {
        List<String> ids = new ArrayList<>();
        Matcher m = BOX_ID_PATTERN.matcher(message);
        while (m.find()) {
            ids.add(m.group(1));
        }
        return ids.stream().distinct().toList();
    }

    private String issueType(String message) {
        String msg = message.toLowerCase();
        if (msg.contains("floating") || msg.contains("no support")) return "floating";
        if (msg.contains("support")) return "unstable";
        if (msg.contains("overlap")) return "overlap";
        if (msg.contains("threshold") || msg.contains("edge") || msg.contains("outside") || msg.contains("exceeds")) return "boundary";
        if (msg.contains("height")) return "height";
        if (msg.contains("no_load_on_top")) return "no_load_on_top";
        if (msg.contains("stand_upright_only")) return "stand_upright_only";
        if (msg.contains("duplicate")) return "duplicate";
        if (msg.contains("missing")) return "missing";
        return "validation";
    }

    // ── Conversion helpers ────────────────────────────────────────────────────

    private double toDouble(Object val) {
        if (val instanceof Number) return ((Number) val).doubleValue();
        if (val == null) return 0.0;
        try { return Double.parseDouble(val.toString()); } catch (NumberFormatException e) { return 0.0; }
    }

    private List<Map<String, Object>> toBoxMaps(List<BoxPatch> patches) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (BoxPatch bp : patches) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("box_id", bp.getBoxId());
            m.put("x_mm", bp.getXMm());
            m.put("y_mm", bp.getYMm());
            m.put("z_mm", bp.getZMm());
            m.put("length_mm", bp.getLengthMm());
            m.put("width_mm", bp.getWidthMm());
            m.put("height_mm", bp.getHeightMm());
            m.put("rotation", bp.getRotation());
            m.put("layer", bp.getLayer());
            m.put("stand_upright_only", bp.isStandUprightOnly());
            m.put("no_load_on_top", bp.isNoLoadOnTop());
            m.put("weight_kg", 0.0); // weight not in patch
            result.add(m);
        }
        return result;
    }
}
