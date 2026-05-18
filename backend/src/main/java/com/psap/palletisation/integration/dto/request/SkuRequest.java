package com.psap.palletisation.integration.dto.request;

import jakarta.validation.constraints.NotBlank;

public class SkuRequest {
    @NotBlank
    private String skuId;
    private String description;
    private Double lengthMm;
    private Double widthMm;
    private Double heightMm;
    private Double weightKg;
    private Boolean allowRotation;
    private Boolean noLoadOnTop;
    private String stackRule;
    private String location;
    private String family;
    private String label;
    private Double maxStackWeightKg;
    private Double maxStackHeightMm;

    public String getSkuId() { return skuId; }
    public void setSkuId(String skuId) { this.skuId = skuId; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Double getLengthMm() { return lengthMm; }
    public void setLengthMm(Double lengthMm) { this.lengthMm = lengthMm; }
    public Double getWidthMm() { return widthMm; }
    public void setWidthMm(Double widthMm) { this.widthMm = widthMm; }
    public Double getHeightMm() { return heightMm; }
    public void setHeightMm(Double heightMm) { this.heightMm = heightMm; }
    public Double getWeightKg() { return weightKg; }
    public void setWeightKg(Double weightKg) { this.weightKg = weightKg; }
    public Boolean getAllowRotation() { return allowRotation; }
    public void setAllowRotation(Boolean allowRotation) { this.allowRotation = allowRotation; }
    public Boolean getNoLoadOnTop() { return noLoadOnTop; }
    public void setNoLoadOnTop(Boolean noLoadOnTop) { this.noLoadOnTop = noLoadOnTop; }
    public String getStackRule() { return stackRule; }
    public void setStackRule(String stackRule) { this.stackRule = stackRule; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getFamily() { return family; }
    public void setFamily(String family) { this.family = family; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Double getMaxStackWeightKg() { return maxStackWeightKg; }
    public void setMaxStackWeightKg(Double maxStackWeightKg) { this.maxStackWeightKg = maxStackWeightKg; }
    public Double getMaxStackHeightMm() { return maxStackHeightMm; }
    public void setMaxStackHeightMm(Double maxStackHeightMm) { this.maxStackHeightMm = maxStackHeightMm; }
}
