package com.psap.palletisation.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "integration_result_box")
public class IntegrationResultBoxEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private String orderId;

    @Column(name = "pallet_no")
    private Integer palletNo;

    @Column(name = "pallet_type")
    private String palletType;

    @Column(name = "order_num")
    private String orderNum;

    @Column(name = "sku_id")
    private String skuId;

    @Column(name = "quantity")
    private Double quantity;

    @Column(name = "seq_num")
    private Integer seqNum;

    @Column(name = "x1") private Double x1;
    @Column(name = "y1") private Double y1;
    @Column(name = "z1") private Double z1;
    @Column(name = "x2") private Double x2;
    @Column(name = "y2") private Double y2;
    @Column(name = "z2") private Double z2;

    @Column(name = "rotation")
    private String rotation;

    @Column(name = "dim_vert")
    private Double dimVert;

    @Column(name = "stop")
    private String stop;

    @Column(name = "priority")
    private String priority;

    @Column(name = "unitized")
    private Boolean unitized;

    @Column(name = "org_id")
    private String orgId;

    @Column(name = "cube_percent")
    private Double cubePercent;

    @Column(name = "floor_percent")
    private Double floorPercent;

    @Column(name = "total_weight_kg")
    private Double totalWeightKg;

    // Getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public Integer getPalletNo() { return palletNo; }
    public void setPalletNo(Integer palletNo) { this.palletNo = palletNo; }
    public String getPalletType() { return palletType; }
    public void setPalletType(String palletType) { this.palletType = palletType; }
    public String getOrderNum() { return orderNum; }
    public void setOrderNum(String orderNum) { this.orderNum = orderNum; }
    public String getSkuId() { return skuId; }
    public void setSkuId(String skuId) { this.skuId = skuId; }
    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }
    public Integer getSeqNum() { return seqNum; }
    public void setSeqNum(Integer seqNum) { this.seqNum = seqNum; }
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
    public Double getCubePercent() { return cubePercent; }
    public void setCubePercent(Double cubePercent) { this.cubePercent = cubePercent; }
    public Double getFloorPercent() { return floorPercent; }
    public void setFloorPercent(Double floorPercent) { this.floorPercent = floorPercent; }
    public Double getTotalWeightKg() { return totalWeightKg; }
    public void setTotalWeightKg(Double totalWeightKg) { this.totalWeightKg = totalWeightKg; }
}
