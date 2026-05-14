package com.psap.palletisation.dto.response;

public class JobStatus {

    private String jobId;
    private String status;
    private String createdAt;
    private String algorithmUsed;
    private String orderId;

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getAlgorithmUsed() { return algorithmUsed; }
    public void setAlgorithmUsed(String algorithmUsed) { this.algorithmUsed = algorithmUsed; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
}
