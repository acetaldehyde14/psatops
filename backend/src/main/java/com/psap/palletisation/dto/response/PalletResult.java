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
}
