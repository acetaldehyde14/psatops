package com.psap.palletisation.dto.response;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SummaryResult {

    private int palletsUsed;
    private int totalBoxes;
    private double averageVolumeUtilisationPct;
    private double averageAreaUtilisationPct;
    private double totalWeightKg;
    private int floatingBoxes;
    private int unstableBoxes;
    private List<StabilityIssue> stabilityIssues = new ArrayList<>();
    private Map<String, Integer> skuTotals = new HashMap<>();
    private int requestTotalBoxes = 0;
    private Map<String, Integer> requestSkuTotals = new HashMap<>();
    private Map<String, CenterTotal> centerTotals = new HashMap<>();
    private List<Object> warnings = new ArrayList<>();

    public int getPalletsUsed() { return palletsUsed; }
    public void setPalletsUsed(int palletsUsed) { this.palletsUsed = palletsUsed; }

    public int getTotalBoxes() { return totalBoxes; }
    public void setTotalBoxes(int totalBoxes) { this.totalBoxes = totalBoxes; }

    public double getAverageVolumeUtilisationPct() { return averageVolumeUtilisationPct; }
    public void setAverageVolumeUtilisationPct(double averageVolumeUtilisationPct) { this.averageVolumeUtilisationPct = averageVolumeUtilisationPct; }

    public double getAverageAreaUtilisationPct() { return averageAreaUtilisationPct; }
    public void setAverageAreaUtilisationPct(double averageAreaUtilisationPct) { this.averageAreaUtilisationPct = averageAreaUtilisationPct; }

    public double getTotalWeightKg() { return totalWeightKg; }
    public void setTotalWeightKg(double totalWeightKg) { this.totalWeightKg = totalWeightKg; }

    public int getFloatingBoxes() { return floatingBoxes; }
    public void setFloatingBoxes(int floatingBoxes) { this.floatingBoxes = floatingBoxes; }

    public int getUnstableBoxes() { return unstableBoxes; }
    public void setUnstableBoxes(int unstableBoxes) { this.unstableBoxes = unstableBoxes; }

    public List<StabilityIssue> getStabilityIssues() { return stabilityIssues; }
    public void setStabilityIssues(List<StabilityIssue> stabilityIssues) { this.stabilityIssues = stabilityIssues; }

    public Map<String, Integer> getSkuTotals() { return skuTotals; }
    public void setSkuTotals(Map<String, Integer> skuTotals) { this.skuTotals = skuTotals; }

    public int getRequestTotalBoxes() { return requestTotalBoxes; }
    public void setRequestTotalBoxes(int requestTotalBoxes) { this.requestTotalBoxes = requestTotalBoxes; }

    public Map<String, Integer> getRequestSkuTotals() { return requestSkuTotals; }
    public void setRequestSkuTotals(Map<String, Integer> requestSkuTotals) { this.requestSkuTotals = requestSkuTotals; }

    public Map<String, CenterTotal> getCenterTotals() { return centerTotals; }
    public void setCenterTotals(Map<String, CenterTotal> centerTotals) { this.centerTotals = centerTotals; }

    public List<Object> getWarnings() { return warnings; }
    public void setWarnings(List<Object> warnings) { this.warnings = warnings; }
}
