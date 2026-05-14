package com.psap.palletisation.service;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.ItemRequest;
import com.psap.palletisation.dto.request.PalletiseRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Validates palletise requests. Port of validation_service.py.
 */
@Service
public class ValidationService {

    public record ValidationResult(List<String> errors, List<String> warnings) {}

    public ValidationResult validateRequest(PalletiseRequest req) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (req.getItems() == null || req.getItems().isEmpty()) {
            errors.add("No order items provided.");
            return new ValidationResult(errors, warnings);
        }

        for (ItemRequest item : req.getItems()) {
            if (item.getSku() == null || item.getSku().isBlank()) {
                errors.add("Item SKU is required.");
            }
            if (item.getLengthMm() <= 0 || item.getWidthMm() <= 0 || item.getHeightMm() <= 0) {
                errors.add("SKU " + item.getSku() + ": dimensions must be positive.");
                continue;
            }
            if (item.getWeightKg() == 0) {
                warnings.add("SKU " + item.getSku() + ": weight missing or zero; using 0 kg.");
            } else if (item.getWeightKg() < 0) {
                errors.add("SKU " + item.getSku() + ": weight cannot be negative.");
            }
            if (item.getQuantity() <= 0) continue;
            if (!fitsPallet(item, req)) {
                errors.add(String.format("SKU %s: box (%.1fx%.1fx%.1f) cannot fit pallet in any allowed rotation.",
                        item.getSku(), item.getLengthMm(), item.getWidthMm(), item.getHeightMm()));
            }
        }

        return new ValidationResult(errors, warnings);
    }

    private boolean fitsPallet(ItemRequest item, PalletiseRequest req) {
        double palL = req.getPallet().getLengthMm();
        double palW = req.getPallet().getWidthMm();
        double palH = req.getPallet().getMaxHeightMm();
        Constraints c = req.getConstraints();

        double l = item.getLengthMm(), w = item.getWidthMm(), h = item.getHeightMm();
        List<double[]> orientations = new ArrayList<>();
        orientations.add(new double[]{l, w, h});

        if (c.isAllowRotation()) {
            if (item.isStandUprightOnly()) {
                orientations.add(new double[]{w, l, h});
            } else {
                orientations.add(new double[]{l, h, w});
                orientations.add(new double[]{w, l, h});
                orientations.add(new double[]{w, h, l});
                orientations.add(new double[]{h, l, w});
                orientations.add(new double[]{h, w, l});
            }
        }

        for (double[] o : orientations) {
            if (o[0] <= palL && o[1] <= palW && o[2] <= palH) return true;
        }
        return false;
    }
}
