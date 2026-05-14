package com.psap.palletisation.dto.response;

public class CenterTotal {

    private int inputLines = 0;
    private Double expectedCartons;
    private int expandedCartons = 0;
    private double quantitySumRaw = 0;

    public int getInputLines() { return inputLines; }
    public void setInputLines(int inputLines) { this.inputLines = inputLines; }

    public Double getExpectedCartons() { return expectedCartons; }
    public void setExpectedCartons(Double expectedCartons) { this.expectedCartons = expectedCartons; }

    public int getExpandedCartons() { return expandedCartons; }
    public void setExpandedCartons(int expandedCartons) { this.expandedCartons = expandedCartons; }

    public double getQuantitySumRaw() { return quantitySumRaw; }
    public void setQuantitySumRaw(double quantitySumRaw) { this.quantitySumRaw = quantitySumRaw; }
}
