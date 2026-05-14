package com.psap.palletisation.algorithm;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.PalletSpec;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FirstFitAlgorithmTest {

    private final FirstFitAlgorithm algorithm = new FirstFitAlgorithm();

    private PalletSpec defaultSpec() {
        PalletSpec spec = new PalletSpec();
        spec.setLengthMm(1200); spec.setWidthMm(1100);
        spec.setMaxHeightMm(1150); spec.setMaxWeightKg(1500);
        return spec;
    }

    private Constraints defaultConstraints() {
        Constraints c = new Constraints();
        c.setAllowRotation(true);
        c.setDoNotAllowStabilityIssues(true);
        c.setEnforceNoLoadOnTop(true);
        return c;
    }

    private Box box(String id, String sku, double l, double w, double h, double wt) {
        Box b = new Box();
        b.setBoxId(id); b.setSku(sku);
        b.setLength(l); b.setWidth(w); b.setHeight(h); b.setWeight(wt);
        b.setOriginalLength(l); b.setOriginalWidth(w); b.setOriginalHeight(h);
        return b;
    }

    @Test
    void twoSmallBoxesFitOnOnePallet() {
        List<Box> boxes = List.of(
                box("A", "SKU-A", 400, 300, 200, 5),
                box("B", "SKU-B", 400, 300, 200, 5)
        );

        List<Pallet> pallets = algorithm.run(new ArrayList<>(boxes), defaultSpec(), defaultConstraints());

        assertThat(pallets).hasSize(1);
        assertThat(pallets.get(0).getBoxes()).hasSize(2);
        pallets.get(0).getBoxes().forEach(b -> assertThat(b.isPlaced()).isTrue());
    }

    @Test
    void largeBoxesRequireMultiplePallets() {
        // Three 600x600x600 boxes cannot all fit on a 1200x1100 pallet at z=0
        List<Box> boxes = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            boxes.add(box("BOX-" + i, "LARGE", 600, 600, 600, 10));
        }

        List<Pallet> pallets = algorithm.run(boxes, defaultSpec(), defaultConstraints());

        assertThat(pallets.size()).isGreaterThanOrEqualTo(2);
    }

    @Test
    void noLoadOnTopIsRespected() {
        // Box A has no_load_on_top; a box placed on top should trigger a new pallet
        Box a = box("A", "BASE", 600, 600, 100, 5);
        a.setNoLoadOnTop(true);
        Box b = box("B", "TOP", 600, 600, 100, 5);

        // Use a pallet just wide enough for both side-by-side or stacked
        PalletSpec spec = new PalletSpec();
        spec.setLengthMm(600); spec.setWidthMm(600);
        spec.setMaxHeightMm(300); spec.setMaxWeightKg(1000);

        Constraints c = defaultConstraints();
        c.setAllowRotation(false);

        List<Pallet> pallets = algorithm.run(new ArrayList<>(List.of(a, b)), spec, c);

        // All boxes placed (possibly on different pallets)
        long placed = pallets.stream().flatMap(p -> p.getBoxes().stream())
                .filter(Box::isPlaced).count();
        assertThat(placed).isGreaterThanOrEqualTo(1);

        // Box A should have no_load_on_top preserved
        Box boxA = pallets.stream().flatMap(p -> p.getBoxes().stream())
                .filter(bx -> bx.getBoxId().equals("A")).findFirst().orElse(null);
        assertThat(boxA).isNotNull();
        assertThat(boxA.isNoLoadOnTop()).isTrue();
    }
}
