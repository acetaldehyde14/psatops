package com.psap.palletisation.dto.response;

import java.util.ArrayList;
import java.util.List;

public class AlgorithmCompareEntry {

    private String algorithm;
    private int palletsUsed;
    private double averageVolumeUtilisationPct;
    private double averageAreaUtilisationPct;
    private double totalWeightKg;
    private int floatingBoxes;
    private int unstableBoxes;
    private List<Object> warnings = new ArrayList<>();
    private String jobId;

    public String getAlgorithm() { return algorithm; }
    public void setAlgorithm(String algorithm) { this.algorithm = algorithm; }

    public int getPalletsUsed() { return palletsUsed; }
    public void setPalletsUsed(int palletsUsed) { this.palletsUsed = palletsUsed; }

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

    public List<Object> getWarnings() { return warnings; }
    public void setWarnings(List<Object> warnings) { this.warnings = warnings; }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }
}
