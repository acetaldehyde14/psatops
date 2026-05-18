package com.psap.palletisation.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "integration_order")
public class IntegrationOrderEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false, unique = true)
    private String orderId;

    @Column(name = "org_id", nullable = false)
    private String orgId;

    @Column(name = "customer_name")
    private String customerName;

    @Column(name = "delivery_date")
    private String deliveryDate;

    @Column(name = "load_type")
    private String loadType;

    @Column(name = "pallet_spec_json", columnDefinition = "TEXT")
    private String palletSpecJson;

    @Column(name = "constraints_json", columnDefinition = "TEXT")
    private String constraintsJson;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "job_id")
    private String jobId;

    @Column(name = "error_code")
    private Integer errorCode;

    @Column(name = "error_description", columnDefinition = "TEXT")
    private String errorDescription;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getDeliveryDate() { return deliveryDate; }
    public void setDeliveryDate(String deliveryDate) { this.deliveryDate = deliveryDate; }
    public String getLoadType() { return loadType; }
    public void setLoadType(String loadType) { this.loadType = loadType; }
    public String getPalletSpecJson() { return palletSpecJson; }
    public void setPalletSpecJson(String palletSpecJson) { this.palletSpecJson = palletSpecJson; }
    public String getConstraintsJson() { return constraintsJson; }
    public void setConstraintsJson(String constraintsJson) { this.constraintsJson = constraintsJson; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }
    public Integer getErrorCode() { return errorCode; }
    public void setErrorCode(Integer errorCode) { this.errorCode = errorCode; }
    public String getErrorDescription() { return errorDescription; }
    public void setErrorDescription(String errorDescription) { this.errorDescription = errorDescription; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
