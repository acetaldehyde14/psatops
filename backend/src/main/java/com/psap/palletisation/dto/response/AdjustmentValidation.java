package com.psap.palletisation.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;

public class AdjustmentValidation {

    @JsonProperty("is_valid")
    private boolean isValid;

    private List<String> invalidBoxIds = new ArrayList<>();
    private List<StabilityIssue> issues = new ArrayList<>();
    private List<String> errors = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();

    public boolean getIsValid() { return isValid; }
    public void setIsValid(boolean isValid) { this.isValid = isValid; }

    public List<String> getInvalidBoxIds() { return invalidBoxIds; }
    public void setInvalidBoxIds(List<String> invalidBoxIds) { this.invalidBoxIds = invalidBoxIds; }

    public List<StabilityIssue> getIssues() { return issues; }
    public void setIssues(List<StabilityIssue> issues) { this.issues = issues; }

    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
}
