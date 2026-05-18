package com.psap.palletisation.integration.dto.request;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.PalletSpec;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class OrderRequest {
    @NotBlank
    private String orderId;

    @NotBlank
    private String orgId;

    private String customerName;
    private String deliveryDate;

    @NotBlank
    private String transactionType;

    private String loadType;

    private PalletSpec pallet;
    private Constraints constraints;

    @NotNull
    private List<OrderSkuRequest> skuList;

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getDeliveryDate() { return deliveryDate; }
    public void setDeliveryDate(String deliveryDate) { this.deliveryDate = deliveryDate; }
    public String getTransactionType() { return transactionType; }
    public void setTransactionType(String transactionType) { this.transactionType = transactionType; }
    public String getLoadType() { return loadType; }
    public void setLoadType(String loadType) { this.loadType = loadType; }
    public PalletSpec getPallet() { return pallet; }
    public void setPallet(PalletSpec pallet) { this.pallet = pallet; }
    public Constraints getConstraints() { return constraints; }
    public void setConstraints(Constraints constraints) { this.constraints = constraints; }
    public List<OrderSkuRequest> getSkuList() { return skuList; }
    public void setSkuList(List<OrderSkuRequest> skuList) { this.skuList = skuList; }
}
