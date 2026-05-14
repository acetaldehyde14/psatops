package com.psap.palletisation.dto.response;

public class StabilityIssue {

    private String type;
    private String severity = "warning";
    private String boxId;
    private Integer palletNo;
    private String sku;
    private String message;

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getBoxId() { return boxId; }
    public void setBoxId(String boxId) { this.boxId = boxId; }

    public Integer getPalletNo() { return palletNo; }
    public void setPalletNo(Integer palletNo) { this.palletNo = palletNo; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}
