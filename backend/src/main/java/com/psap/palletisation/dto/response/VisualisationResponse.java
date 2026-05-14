package com.psap.palletisation.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public class VisualisationResponse {

    private String jobId;
    private boolean manuallyAdjusted;
    private List<Map<String, Object>> pallets;

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    @JsonProperty("manually_adjusted")
    public boolean isManuallyAdjusted() { return manuallyAdjusted; }
    public void setManuallyAdjusted(boolean manuallyAdjusted) { this.manuallyAdjusted = manuallyAdjusted; }

    public List<Map<String, Object>> getPallets() { return pallets; }
    public void setPallets(List<Map<String, Object>> pallets) { this.pallets = pallets; }
}
