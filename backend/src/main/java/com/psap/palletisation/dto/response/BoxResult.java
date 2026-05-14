package com.psap.palletisation.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public class BoxResult {

    private String boxId;
    private String sku;
    private String niItemCode;
    private String descriptionOfGoods;
    private String lotNo;
    private String lineId;
    private Integer sourceRow;
    private String storeNo;
    private String dcNo;
    private String centerLabel;
    private Double centerExpectedCartons;
    private Double originalQuantity;
    private boolean partialCarton = false;
    private Integer cartonIndex;
    private double xMm;
    private double yMm;
    private double zMm;
    private double lengthMm;
    private double widthMm;
    private double heightMm;
    private double weightKg;
    private String rotation = "LWH";
    private Double baseAreaMm2;

    @JsonProperty("is_larger_base_orientation")
    private Boolean isLargerBaseOrientation;

    private int layer = 1;
    private int pickSequence = 1;
    private String location;
    private String expiryDate;
    private boolean standUprightOnly = false;
    private boolean noLoadOnTop = false;
    private Double originalHeightMm;

    public String getBoxId() { return boxId; }
    public void setBoxId(String boxId) { this.boxId = boxId; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getNiItemCode() { return niItemCode; }
    public void setNiItemCode(String niItemCode) { this.niItemCode = niItemCode; }

    public String getDescriptionOfGoods() { return descriptionOfGoods; }
    public void setDescriptionOfGoods(String descriptionOfGoods) { this.descriptionOfGoods = descriptionOfGoods; }

    public String getLotNo() { return lotNo; }
    public void setLotNo(String lotNo) { this.lotNo = lotNo; }

    public String getLineId() { return lineId; }
    public void setLineId(String lineId) { this.lineId = lineId; }

    public Integer getSourceRow() { return sourceRow; }
    public void setSourceRow(Integer sourceRow) { this.sourceRow = sourceRow; }

    public String getStoreNo() { return storeNo; }
    public void setStoreNo(String storeNo) { this.storeNo = storeNo; }

    public String getDcNo() { return dcNo; }
    public void setDcNo(String dcNo) { this.dcNo = dcNo; }

    public String getCenterLabel() { return centerLabel; }
    public void setCenterLabel(String centerLabel) { this.centerLabel = centerLabel; }

    public Double getCenterExpectedCartons() { return centerExpectedCartons; }
    public void setCenterExpectedCartons(Double centerExpectedCartons) { this.centerExpectedCartons = centerExpectedCartons; }

    public Double getOriginalQuantity() { return originalQuantity; }
    public void setOriginalQuantity(Double originalQuantity) { this.originalQuantity = originalQuantity; }

    public boolean isPartialCarton() { return partialCarton; }
    public void setPartialCarton(boolean partialCarton) { this.partialCarton = partialCarton; }

    public Integer getCartonIndex() { return cartonIndex; }
    public void setCartonIndex(Integer cartonIndex) { this.cartonIndex = cartonIndex; }

    @JsonProperty("x_mm")
    public double getXMm() { return xMm; }
    public void setXMm(double xMm) { this.xMm = xMm; }

    @JsonProperty("y_mm")
    public double getYMm() { return yMm; }
    public void setYMm(double yMm) { this.yMm = yMm; }

    @JsonProperty("z_mm")
    public double getZMm() { return zMm; }
    public void setZMm(double zMm) { this.zMm = zMm; }

    public double getLengthMm() { return lengthMm; }
    public void setLengthMm(double lengthMm) { this.lengthMm = lengthMm; }

    public double getWidthMm() { return widthMm; }
    public void setWidthMm(double widthMm) { this.widthMm = widthMm; }

    public double getHeightMm() { return heightMm; }
    public void setHeightMm(double heightMm) { this.heightMm = heightMm; }

    public double getWeightKg() { return weightKg; }
    public void setWeightKg(double weightKg) { this.weightKg = weightKg; }

    public String getRotation() { return rotation; }
    public void setRotation(String rotation) { this.rotation = rotation; }

    public Double getBaseAreaMm2() { return baseAreaMm2; }
    public void setBaseAreaMm2(Double baseAreaMm2) { this.baseAreaMm2 = baseAreaMm2; }

    public Boolean getIsLargerBaseOrientation() { return isLargerBaseOrientation; }
    public void setIsLargerBaseOrientation(Boolean isLargerBaseOrientation) { this.isLargerBaseOrientation = isLargerBaseOrientation; }

    public int getLayer() { return layer; }
    public void setLayer(int layer) { this.layer = layer; }

    public int getPickSequence() { return pickSequence; }
    public void setPickSequence(int pickSequence) { this.pickSequence = pickSequence; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getExpiryDate() { return expiryDate; }
    public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }

    public boolean isStandUprightOnly() { return standUprightOnly; }
    public void setStandUprightOnly(boolean standUprightOnly) { this.standUprightOnly = standUprightOnly; }

    public boolean isNoLoadOnTop() { return noLoadOnTop; }
    public void setNoLoadOnTop(boolean noLoadOnTop) { this.noLoadOnTop = noLoadOnTop; }

    public Double getOriginalHeightMm() { return originalHeightMm; }
    public void setOriginalHeightMm(Double originalHeightMm) { this.originalHeightMm = originalHeightMm; }
}
