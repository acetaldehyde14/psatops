package com.psap.palletisation.integration.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class MasterDataRequest {
    @NotBlank
    private String orgId;

    @NotBlank
    private String transactionType;

    @NotNull
    private List<SkuRequest> skuList;

    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
    public String getTransactionType() { return transactionType; }
    public void setTransactionType(String transactionType) { this.transactionType = transactionType; }
    public List<SkuRequest> getSkuList() { return skuList; }
    public void setSkuList(List<SkuRequest> skuList) { this.skuList = skuList; }
}
