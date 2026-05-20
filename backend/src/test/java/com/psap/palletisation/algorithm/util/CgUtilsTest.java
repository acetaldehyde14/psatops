package com.psap.palletisation.algorithm.util;

import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class CgUtilsTest {

    private Box box(double x, double y, double l, double w, double wt) {
        Box b = new Box();
        b.setX(x); b.setY(y); b.setZ(0);
        b.setLength(l); b.setWidth(w); b.setHeight(100);
        b.setWeight(wt);
        return b;
    }

    private Pallet pallet(double l, double w, List<Box> boxes) {
        Pallet p = new Pallet();
        p.setLength(l);
        p.setWidth(w);
        p.setMaxHeight(2000);
        p.setMaxWeight(1000);
        boxes.forEach(b -> p.getBoxes().add(b));
        return p;
    }

    @Test
    void symmetricPlacement_zeroCgOffset() {
        // Two equal boxes placed symmetrically on 1200x1100 pallet (full width, split in X)
        Box b1 = box(0,   0, 600, 1100, 10);
        Box b2 = box(600, 0, 600, 1100, 10);
        CgUtils.CgResult result = CgUtils.computeCg(List.of(b1, b2), 1200, 1100);
        assertThat(result.cgX).isCloseTo(600.0, within(1.0));
        assertThat(result.cgY).isCloseTo(550.0, within(1.0));
        assertThat(result.offsetFractionX).isCloseTo(0.0, within(0.01));
        assertThat(result.offsetFractionY).isCloseTo(0.0, within(0.01));
        assertThat(result.severity).isEqualTo("ok");
    }

    @Test
    void singleBoxInCorner_largeOffset_error() {
        // Single heavy box at far corner
        Box b = box(0, 0, 100, 100, 50);
        CgUtils.CgResult result = CgUtils.computeCg(List.of(b), 1200, 1100);
        assertThat(result.severity).isEqualTo("error");
        assertThat(result.offsetFractionX).isGreaterThan(CgUtils.ERROR_OFFSET_FRACTION);
    }

    @Test
    void allWeightless_fallsBackToGeometric_noException() {
        // Weightless boxes covering full pallet symmetrically — geometric centroid should be at centre
        Box b1 = box(0,   0, 600, 1100, 0);
        Box b2 = box(600, 0, 600, 1100, 0);
        CgUtils.CgResult result = CgUtils.computeCg(List.of(b1, b2), 1200, 1100);
        assertThat(result).isNotNull();
        assertThat(result.severity).isEqualTo("ok");
    }

    @Test
    void classifySeverity_ok() {
        assertThat(CgUtils.classifySeverity(0.10, 0.10)).isEqualTo("ok");
    }

    @Test
    void classifySeverity_warning() {
        assertThat(CgUtils.classifySeverity(0.20, 0.05)).isEqualTo("warning");
    }

    @Test
    void classifySeverity_error() {
        assertThat(CgUtils.classifySeverity(0.40, 0.05)).isEqualTo("error");
    }

    @Test
    void emptyBoxList_returnsOkAtCentre() {
        CgUtils.CgResult result = CgUtils.computeCg(List.of(), 1200, 1100);
        assertThat(result.severity).isEqualTo("ok");
        assertThat(result.cgX).isCloseTo(600.0, within(0.01));
        assertThat(result.cgY).isCloseTo(550.0, within(0.01));
    }
}
