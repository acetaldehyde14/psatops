package com.psap.palletisation.algorithm.util;

import com.psap.palletisation.dto.response.StabilityIssue;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;

import java.util.ArrayList;
import java.util.List;

/**
 * Stability validation for placed boxes.
 * Faithful port of stability.py.
 */
public final class StabilityUtils {

    private StabilityUtils() {}

    public record StabilityResult(int floatingCount, int unstableCount,
                                   List<StabilityIssue> issues, List<String> warnings) {}

    private static boolean overlapsXY(Box b1, Box b2) {
        return b1.getX() < b2.getX() + b2.getLength()
                && b1.getX() + b1.getLength() > b2.getX()
                && b1.getY() < b2.getY() + b2.getWidth()
                && b1.getY() + b1.getWidth() > b2.getY();
    }

    private static double supportAreaFraction(Box box, List<Box> boxesBelow) {
        if (boxesBelow.isEmpty()) return 0.0;
        double total = box.getLength() * box.getWidth();
        if (total == 0) return 1.0;
        double supported = 0.0;
        for (Box below : boxesBelow) {
            double oxStart = Math.max(box.getX(), below.getX());
            double oxEnd   = Math.min(box.getX() + box.getLength(), below.getX() + below.getLength());
            double oyStart = Math.max(box.getY(), below.getY());
            double oyEnd   = Math.min(box.getY() + box.getWidth(), below.getY() + below.getWidth());
            if (oxEnd > oxStart && oyEnd > oyStart) {
                supported += (oxEnd - oxStart) * (oyEnd - oyStart);
            }
        }
        return Math.min(supported / total, 1.0);
    }

    /**
     * Validate stability of all boxes on a pallet.
     * Ports validate_pallet() exactly.
     */
    public static StabilityResult validatePallet(Pallet pallet, int palletNo) {
        int floating = 0;
        int unstable = 0;
        List<String> warnings = new ArrayList<>();
        List<StabilityIssue> issues = new ArrayList<>();

        for (Box box : pallet.getBoxes()) {
            if (box.getZ() == 0) continue; // on the floor

            // Find boxes whose top face is at box.z
            List<Box> supporting = new ArrayList<>();
            for (Box b : pallet.getBoxes()) {
                if (b == box) continue;
                if (Math.abs((b.getZ() + b.getHeight()) - box.getZ()) < 0.1 && overlapsXY(box, b)) {
                    supporting.add(b);
                }
            }

            if (supporting.isEmpty()) {
                floating++;
                String msg = String.format("Box %s (SKU %s) at z=%.1f has no support.",
                        box.getBoxId(), box.getSku(), box.getZ());
                warnings.add(msg);
                StabilityIssue issue = new StabilityIssue();
                issue.setType("floating");
                issue.setSeverity("error");
                issue.setBoxId(box.getBoxId());
                issue.setPalletNo(palletNo);
                issue.setSku(box.getSku());
                issue.setMessage("Box is floating or has insufficient support");
                issues.add(issue);
            } else {
                double frac = supportAreaFraction(box, supporting);
                if (frac < PlacementUtils.SUPPORT_THRESHOLD) {
                    unstable++;
                    String msg = String.format("Box %s (SKU %s) has only %.0f%% support.",
                            box.getBoxId(), box.getSku(), frac * 100);
                    warnings.add(msg);
                    StabilityIssue issue = new StabilityIssue();
                    issue.setType("unstable");
                    issue.setSeverity("warning");
                    issue.setBoxId(box.getBoxId());
                    issue.setPalletNo(palletNo);
                    issue.setSku(box.getSku());
                    issue.setMessage(msg);
                    issues.add(issue);
                }
            }
        }

        // Check no_load_on_top violations
        for (Box base : pallet.getBoxes()) {
            if (!base.isNoLoadOnTop()) continue;
            double topZ = base.getZ() + base.getHeight();
            for (Box other : pallet.getBoxes()) {
                if (other == base) continue;
                if (Math.abs(other.getZ() - topZ) >= 1.0) continue;
                if (supportAreaFraction(other, List.of(base)) > 0) {
                    String msg = String.format("Box %s (SKU %s) is on top of %s, which has no_load_on_top.",
                            other.getBoxId(), other.getSku(), base.getBoxId());
                    warnings.add(msg);
                    StabilityIssue issue = new StabilityIssue();
                    issue.setType("no_load_on_top");
                    issue.setSeverity("warning");
                    issue.setBoxId(other.getBoxId());
                    issue.setPalletNo(palletNo);
                    issue.setSku(other.getSku());
                    issue.setMessage(msg);
                    issues.add(issue);
                }
            }
        }

        // Check stackability violations
        for (Box base : pallet.getBoxes()) {
            String s = base.getStackability();
            if (s == null || "stackable".equals(s)) continue;
            double topZ = base.getZ() + base.getHeight();
            for (Box other : pallet.getBoxes()) {
                if (other == base) continue;
                if (Math.abs(other.getZ() - topZ) >= 1.0) continue;
                // Check if other rests (at least partially) on base
                if (supportAreaFraction(other, List.of(base)) <= 0) continue;
                boolean violation = "non_stackable".equals(s)
                        || ("self_stackable".equals(s) && !base.getSku().equals(other.getSku()));
                if (violation) {
                    String msg = String.format(
                            "Box %s (SKU %s) is on top of %s (SKU %s) which has stackability '%s'.",
                            other.getBoxId(), other.getSku(), base.getBoxId(), base.getSku(), s);
                    StabilityIssue issue = new StabilityIssue();
                    issue.setType("stackability");
                    issue.setSeverity("warning");
                    issue.setBoxId(other.getBoxId());
                    issue.setPalletNo(palletNo);
                    issue.setSku(other.getSku());
                    issue.setMessage(msg);
                    issues.add(issue);
                }
            }
        }

        return new StabilityResult(floating, unstable, issues, warnings);
    }
}
