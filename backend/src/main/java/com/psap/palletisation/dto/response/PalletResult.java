package com.psap.palletisation.dto.response;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PalletResult {

    private int palletNo;
    private double volumeUtilisationPct;
    private double areaUtilisationPct;
    private double weightKg;
    private int boxCount;
    private Map<String, Integer> skuTotals = new HashMap<>();
    private List<BoxResult> boxes = new ArrayList<>();

    private Double cgXMm;
    private Double cgYMm;
    private Double cgOffsetXMm;
    private Double cgOffsetYMm;
    private Double cgOffsetFractionX;
    private Double cgOffsetFractionY;
    private String cgSeverity;

    public int getPalletNo() { return palletNo; }
    public void setPalletNo(int palletNo) { this.palletNo = palletNo; }

    public double getVolumeUtilisationPct() { return volumeUtilisationPct; }
    public void setVolumeUtilisationPct(double volumeUtilisationPct) { this.volumeUtilisationPct = volumeUtilisationPct; }

    public double getAreaUtilisationPct() { return areaUtilisationPct; }
    public void setAreaUtilisationPct(double areaUtilisationPct) { this.areaUtilisationPct = areaUtilisationPct; }

    public double getWeightKg() { return weightKg; }
    public void setWeightKg(double weightKg) { this.weightKg = weightKg; }

    public int getBoxCount() { return boxCount; }
    public void setBoxCount(int boxCount) { this.boxCount = boxCount; }

    public Map<String, Integer> getSkuTotals() { return skuTotals; }
    public void setSkuTotals(Map<String, Integer> skuTotals) { this.skuTotals = skuTotals; }

    public List<BoxResult> getBoxes() { return boxes; }
    public void setBoxes(List<BoxResult> boxes) { this.boxes = boxes; }

    public Double getCgXMm() { return cgXMm; }
    public void setCgXMm(Double cgXMm) { this.cgXMm = cgXMm; }
    public Double getCgYMm() { return cgYMm; }
    public void setCgYMm(Double cgYMm) { this.cgYMm = cgYMm; }
    public Double getCgOffsetXMm() { return cgOffsetXMm; }
    public void setCgOffsetXMm(Double cgOffsetXMm) { this.cgOffsetXMm = cgOffsetXMm; }
    public Double getCgOffsetYMm() { return cgOffsetYMm; }
    public void setCgOffsetYMm(Double cgOffsetYMm) { this.cgOffsetYMm = cgOffsetYMm; }
    public Double getCgOffsetFractionX() { return cgOffsetFractionX; }
    public void setCgOffsetFractionX(Double cgOffsetFractionX) { this.cgOffsetFractionX = cgOffsetFractionX; }
    public Double getCgOffsetFractionY() { return cgOffsetFractionY; }
    public void setCgOffsetFractionY(Double cgOffsetFractionY) { this.cgOffsetFractionY = cgOffsetFractionY; }
    public String getCgSeverity() { return cgSeverity; }
    public void setCgSeverity(String cgSeverity) { this.cgSeverity = cgSeverity; }
}
