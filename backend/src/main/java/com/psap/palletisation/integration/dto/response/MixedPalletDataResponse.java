package com.psap.palletisation.integration.dto.response;

import java.util.List;

public class MixedPalletDataResponse {
    private String orderId;
    private Integer loadCount;
    private Integer cutCount;
    private Double cubePercent;
    private Double floorPercent;
    private Integer palletCount;
    private Double totalWeightKg;
    private String status;
    private Integer errorCode;
    private String errorDescription;
    private List<LoadPalletResult> pallets;

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public Integer getLoadCount() { return loadCount; }
    public void setLoadCount(Integer loadCount) { this.loadCount = loadCount; }
    public Integer getCutCount() { return cutCount; }
    public void setCutCount(Integer cutCount) { this.cutCount = cutCount; }
    public Double getCubePercent() { return cubePercent; }
    public void setCubePercent(Double cubePercent) { this.cubePercent = cubePercent; }
    public Double getFloorPercent() { return floorPercent; }
    public void setFloorPercent(Double floorPercent) { this.floorPercent = floorPercent; }
    public Integer getPalletCount() { return palletCount; }
    public void setPalletCount(Integer palletCount) { this.palletCount = palletCount; }
    public Double getTotalWeightKg() { return totalWeightKg; }
    public void setTotalWeightKg(Double totalWeightKg) { this.totalWeightKg = totalWeightKg; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getErrorCode() { return errorCode; }
    public void setErrorCode(Integer errorCode) { this.errorCode = errorCode; }
    public String getErrorDescription() { return errorDescription; }
    public void setErrorDescription(String errorDescription) { this.errorDescription = errorDescription; }
    public List<LoadPalletResult> getPallets() { return pallets; }
    public void setPallets(List<LoadPalletResult> pallets) { this.pallets = pallets; }
}
