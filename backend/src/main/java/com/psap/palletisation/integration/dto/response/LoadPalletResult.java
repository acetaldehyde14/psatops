package com.psap.palletisation.integration.dto.response;

import java.util.List;

public class LoadPalletResult {
    private Integer palletNo;
    private String palletType;
    private Double cubePercent;
    private Double floorPercent;
    private Double totalWeightKg;
    private List<LoadBoxResult> boxes;

    public Integer getPalletNo() { return palletNo; }
    public void setPalletNo(Integer palletNo) { this.palletNo = palletNo; }
    public String getPalletType() { return palletType; }
    public void setPalletType(String palletType) { this.palletType = palletType; }
    public Double getCubePercent() { return cubePercent; }
    public void setCubePercent(Double cubePercent) { this.cubePercent = cubePercent; }
    public Double getFloorPercent() { return floorPercent; }
    public void setFloorPercent(Double floorPercent) { this.floorPercent = floorPercent; }
    public Double getTotalWeightKg() { return totalWeightKg; }
    public void setTotalWeightKg(Double totalWeightKg) { this.totalWeightKg = totalWeightKg; }
    public List<LoadBoxResult> getBoxes() { return boxes; }
    public void setBoxes(List<LoadBoxResult> boxes) { this.boxes = boxes; }
}
