package com.psap.palletisation.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class StabilitySummary {

    @JsonProperty("is_stable")
    private boolean isStable;

    private List<StabilityIssue> issues = new ArrayList<>();

    public StabilitySummary() {}

    public StabilitySummary(boolean isStable) {
        this.isStable = isStable;
    }

    @JsonProperty("is_stable")
    public boolean getIsStable() { return isStable; }
    public void setIsStable(boolean isStable) { this.isStable = isStable; }

    public List<StabilityIssue> getIssues() { return issues; }
    public void setIssues(List<StabilityIssue> issues) { this.issues = issues; }
}
