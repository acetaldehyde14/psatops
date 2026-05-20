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
 * Best Fit placement — place box where residual space is minimised.
 * Faithful port of best_fit.py.
 */
@Component
public class BestFitAlgorithm {

    record Placement(double x, double y, double z, double l, double w, double h, String rotation) {}

    public List<Pallet> run(List<Box> boxes, PalletSpec spec, Constraints constraints) {
        List<Box> sorted = new ArrayList<>(boxes);
        sorted.sort(Comparator.comparingDouble(Box::getVolume).reversed());

        List<Pallet> pallets = new ArrayList<>();
        int[] palletNo = {1};

        for (Box box : sorted) {
            Pallet bestPallet = null;
            Placement bestPos = null;
            double bestResidual = Double.POSITIVE_INFINITY;

            for (Pallet pallet : pallets) {
                Placement pos = findBestPosition(pallet, box, constraints);
                if (pos != null) {
                    double residual = residualVolume(pallet) - box.getVolume();
                    if (residual < bestResidual) {
                        bestResidual = residual;
                        bestPallet = pallet;
                        bestPos = pos;
                    }
                }
            }

            if (bestPallet == null) {
                bestPallet = newPallet(spec, palletNo);
                pallets.add(bestPallet);
                bestPos = findBestPosition(bestPallet, box, constraints);
            }

            if (bestPos != null) {
                applyPlacement(box, bestPos);
                bestPallet.getBoxes().add(box);
            } else {
                newPallet(spec, palletNo); // create unused pallet to keep pallet_no correct
                box.setPlaced(false);
            }
        }

        FirstFitAlgorithm.assignPickSequences(pallets);
        return pallets;
    }

    private Pallet newPallet(PalletSpec spec, int[] palletNo) {
        return new Pallet(spec.getLengthMm(), spec.getWidthMm(),
                spec.getMaxHeightMm(), spec.getMaxWeightKg(), palletNo[0]++);
    }

    private double residualVolume(Pallet pallet) {
        return pallet.getLength() * pallet.getWidth() * pallet.getMaxHeight() - pallet.getUsedVolume();
    }

    private void applyPlacement(Box box, Placement pos) {
        box.setX(pos.x()); box.setY(pos.y()); box.setZ(pos.z());
        box.setLength(pos.l()); box.setWidth(pos.w()); box.setHeight(pos.h());
        box.setRotation(pos.rotation());
        box.setPlaced(true);
        box.setLayer((int)(pos.z() / 250.0) + 1);
    }

    Placement findBestPosition(Pallet pallet, Box box, Constraints constraints) {
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
                    double z = FirstFitAlgorithm.findZ(pallet, box, x, y);
                    if (FirstFitAlgorithm.canPlace(pallet, box, x, y, z, constraints)) {
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
}
