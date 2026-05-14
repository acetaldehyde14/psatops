package com.psap.palletisation.algorithm;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.PalletSpec;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BestFitAlgorithmTest {

    private final BestFitAlgorithm algorithm = new BestFitAlgorithm();

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
    void singleBoxProducesOnePallet() {
        List<Box> boxes = List.of(box("A", "SKU", 400, 300, 200, 5));
        List<Pallet> pallets = algorithm.run(new ArrayList<>(boxes), defaultSpec(), defaultConstraints());

        assertThat(pallets).hasSize(1);
        assertThat(pallets.get(0).getBoxes()).hasSize(1);
        assertThat(pallets.get(0).getBoxes().get(0).isPlaced()).isTrue();
    }

    @Test
    void multipleBoxesFitOnOnePallet() {
        List<Box> boxes = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            boxes.add(box("B" + i, "SKU", 300, 250, 200, 3));
        }
        List<Pallet> pallets = algorithm.run(boxes, defaultSpec(), defaultConstraints());
        long placed = pallets.stream().flatMap(p -> p.getBoxes().stream())
                .filter(Box::isPlaced).count();
        assertThat(placed).isEqualTo(4);
    }

    @Test
    void heavyBoxExceedingWeightForcesNewPallet() {
        PalletSpec spec = new PalletSpec();
        spec.setLengthMm(1200); spec.setWidthMm(1100);
        spec.setMaxHeightMm(1150); spec.setMaxWeightKg(10); // very low

        List<Box> boxes = List.of(
                box("A", "SKU", 300, 200, 100, 9),  // nearly fills weight
                box("B", "SKU", 300, 200, 100, 9)   // must go to new pallet
        );
        List<Pallet> pallets = algorithm.run(new ArrayList<>(boxes), spec, defaultConstraints());
        assertThat(pallets.size()).isGreaterThanOrEqualTo(2);
    }
}
