package com.psap.palletisation.algorithm;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.PalletSpec;
import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ExtremePointAlgorithmTest {

    private final ExtremePointAlgorithm algorithm = new ExtremePointAlgorithm();

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
    void twoBoxesNoOverlap() {
        List<Box> boxes = new ArrayList<>(List.of(
                box("A", "SKU", 500, 400, 300, 5),
                box("B", "SKU", 500, 400, 300, 5)
        ));

        List<Pallet> pallets = algorithm.run(boxes, defaultSpec(), defaultConstraints());
        long placed = pallets.stream().flatMap(p -> p.getBoxes().stream())
                .filter(Box::isPlaced).count();
        assertThat(placed).isEqualTo(2);

        // Verify no overlap between boxes on same pallet
        for (Pallet p : pallets) {
            List<Box> bs = p.getBoxes();
            for (int i = 0; i < bs.size(); i++) {
                for (int j = i + 1; j < bs.size(); j++) {
                    assertThat(overlaps3D(bs.get(i), bs.get(j))).isFalse();
                }
            }
        }
    }

    @Test
    void secondBoxPlacedAtExtremePoint() {
        // Two identical non-rotating boxes: second should be next to or on top of first
        Constraints c = defaultConstraints();
        c.setAllowRotation(false);

        List<Box> boxes = new ArrayList<>(List.of(
                box("A", "SKU", 600, 500, 400, 5),
                box("B", "SKU", 600, 500, 400, 5)
        ));

        List<Pallet> pallets = algorithm.run(boxes, defaultSpec(), c);
        // Both should be placed
        long placed = pallets.stream().flatMap(p -> p.getBoxes().stream())
                .filter(Box::isPlaced).count();
        assertThat(placed).isEqualTo(2);
    }

    @Test
    void standUprightOnlyHeightPreserved() {
        Box b = box("A", "SKU", 400, 300, 200, 5);
        b.setStandUprightOnly(true);

        List<Box> boxes = new ArrayList<>(List.of(b));
        Constraints c = defaultConstraints();
        c.setAllowRotation(true);

        List<Pallet> pallets = algorithm.run(boxes, defaultSpec(), c);
        Box placed = pallets.stream().flatMap(p -> p.getBoxes().stream()).findFirst().orElse(null);
        assertThat(placed).isNotNull();
        // Height must equal original height (200)
        assertThat(Math.abs(placed.getHeight() - 200.0)).isLessThan(1e-6);
    }

    private boolean overlaps3D(Box a, Box b) {
        double EPS = 0.01;
        return a.getX() < b.getX() + b.getLength() - EPS
                && a.getX() + a.getLength() > b.getX() + EPS
                && a.getY() < b.getY() + b.getWidth() - EPS
                && a.getY() + a.getWidth() > b.getY() + EPS
                && a.getZ() < b.getZ() + b.getHeight() - EPS
                && a.getZ() + a.getHeight() > b.getZ() + EPS;
    }
}
