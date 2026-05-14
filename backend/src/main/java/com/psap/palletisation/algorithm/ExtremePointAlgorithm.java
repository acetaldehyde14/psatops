package com.psap.palletisation.algorithm;

import com.psap.palletisation.algorithm.util.PlacementUtils;
import com.psap.palletisation.algorithm.util.RotationUtils;
import com.psap.palletisation.algorithm.util.ScoringUtils;
import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.PalletSpec;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 3D Extreme Point Bin Packing.
 * Faithful port of extreme_point.py.
 */
@Component
public class ExtremePointAlgorithm {

    record Point(double x, double y, double z) {}

    public List<Pallet> run(List<Box> boxes, PalletSpec spec, Constraints constraints) {
        List<Box> sorted = new ArrayList<>(boxes);
        sorted.sort(Comparator.comparingDouble(Box::getVolume).reversed());

        List<Pallet> pallets = new ArrayList<>();
        int[] palletNo = {1};

        Pallet current = newPallet(spec, palletNo);
        pallets.add(current);

        for (Box box : sorted) {
            boolean placed = false;
            for (Pallet pallet : pallets) {
                if (placeBoxEP(pallet, box, constraints)) {
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                current = newPallet(spec, palletNo);
                pallets.add(current);
                if (!placeBoxEP(current, box, constraints)) {
                    box.setPlaced(false);
                }
            }
        }

        FirstFitAlgorithm.assignPickSequences(pallets);
        return pallets;
    }

    private Pallet newPallet(PalletSpec spec, int[] palletNo) {
        return new Pallet(spec.getLengthMm(), spec.getWidthMm(),
                spec.getMaxHeightMm(), spec.getMaxWeightKg(), palletNo[0]++);
    }

    boolean placeBoxEP(Pallet pallet, Box box, Constraints constraints) {
        List<Point> points = generateExtremePoints(pallet);
        // Sort gravity-first: z, x, y
        points.sort(Comparator.comparingDouble(Point::z).thenComparingDouble(Point::x).thenComparingDouble(Point::y));

        boolean preferLargerBase = constraints.isPreferLargerBase();
        List<RotationUtils.Rotation> rotations = RotationUtils.getAllowedRotations(
                box, constraints.isAllowRotation(), preferLargerBase);

        Box bestCandidate = null;
        double bestScore = Double.POSITIVE_INFINITY;

        if (preferLargerBase && !rotations.isEmpty()) {
            double maxBase = rotations.stream().mapToDouble(r -> r.l() * r.w()).max().orElse(0);
            List<RotationUtils.Rotation> primary = rotations.stream()
                    .filter(r -> Math.abs(r.l() * r.w() - maxBase) < 1e-6).toList();
            List<RotationUtils.Rotation> fallback = rotations.stream()
                    .filter(r -> !primary.contains(r)).toList();

            bestCandidate = bestCandidateForRotations(pallet, box, primary, points, constraints);
            if (bestCandidate == null && !fallback.isEmpty()) {
                bestCandidate = bestCandidateForRotations(pallet, box, fallback, points, constraints);
            }
        } else {
            bestCandidate = bestCandidateForRotations(pallet, box, rotations, points, constraints);
        }

        if (bestCandidate != null) {
            box.setLength(bestCandidate.getLength());
            box.setWidth(bestCandidate.getWidth());
            box.setHeight(bestCandidate.getHeight());
            box.setRotation(bestCandidate.getRotation());
            box.setX(bestCandidate.getX());
            box.setY(bestCandidate.getY());
            box.setZ(bestCandidate.getZ());
            box.setLayer(bestCandidate.getLayer());
            box.setPlaced(true);
            pallet.getBoxes().add(box);
            return true;
        }
        return false;
    }

    private Box bestCandidateForRotations(Pallet pallet, Box box,
                                           List<RotationUtils.Rotation> rotations,
                                           List<Point> points, Constraints constraints) {
        Box bestCandidate = null;
        double bestScore = Double.POSITIVE_INFINITY;

        for (Point pt : points) {
            for (RotationUtils.Rotation rot : rotations) {
                // Temporarily create a candidate box
                Box candidate = new Box(box);
                candidate.setLength(rot.l());
                candidate.setWidth(rot.w());
                candidate.setHeight(rot.h());
                candidate.setRotation(rot.label());
                candidate.setX(pt.x());
                candidate.setY(pt.y());
                candidate.setZ(pt.z());
                candidate.setLayer((int)(pt.z() / 250.0) + 1);

                if (!canPlaceEP(pallet, candidate, pt.x(), pt.y(), pt.z(), constraints)) continue;

                double score = ScoringUtils.scoreCandidate(candidate, constraints.isPreferLargerBase());
                if (score < bestScore) {
                    bestScore = score;
                    bestCandidate = candidate;
                }
            }
        }
        return bestCandidate;
    }

    private boolean canPlaceEP(Pallet pallet, Box box, double x, double y, double z,
                                 Constraints constraints) {
        double l = box.getLength(), w = box.getWidth(), h = box.getHeight();
        final double EPS = PlacementUtils.EPS;
        if (x + l > pallet.getLength() + EPS) return false;
        if (y + w > pallet.getWidth() + EPS) return false;
        if (z + h > pallet.getMaxHeight() + EPS) return false;
        if (pallet.getUsedWeight() + box.getWeight() > pallet.getMaxWeight() + 0.001) return false;

        for (Box placed : pallet.getBoxes()) {
            if (x < placed.getX() + placed.getLength() - EPS
                    && x + l > placed.getX() + EPS
                    && y < placed.getY() + placed.getWidth() - EPS
                    && y + w > placed.getY() + EPS
                    && z < placed.getZ() + placed.getHeight() - EPS
                    && z + h > placed.getZ() + EPS) {
                return false;
            }
        }

        if (constraints != null && !PlacementUtils.placementStabilityOk(pallet, box, x, y, z, constraints)) {
            return false;
        }
        return true;
    }

    private List<Point> generateExtremePoints(Pallet pallet) {
        if (pallet.getBoxes().isEmpty()) {
            return new ArrayList<>(List.of(new Point(0, 0, 0)));
        }

        Set<String> seen = new LinkedHashSet<>();
        List<Point> points = new ArrayList<>();

        // Always include origin
        addPoint(points, seen, new Point(0, 0, 0), pallet);

        for (Box b : pallet.getBoxes()) {
            addPoint(points, seen, new Point(b.getX() + b.getLength(), b.getY(), b.getZ()), pallet);
            addPoint(points, seen, new Point(b.getX(), b.getY() + b.getWidth(), b.getZ()), pallet);
            addPoint(points, seen, new Point(b.getX(), b.getY(), b.getZ() + b.getHeight()), pallet);
        }

        return points;
    }

    private void addPoint(List<Point> points, Set<String> seen, Point pt, Pallet pallet) {
        if (pt.x() > pallet.getLength() + 0.01) return;
        if (pt.y() > pallet.getWidth() + 0.01) return;
        if (pt.z() > pallet.getMaxHeight() + 0.01) return;
        String key = Math.round(pt.x() * 100) + "," + Math.round(pt.y() * 100) + "," + Math.round(pt.z() * 100);
        if (seen.add(key)) {
            points.add(pt);
        }
    }
}
