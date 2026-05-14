package com.psap.palletisation.service;

import com.psap.palletisation.dto.request.*;
import com.psap.palletisation.dto.response.AdjustmentValidation;
import com.psap.palletisation.dto.response.BoxResult;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class LayoutValidationServiceTest {

    private final LayoutValidationService service = new LayoutValidationService();

    private Map<String, Object> defaultPalletConfig() {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("length_mm", 1200.0);
        cfg.put("width_mm", 1100.0);
        cfg.put("max_height_mm", 1150.0);
        cfg.put("max_weight_kg", 1500.0);
        return cfg;
    }

    private BoxPatch patch(String id, double x, double y, double z, double l, double w, double h) {
        BoxPatch bp = new BoxPatch();
        bp.setBoxId(id); bp.setXMm(x); bp.setYMm(y); bp.setZMm(z);
        bp.setLengthMm(l); bp.setWidthMm(w); bp.setHeightMm(h);
        bp.setRotation("LWH"); bp.setLayer(1);
        return bp;
    }

    private BoxResult originalBox(String id, double x, double y, double z, double l, double w, double h) {
        BoxResult br = new BoxResult();
        br.setBoxId(id); br.setSku("SKU");
        br.setXMm(x); br.setYMm(y); br.setZMm(z);
        br.setLengthMm(l); br.setWidthMm(w); br.setHeightMm(h);
        br.setWeightKg(5);
        return br;
    }

    @Test
    void overlappingBoxesFailsValidation() {
        PalletPatch pp = new PalletPatch();
        pp.setPalletNo(1);
        pp.setBoxes(List.of(
                patch("A", 0, 0, 0, 300, 200, 100),
                patch("B", 0, 0, 0, 300, 200, 100) // same position = overlap
        ));

        LayoutPatchRequest req = new LayoutPatchRequest();
        req.setPallets(List.of(pp));

        Map<String, BoxResult> origMap = new LinkedHashMap<>();
        origMap.put("A", originalBox("A", 0, 0, 0, 300, 200, 100));
        origMap.put("B", originalBox("B", 0, 0, 0, 300, 200, 100));

        AdjustmentValidation result = service.validateAdjustedLayout(
                req, defaultPalletConfig(), Set.of("A", "B"), origMap);

        assertThat(result.getIsValid()).isFalse();
        assertThat(result.getErrors()).anyMatch(e -> e.contains("overlap"));
    }

    @Test
    void floatingBoxFailsValidation() {
        PalletPatch pp = new PalletPatch();
        pp.setPalletNo(1);
        // Box at z=500 with nothing below
        pp.setBoxes(List.of(patch("A", 0, 0, 500, 300, 200, 100)));

        LayoutPatchRequest req = new LayoutPatchRequest();
        req.setPallets(List.of(pp));
        req.setSettings(new ManualAdjustmentSettings()); // strict stability by default

        Map<String, BoxResult> origMap = Map.of("A", originalBox("A", 0, 0, 500, 300, 200, 100));

        AdjustmentValidation result = service.validateAdjustedLayout(
                req, defaultPalletConfig(), Set.of("A"), origMap);

        assertThat(result.getIsValid()).isFalse();
        assertThat(result.getErrors()).anyMatch(e -> e.toLowerCase().contains("floating"));
    }

    @Test
    void boxOutsidePalletBoundsFailsValidation() {
        PalletPatch pp = new PalletPatch();
        pp.setPalletNo(1);
        // Box extends beyond pallet length (1200mm)
        pp.setBoxes(List.of(patch("A", 1100, 0, 0, 300, 200, 100)));

        LayoutPatchRequest req = new LayoutPatchRequest();
        req.setPallets(List.of(pp));

        Map<String, BoxResult> origMap = Map.of("A", originalBox("A", 0, 0, 0, 300, 200, 100));

        AdjustmentValidation result = service.validateAdjustedLayout(
                req, defaultPalletConfig(), Set.of("A"), origMap);

        assertThat(result.getIsValid()).isFalse();
    }

    @Test
    void missingBoxFromOriginalGeneratesWarning() {
        PalletPatch pp = new PalletPatch();
        pp.setPalletNo(1);
        // Only submit box B, box A is missing
        pp.setBoxes(List.of(patch("B", 0, 0, 0, 300, 200, 100)));

        LayoutPatchRequest req = new LayoutPatchRequest();
        req.setPallets(List.of(pp));

        Map<String, BoxResult> origMap = new LinkedHashMap<>();
        origMap.put("A", originalBox("A", 0, 0, 0, 300, 200, 100));
        origMap.put("B", originalBox("B", 300, 0, 0, 300, 200, 100));

        AdjustmentValidation result = service.validateAdjustedLayout(
                req, defaultPalletConfig(), Set.of("A", "B"), origMap);

        assertThat(result.getWarnings()).anyMatch(w -> w.toLowerCase().contains("missing"));
    }
}
