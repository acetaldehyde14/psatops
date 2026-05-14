package com.psap.palletisation.algorithm.util;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;

import java.util.List;

/**
 * Scoring utilities for comparing algorithm outputs.
 * Faithful port of scoring.py.
 */
public final class ScoringUtils {

    private ScoringUtils() {}

    /**
     * Score a complete pallet solution (lower = better).
     * Ports score_solution() exactly.
     *
     * Components:
     *   pallet_count * 1000  (dominant)
     *   - avg_volume_util * 500  (inverse)
     *   + cog_penalty * 0.001
     *   + stability_penalty
     *   + orientation_score
     */
    public static double scoreSolution(List<Pallet> pallets, Constraints constraints) {
        if (pallets == null || pallets.isEmpty()) return Double.POSITIVE_INFINITY;

        int n = pallets.size();
        double totalUtil = 0;
        double cogPenalty = 0;
        double stabilityPenalty = 0;
        double orientationScore = 0;

        for (Pallet p : pallets) {
            double cap = p.getVolumeCapacity();
            double util = cap > 0 ? p.getUsedVolume() / cap : 0;
            totalUtil += util;

            if (!p.getBoxes().isEmpty()) {
                double totalW = p.getBoxes().stream().mapToDouble(Box::getWeight).sum();
                if (totalW == 0) totalW = 1;
                double cx = p.getBoxes().stream()
                        .mapToDouble(b -> (b.getX() + b.getLength() / 2.0) * b.getWeight())
                        .sum() / totalW;
                double cy = p.getBoxes().stream()
                        .mapToDouble(b -> (b.getY() + b.getWidth() / 2.0) * b.getWeight())
                        .sum() / totalW;
                cogPenalty += Math.abs(cx - p.getLength() / 2.0) + Math.abs(cy - p.getWidth() / 2.0);

                for (Box b : p.getBoxes()) {
                    if (constraints != null && constraints.isPreferLargerBase()) {
                        orientationScore += -0.001 * (b.getLength() * b.getWidth()) + 0.01 * b.getHeight();
                    }
                    if (constraints != null && !constraints.isDoNotAllowStabilityIssues()) {
                        double frac = PlacementUtils.supportFractionFor(p, b.getX(), b.getY(), b.getZ(),
                                b.getLength(), b.getWidth());
                        if (frac < PlacementUtils.SUPPORT_THRESHOLD) {
                            stabilityPenalty += (PlacementUtils.SUPPORT_THRESHOLD - frac) * 500;
                        }
                    }
                }
            }
        }

        double avgUtil = totalUtil / n;
        return n * 1000.0 - avgUtil * 500.0 + cogPenalty * 0.001 + stabilityPenalty + orientationScore;
    }

    /**
     * Score a single placement candidate (lower = better).
     * Ports score_candidate() exactly.
     */
    public static double scoreCandidate(Box candidate, boolean preferLargerBase) {
        double score = candidate.getZ() * 1000.0 + candidate.getX() + candidate.getY();

        if (preferLargerBase && !candidate.isStandUprightOnly()) {
            double baseArea = candidate.getLength() * candidate.getWidth();
            score -= baseArea * 0.01;
            score += candidate.getHeight() * 5.0;

            double origL = candidate.getOriginalLength() != null ? candidate.getOriginalLength() : candidate.getLength();
            double origW = candidate.getOriginalWidth()  != null ? candidate.getOriginalWidth()  : candidate.getWidth();
            double origH = candidate.getOriginalHeight() != null ? candidate.getOriginalHeight() : candidate.getHeight();
            double smallest = Math.min(origL, Math.min(origW, origH));
            if (Math.abs(candidate.getHeight() - smallest) > 1e-6) {
                score += 100000;
            }
        }

        return score;
    }
}
