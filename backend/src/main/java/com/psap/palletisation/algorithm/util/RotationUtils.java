package com.psap.palletisation.algorithm.util;

import com.psap.palletisation.model.Box;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Rotation helpers — faithful port of rotations.py.
 */
public final class RotationUtils {

    private RotationUtils() {}

    public record Rotation(double l, double w, double h, String label) {}

    /**
     * Return allowed rotations for a box in the requested preference order.
     * Ports get_allowed_rotations() exactly.
     */
    public static List<Rotation> getAllowedRotations(Box box, boolean allowRotation, boolean preferLargerBase) {
        double origL = box.getOriginalLength() != null ? box.getOriginalLength() : box.getLength();
        double origW = box.getOriginalWidth()  != null ? box.getOriginalWidth()  : box.getWidth();
        double origH = box.getOriginalHeight() != null ? box.getOriginalHeight() : box.getHeight();

        if (!allowRotation) {
            String label = box.getRotation() != null ? box.getRotation() : "LWH";
            return List.of(new Rotation(origL, origW, origH, label));
        }

        List<Rotation> rotations = new ArrayList<>();
        rotations.add(new Rotation(origL, origW, origH, "LWH"));
        rotations.add(new Rotation(origW, origL, origH, "WLH"));
        rotations.add(new Rotation(origL, origH, origW, "LHW"));
        rotations.add(new Rotation(origH, origL, origW, "HLW"));
        rotations.add(new Rotation(origW, origH, origL, "WHL"));
        rotations.add(new Rotation(origH, origW, origL, "HWL"));

        // Deduplicate by rounded dimensions (1e-4 precision matches Python round(x,4))
        Set<String> seen = new LinkedHashSet<>();
        List<Rotation> unique = new ArrayList<>();
        for (Rotation r : rotations) {
            String key = Math.round(r.l() * 1e4) + "," + Math.round(r.w() * 1e4) + "," + Math.round(r.h() * 1e4);
            if (seen.add(key)) {
                unique.add(r);
            }
        }

        // Filter for stand_upright_only: height must equal original height
        if (box.isStandUprightOnly()) {
            unique.removeIf(r -> Math.abs(r.h() - origH) >= 1e-6);
        }

        // Sort for prefer_larger_base: (-l*w, h, -max(l,w))
        if (preferLargerBase) {
            unique.sort((a, b2) -> {
                double aBase = a.l() * a.w();
                double bBase = b2.l() * b2.w();
                int cmp = Double.compare(-aBase, -bBase); // descending base area
                if (cmp != 0) return cmp;
                cmp = Double.compare(a.h(), b2.h()); // ascending height
                if (cmp != 0) return cmp;
                return Double.compare(-Math.max(a.l(), a.w()), -Math.max(b2.l(), b2.w())); // descending max dim
            });
        }

        return unique;
    }

    /**
     * Return whether the given (l,w,h) orientation has the largest base area among all rotations.
     * Ports is_largest_base_orientation() exactly.
     */
    public static boolean isLargestBaseOrientation(Box box, double l, double w, double h, boolean allowRotation) {
        List<Rotation> rotations = getAllowedRotations(box, true, true);
        if (rotations.isEmpty()) return false;
        double maxBase = rotations.stream().mapToDouble(r -> r.l() * r.w()).max().orElse(0);
        return Math.abs((l * w) - maxBase) < 1e-6;
    }
}
