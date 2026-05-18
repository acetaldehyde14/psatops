package com.psap.palletisation.integration.dto.request;

import jakarta.validation.constraints.NotBlank;

public class OrderSkuRequest {
    @NotBlank
    private String skuId;
    private Double quantity;
    private String orderNum;
    private String priority;
    private String stop;
    private String customInfo1;
    private String customInfo2;

    public String getSkuId() { return skuId; }
    public void setSkuId(String skuId) { this.skuId = skuId; }
    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }
    public String getOrderNum() { return orderNum; }
    public void setOrderNum(String orderNum) { this.orderNum = orderNum; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getStop() { return stop; }
    public void setStop(String stop) { this.stop = stop; }
    public String getCustomInfo1() { return customInfo1; }
    public void setCustomInfo1(String customInfo1) { this.customInfo1 = customInfo1; }
    public String getCustomInfo2() { return customInfo2; }
    public void setCustomInfo2(String customInfo2) { this.customInfo2 = customInfo2; }
}
