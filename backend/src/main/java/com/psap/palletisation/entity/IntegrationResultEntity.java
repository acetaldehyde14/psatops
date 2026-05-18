package com.psap.palletisation.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "integration_result")
public class IntegrationResultEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false, unique = true)
    private String orderId;

    @Column(name = "job_id")
    private String jobId;

    @Column(name = "load_count")
    private Integer loadCount;

    @Column(name = "cut_count")
    private Integer cutCount;

    @Column(name = "cube_percent")
    private Double cubePercent;

    @Column(name = "floor_percent")
    private Double floorPercent;

    @Column(name = "pallet_count")
    private Integer palletCount;

    @Column(name = "total_weight_kg")
    private Double totalWeightKg;

    @Column(name = "status")
    private String status;

    @Column(name = "error_code")
    private Integer errorCode;

    @Column(name = "error_description", columnDefinition = "TEXT")
    private String errorDescription;

    @Column(name = "created_at")
    private Instant createdAt;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }
    public Integer getLoadCount() { return loadCount; }
    public void setLoadCount(Integer loadCount) { this.loadCount = loadCount; }
    public Integer getCutCount() { return cutCount; }
    public void setCutCount(Integer cutCount) { this.cutCount = cutCount; }
    public Double getCubePercent() { return cubePercent; }
    public void setCubePercent(Double cubePercent) { this.cubePercent = cubePercent; }
    public Double getFloorPercent() { return floorPercent; }
    public void setFloorPercent(Double floorPercent) { this.floorPercent = floorPercent; }
    public Integer getPalletCount() { return palletCount; }
    public void setPalletCount(Integer palletCount) { this.palletCount = palletCount; }
    public Double getTotalWeightKg() { return totalWeightKg; }
    public void setTotalWeightKg(Double totalWeightKg) { this.totalWeightKg = totalWeightKg; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getErrorCode() { return errorCode; }
    public void setErrorCode(Integer errorCode) { this.errorCode = errorCode; }
    public String getErrorDescription() { return errorDescription; }
    public void setErrorDescription(String errorDescription) { this.errorDescription = errorDescription; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
