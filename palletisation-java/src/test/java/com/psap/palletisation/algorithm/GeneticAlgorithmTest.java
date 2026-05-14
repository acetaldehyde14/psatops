package com.psap.palletisation.algorithm;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.PalletSpec;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GeneticAlgorithmTest {

    private final ExtremePointAlgorithm epAlgorithm = new ExtremePointAlgorithm();
    private final GeneticAlgorithm algorithm = new GeneticAlgorithm(epAlgorithm);

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
    void producesAtLeastOnePallet() {
        List<Box> boxes = new ArrayList<>(List.of(
                box("A", "SKU", 300, 200, 150, 5),
                box("B", "SKU", 300, 200, 150, 5)
        ));
        List<Pallet> pallets = algorithm.run(boxes, defaultSpec(), defaultConstraints());
        assertThat(pallets).isNotEmpty();
    }

    @Test
    void allSmallBoxesPlaced() {
        List<Box> boxes = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            boxes.add(box("B" + i, "SKU", 200, 200, 200, 3));
        }
        List<Pallet> pallets = algorithm.run(boxes, defaultSpec(), defaultConstraints());
        long placed = pallets.stream().flatMap(p -> p.getBoxes().stream())
                .filter(Box::isPlaced).count();
        assertThat(placed).isEqualTo(5);
    }

    @Test
    void resultIsCompetitiveWithFirstFit() {
        // GA should use at most as many pallets as FirstFit for a simple case
        FirstFitAlgorithm ff = new FirstFitAlgorithm();
        List<Box> boxes = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            boxes.add(box("B" + i, "SKU", 300, 250, 200, 5));
        }

        List<Box> gaBoxes = new ArrayList<>();
        boxes.forEach(b -> gaBoxes.add(new Box(b)));
        List<Box> ffBoxes = new ArrayList<>();
        boxes.forEach(b -> ffBoxes.add(new Box(b)));

        List<Pallet> gaPallets = algorithm.run(gaBoxes, defaultSpec(), defaultConstraints());
        List<Pallet> ffPallets = ff.run(ffBoxes, defaultSpec(), defaultConstraints());

        // GA should be competitive (within 1 extra pallet of FF)
        assertThat(gaPallets.size()).isLessThanOrEqualTo(ffPallets.size() + 1);
    }
}
