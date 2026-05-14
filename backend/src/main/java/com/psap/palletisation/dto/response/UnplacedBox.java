package com.psap.palletisation.dto.response;

public class UnplacedBox {

    private String boxId;
    private String sku;
    private String reason;

    public String getBoxId() { return boxId; }
    public void setBoxId(String boxId) { this.boxId = boxId; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
