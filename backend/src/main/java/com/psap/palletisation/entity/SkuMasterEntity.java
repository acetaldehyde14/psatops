package com.psap.palletisation.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "sku_master", uniqueConstraints = @UniqueConstraint(columnNames = {"org_id", "sku_id"}))
public class SkuMasterEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "org_id", nullable = false)
    private String orgId;

    @Column(name = "sku_id", nullable = false)
    private String skuId;

    @Column(name = "description")
    private String description;

    @Column(name = "length_mm")
    private Double lengthMm;

    @Column(name = "width_mm")
    private Double widthMm;

    @Column(name = "height_mm")
    private Double heightMm;

    @Column(name = "weight_kg")
    private Double weightKg;

    @Column(name = "allow_rotation")
    private Boolean allowRotation;

    @Column(name = "no_load_on_top")
    private Boolean noLoadOnTop;

    @Column(name = "stack_rule")
    private String stackRule;

    @Column(name = "location")
    private String location;

    @Column(name = "family")
    private String family;

    @Column(name = "label")
    private String label;

    @Column(name = "max_stack_weight_kg")
    private Double maxStackWeightKg;

    @Column(name = "max_stack_height_mm")
    private Double maxStackHeightMm;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    // Getters and setters for all fields
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
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
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
