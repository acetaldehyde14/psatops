package com.psap.palletisation.algorithm.util;

import com.psap.palletisation.model.Box;
import com.psap.palletisation.model.Pallet;

import java.util.List;

public final class CgUtils {

    public static final double WARNING_OFFSET_FRACTION = 0.15;
    public static final double ERROR_OFFSET_FRACTION   = 0.30;

    private CgUtils() {}

    public static final class CgResult {
        public final double cgX;
        public final double cgY;
        public final double offsetX;
        public final double offsetY;
        public final double offsetFractionX;
        public final double offsetFractionY;
        public final String severity;

        public CgResult(double cgX, double cgY, double offsetX, double offsetY,
                        double offsetFractionX, double offsetFractionY, String severity) {
            this.cgX = cgX;
            this.cgY = cgY;
            this.offsetX = offsetX;
            this.offsetY = offsetY;
            this.offsetFractionX = offsetFractionX;
            this.offsetFractionY = offsetFractionY;
            this.severity = severity;
        }
    }

    public static CgResult computeCg(Pallet pallet) {
        return computeCg(pallet.getBoxes(), pallet.getLength(), pallet.getWidth());
    }

    public static CgResult computeCg(List<Box> boxes, double palletLength, double palletWidth) {
        if (boxes == null || boxes.isEmpty()) {
            double cx = palletLength / 2.0;
            double cy = palletWidth  / 2.0;
            return new CgResult(cx, cy, 0.0, 0.0, 0.0, 0.0, "ok");
        }

        double totalW = 0.0;
        for (Box b : boxes) totalW += b.getWeight();

        boolean useGeometric = (totalW == 0.0);
        if (useGeometric) totalW = 1.0;

        double cx = 0.0, cy = 0.0;
        for (Box b : boxes) {
            double w = useGeometric ? (1.0 / boxes.size()) : b.getWeight();
            cx += (b.getX() + b.getLength() / 2.0) * w;
            cy += (b.getY() + b.getWidth()  / 2.0) * w;
        }
        if (!useGeometric) {
            cx /= totalW;
            cy /= totalW;
        }

        double offsetX = cx - palletLength / 2.0;
        double offsetY = cy - palletWidth  / 2.0;
        double halfL = palletLength / 2.0;
        double halfW = palletWidth  / 2.0;
        double fractionX = (halfL == 0.0) ? 0.0 : Math.abs(offsetX) / halfL;
        double fractionY = (halfW == 0.0) ? 0.0 : Math.abs(offsetY) / halfW;
        String severity = classifySeverity(fractionX, fractionY);
        return new CgResult(cx, cy, offsetX, offsetY, fractionX, fractionY, severity);
    }

    public static String classifySeverity(double fractionX, double fractionY) {
        double max = Math.max(fractionX, fractionY);
        if (max <= WARNING_OFFSET_FRACTION) return "ok";
        if (max <= ERROR_OFFSET_FRACTION)   return "warning";
        return "error";
    }
}
