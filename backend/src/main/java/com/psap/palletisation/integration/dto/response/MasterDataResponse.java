package com.psap.palletisation.integration.dto.response;

public class MasterDataResponse {
    private String orgId;
    private String transactionType;
    private Integer skusProcessed;
    private String message;

    public MasterDataResponse(String orgId, String transactionType, Integer skusProcessed, String message) {
        this.orgId = orgId;
        this.transactionType = transactionType;
        this.skusProcessed = skusProcessed;
        this.message = message;
    }

    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
    public String getTransactionType() { return transactionType; }
    public void setTransactionType(String transactionType) { this.transactionType = transactionType; }
    public Integer getSkusProcessed() { return skusProcessed; }
    public void setSkusProcessed(Integer skusProcessed) { this.skusProcessed = skusProcessed; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
