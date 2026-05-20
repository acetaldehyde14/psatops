package com.psap.palletisation.algorithm.util;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;

/**
 * Shared placement validation helpers — faithful port of placement.py.
 */
public final class PlacementUtils {

    public static final double SUPPORT_THRESHOLD = 0.70;
    public static final double EPS = 0.01;

    private PlacementUtils() {}

    /**
     * Computes XY-plane overlap area between two rectangles.
     * Ports xy_overlap_area() exactly.
     */
    public static double xyOverlapArea(double ax, double ay, double al, double aw,
                                        double bx, double by, double bl, double bw) {
        double ox = Math.min(ax + al, bx + bl) - Math.max(ax, bx);
        double oy = Math.min(ay + aw, by + bw) - Math.max(ay, by);
        return (ox > 0 && oy > 0) ? ox * oy : 0.0;
    }

    /**
     * Checks 3D overlap between a placed box and a candidate position.
     * Ports the inline overlap logic in placement algorithms.
     */
    public static boolean overlaps3D(Box placed, double x, double y, double z, double l, double w, double h) {
        return x < placed.getX() + placed.getLength() - EPS
                && x + l > placed.getX() + EPS
                && y < placed.getY() + placed.getWidth() - EPS
                && y + w > placed.getY() + EPS
                && z < placed.getZ() + placed.getHeight() - EPS
                && z + h > placed.getZ() + EPS;
    }

    /**
     * Returns what fraction of the box base (l x w) at position (x,y,z) is supported.
     * Box at z <= EPS is on the floor → 1.0.
     * Ports support_fraction_for() exactly.
     */
    public static double supportFractionFor(Pallet pallet, double x, double y, double z, double l, double w) {
        if (z <= EPS) return 1.0;
        double base = l * w;
        if (base == 0) return 1.0;
        double supported = 0.0;
        for (Box placed : pallet.getBoxes()) {
            if (Math.abs((placed.getZ() + placed.getHeight()) - z) < 1.0) {
                supported += xyOverlapArea(x, y, l, w, placed.getX(), placed.getY(), placed.getLength(), placed.getWidth());
            }
        }
        return Math.min(supported / base, 1.0);
    }

    /**
     * Returns true if placing a box at (x, y, z) with dimensions (l, w) on the pallet
     * would violate the stackability constraint of any box already placed beneath it.
     *
     * Rules:
     *   non_stackable: nothing may be placed on top
     *   self_stackable: only boxes of the same SKU may be placed on top
     */
    public static boolean hasStackabilityViolation(Pallet pallet, Box candidate,
                                                    double x, double y, double z,
                                                    double l, double w) {
        for (Box placed : pallet.getBoxes()) {
            String s = placed.getStackability();
            if (s == null || "stackable".equals(s)) continue;
            // The candidate must be resting on top of placed (z interfaces match within 1mm)
            if (Math.abs((placed.getZ() + placed.getHeight()) - z) >= 1.0) continue;
            // There must be horizontal overlap
            if (xyOverlapArea(x, y, l, w, placed.getX(), placed.getY(), placed.getLength(), placed.getWidth()) <= 1.0) continue;
            if ("non_stackable".equals(s)) return true;
            if ("self_stackable".equals(s) && !placed.getSku().equals(candidate.getSku())) return true;
        }
        return false;
    }

    /**
     * Returns true if placing a box at (testX,testY,testZ) with (testL,testW) dimensions
     * would rest on a box that has no_load_on_top=true.
     * Ports has_no_load_on_top_violation() exactly.
     */
    public static boolean hasNoLoadOnTopViolation(Pallet pallet, double testX, double testY, double testZ,
                                                    double testL, double testW) {
        for (Box placed : pallet.getBoxes()) {
            if (!placed.isNoLoadOnTop()) continue;
            if (Math.abs((placed.getZ() + placed.getHeight()) - testZ) >= 1.0) continue;
            if (xyOverlapArea(testX, testY, testL, testW, placed.getX(), placed.getY(), placed.getLength(), placed.getWidth()) > 1.0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true if placement is stable (or stability not enforced).
     * Ports placement_stability_ok() exactly.
     */
    public static boolean placementStabilityOk(Pallet pallet, Box box, double x, double y, double z,
                                                 Constraints constraints) {
        if (constraints.isEnforceNoLoadOnTop()
                && hasNoLoadOnTopViolation(pallet, x, y, z, box.getLength(), box.getWidth())) {
            return false;
        }
        if (hasStackabilityViolation(pallet, box, x, y, z, box.getLength(), box.getWidth())) {
            return false;
        }
        if (!constraints.isDoNotAllowStabilityIssues()) {
            return true;
        }
        return supportFractionFor(pallet, x, y, z, box.getLength(), box.getWidth()) >= SUPPORT_THRESHOLD;
    }

    /**
     * Rotation score adjustment when prefer_larger_base is active.
     * Ports rotation_score() exactly.
     */
    public static double rotationScore(Box box, boolean preferLargerBase) {
        if (!preferLargerBase) return 0.0;
        return -0.001 * (box.getLength() * box.getWidth()) + 0.01 * box.getHeight();
    }
}
