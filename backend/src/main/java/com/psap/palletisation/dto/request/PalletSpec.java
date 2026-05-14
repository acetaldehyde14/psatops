package com.psap.palletisation.dto.request;

import jakarta.validation.constraints.Positive;

public class PalletSpec {

    @Positive
    private double lengthMm = 1200;

    @Positive
    private double widthMm = 1100;

    @Positive
    private double maxHeightMm = 1150;

    @Positive
    private double maxWeightKg = 1500;

    public double getLengthMm() { return lengthMm; }
    public void setLengthMm(double lengthMm) { this.lengthMm = lengthMm; }

    public double getWidthMm() { return widthMm; }
    public void setWidthMm(double widthMm) { this.widthMm = widthMm; }

    public double getMaxHeightMm() { return maxHeightMm; }
    public void setMaxHeightMm(double maxHeightMm) { this.maxHeightMm = maxHeightMm; }

    public double getMaxWeightKg() { return maxWeightKg; }
    public void setMaxWeightKg(double maxWeightKg) { this.maxWeightKg = maxWeightKg; }
}
