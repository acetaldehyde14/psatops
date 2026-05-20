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
import java.util.List;

/**
 * First Fit Decreasing (FFD) bin packing algorithm.
 * Faithful port of first_fit.py.
 */
@Component
public class FirstFitAlgorithm {

    /** Result of a successful position search. */
    record Placement(double x, double y, double z, double l, double w, double h, String rotation) {}

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
                Placement pos = findPosition(pallet, box, constraints);
                if (pos != null) {
                    applyPlacement(box, pos);
                    pallet.getBoxes().add(box);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                current = newPallet(spec, palletNo);
                pallets.add(current);
                Placement pos = findPosition(current, box, constraints);
                if (pos != null) {
                    applyPlacement(box, pos);
                    current.getBoxes().add(box);
                } else {
                    box.setPlaced(false);
                }
            }
        }

        assignPickSequences(pallets);
        return pallets;
    }

    private Pallet newPallet(PalletSpec spec, int[] palletNo) {
        return new Pallet(spec.getLengthMm(), spec.getWidthMm(),
                spec.getMaxHeightMm(), spec.getMaxWeightKg(), palletNo[0]++);
    }

    private void applyPlacement(Box box, Placement pos) {
        box.setX(pos.x()); box.setY(pos.y()); box.setZ(pos.z());
        box.setLength(pos.l()); box.setWidth(pos.w()); box.setHeight(pos.h());
        box.setRotation(pos.rotation());
        box.setPlaced(true);
        box.setLayer((int)(pos.z() / 250.0) + 1);
    }

    Placement findPosition(Pallet pallet, Box box, Constraints constraints) {
        double origL = box.getLength(), origW = box.getWidth(), origH = box.getHeight();
        String origRot = box.getRotation();

        Placement bestPos = null;
        double bestScore = Double.POSITIVE_INFINITY;

        List<RotationUtils.Rotation> rotations = RotationUtils.getAllowedRotations(
                box, constraints.isAllowRotation(), constraints.isPreferLargerBase());

        for (RotationUtils.Rotation rot : rotations) {
            box.setLength(rot.l()); box.setWidth(rot.w()); box.setHeight(rot.h());
            box.setRotation(rot.label());

            double x = 0.0;
            while (x + rot.l() <= pallet.getLength() + 0.01) {
                double y = 0.0;
                while (y + rot.w() <= pallet.getWidth() + 0.01) {
                    double z = findZ(pallet, box, x, y);
                    if (canPlace(pallet, box, x, y, z, constraints)) {
                        box.setX(x); box.setY(y); box.setZ(z);
                        double score = ScoringUtils.scoreCandidate(box, pallet, constraints);
                        if (score < bestScore) {
                            bestScore = score;
                            bestPos = new Placement(x, y, z, rot.l(), rot.w(), rot.h(), rot.label());
                        }
                    }
                    y += rot.w();
                }
                x += rot.l();
            }
        }

        box.setLength(origL); box.setWidth(origW); box.setHeight(origH); box.setRotation(origRot);
        return bestPos;
    }

    static double findZ(Pallet pallet, Box box, double x, double y) {
        double z = 0.0;
        for (Box placed : pallet.getBoxes()) {
            if (x < placed.getX() + placed.getLength() - 0.01
                    && x + box.getLength() > placed.getX() + 0.01
                    && y < placed.getY() + placed.getWidth() - 0.01
                    && y + box.getWidth() > placed.getY() + 0.01) {
                z = Math.max(z, placed.getZ() + placed.getHeight());
            }
        }
        return z;
    }

    static boolean canPlace(Pallet pallet, Box box, double x, double y, double z, Constraints constraints) {
        double l = box.getLength(), w = box.getWidth(), h = box.getHeight();
        if (x + l > pallet.getLength() + 0.01) return false;
        if (y + w > pallet.getWidth() + 0.01) return false;
        if (z + h > pallet.getMaxHeight() + 0.01) return false;
        if (pallet.getUsedWeight() + box.getWeight() > pallet.getMaxWeight() + 0.001) return false;

        for (Box placed : pallet.getBoxes()) {
            if (x < placed.getX() + placed.getLength() - 0.01
                    && x + l > placed.getX() + 0.01
                    && y < placed.getY() + placed.getWidth() - 0.01
                    && y + w > placed.getY() + 0.01
                    && z < placed.getZ() + placed.getHeight() - 0.01
                    && z + h > placed.getZ() + 0.01) {
                return false;
            }
        }

        if (constraints != null && !PlacementUtils.placementStabilityOk(pallet, box, x, y, z, constraints)) {
            return false;
        }
        return true;
    }

    static void assignPickSequences(List<Pallet> pallets) {
        for (Pallet pallet : pallets) {
            List<Box> sortedBoxes = new ArrayList<>(pallet.getBoxes());
            sortedBoxes.sort(Comparator.comparingInt(Box::getLayer)
                    .thenComparingDouble(Box::getZ)
                    .thenComparingDouble(Box::getX)
                    .thenComparingDouble(Box::getY));
            for (int i = 0; i < sortedBoxes.size(); i++) {
                sortedBoxes.get(i).setPickSequence(i + 1);
            }
        }
    }
}
