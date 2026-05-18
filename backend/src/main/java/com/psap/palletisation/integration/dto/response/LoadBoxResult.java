package com.psap.palletisation.integration.dto.response;

public class LoadBoxResult {
    private String orderNum;
    private String skuId;
    private Double quantity;
    private Integer seqNum;
    private Integer palletNo;
    private Double x1, y1, z1, x2, y2, z2;
    private String rotation;
    private Double dimVert;
    private String stop;
    private String priority;
    private Boolean unitized;
    private String orgId;

    public String getOrderNum() { return orderNum; }
    public void setOrderNum(String orderNum) { this.orderNum = orderNum; }
    public String getSkuId() { return skuId; }
    public void setSkuId(String skuId) { this.skuId = skuId; }
    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }
    public Integer getSeqNum() { return seqNum; }
    public void setSeqNum(Integer seqNum) { this.seqNum = seqNum; }
    public Integer getPalletNo() { return palletNo; }
    public void setPalletNo(Integer palletNo) { this.palletNo = palletNo; }
    public Double getX1() { return x1; }
    public void setX1(Double x1) { this.x1 = x1; }
    public Double getY1() { return y1; }
    public void setY1(Double y1) { this.y1 = y1; }
    public Double getZ1() { return z1; }
    public void setZ1(Double z1) { this.z1 = z1; }
    public Double getX2() { return x2; }
    public void setX2(Double x2) { this.x2 = x2; }
    public Double getY2() { return y2; }
    public void setY2(Double y2) { this.y2 = y2; }
    public Double getZ2() { return z2; }
    public void setZ2(Double z2) { this.z2 = z2; }
    public String getRotation() { return rotation; }
    public void setRotation(String rotation) { this.rotation = rotation; }
    public Double getDimVert() { return dimVert; }
    public void setDimVert(Double dimVert) { this.dimVert = dimVert; }
    public String getStop() { return stop; }
    public void setStop(String stop) { this.stop = stop; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public Boolean getUnitized() { return unitized; }
    public void setUnitized(Boolean unitized) { this.unitized = unitized; }
    public String getOrgId() { return orgId; }
    public void setOrgId(String orgId) { this.orgId = orgId; }
}
