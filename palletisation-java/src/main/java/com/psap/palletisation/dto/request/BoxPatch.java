package com.psap.palletisation.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;

public class BoxPatch {

    private String boxId;
    private double xMm;
    private double yMm;
    private double zMm;
    private double lengthMm;
    private double widthMm;
    private double heightMm;
    private String rotation = "LWH";
    private int layer = 1;
    private boolean standUprightOnly = false;
    private boolean noLoadOnTop = false;
    private boolean manualLocked = false;

    public String getBoxId() { return boxId; }
    public void setBoxId(String boxId) { this.boxId = boxId; }

    @JsonProperty("x_mm")
    public double getXMm() { return xMm; }
    @JsonProperty("x_mm")
    public void setXMm(double xMm) { this.xMm = xMm; }

    @JsonProperty("y_mm")
    public double getYMm() { return yMm; }
    @JsonProperty("y_mm")
    public void setYMm(double yMm) { this.yMm = yMm; }

    @JsonProperty("z_mm")
    public double getZMm() { return zMm; }
    @JsonProperty("z_mm")
    public void setZMm(double zMm) { this.zMm = zMm; }

    public double getLengthMm() { return lengthMm; }
    public void setLengthMm(double lengthMm) { this.lengthMm = lengthMm; }

    public double getWidthMm() { return widthMm; }
    public void setWidthMm(double widthMm) { this.widthMm = widthMm; }

    public double getHeightMm() { return heightMm; }
    public void setHeightMm(double heightMm) { this.heightMm = heightMm; }

    public String getRotation() { return rotation; }
    public void setRotation(String rotation) { this.rotation = rotation; }

    public int getLayer() { return layer; }
    public void setLayer(int layer) { this.layer = layer; }

    public boolean isStandUprightOnly() { return standUprightOnly; }
    public void setStandUprightOnly(boolean standUprightOnly) { this.standUprightOnly = standUprightOnly; }

    public boolean isNoLoadOnTop() { return noLoadOnTop; }
    public void setNoLoadOnTop(boolean noLoadOnTop) { this.noLoadOnTop = noLoadOnTop; }

    public boolean isManualLocked() { return manualLocked; }
    public void setManualLocked(boolean manualLocked) { this.manualLocked = manualLocked; }
}
