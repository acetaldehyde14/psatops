package com.psap.palletisation.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public class LayoutPatchResponse {

    private String jobId;
    private String status;
    private boolean manuallyAdjusted;
    private String adjustedAt;
    private String layoutSource = "manual_adjusted";
    private AdjustmentValidation validation;

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    @JsonProperty("manually_adjusted")
    public boolean isManuallyAdjusted() { return manuallyAdjusted; }
    public void setManuallyAdjusted(boolean manuallyAdjusted) { this.manuallyAdjusted = manuallyAdjusted; }

    public String getAdjustedAt() { return adjustedAt; }
    public void setAdjustedAt(String adjustedAt) { this.adjustedAt = adjustedAt; }

    public String getLayoutSource() { return layoutSource; }
    public void setLayoutSource(String layoutSource) { this.layoutSource = layoutSource; }

    public AdjustmentValidation getValidation() { return validation; }
    public void setValidation(AdjustmentValidation validation) { this.validation = validation; }
}
