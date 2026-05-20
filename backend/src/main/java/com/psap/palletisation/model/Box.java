package com.psap.palletisation.model;

/**
 * Internal domain model for a single carton/box.
 * Mutable to allow in-place rotation and placement updates by algorithms.
 */
public class Box {

    // Identity
    private String boxId;
    private String sku;

    // Dimensions (mm) — mutated by algorithms on rotation
    private double length;
    private double width;
    private double height;
    private double weight; // kg

    // Original dimensions before any rotation
    private Double originalLength;
    private Double originalWidth;
    private Double originalHeight;

    // Metadata
    private String niItemCode;
    private String descriptionOfGoods;
    private String lotNo;
    private String lineId;
    private String storeNo;
    private String dcNo;
    private String centerLabel;
    private String location;
    private String expiryDate;
    private String requestedDeliveryDate;
    private Double centerExpectedCartons;
    private Double originalQuantity;
    private boolean partialCarton = false;
    private Integer cartonIndex;
    private Integer sourceRow;

    // Box constraints
    private boolean standUprightOnly = false;
    private boolean noLoadOnTop = false;
    private String stackability = "stackable";

    // Placement results
    private double x = 0.0;
    private double y = 0.0;
    private double z = 0.0;
    private String rotation = "LWH";
    private boolean placed = false;
    private int layer = 1;
    private int pickSequence = 0;

    public Box() {}

    /** Copy constructor — used by GeneticAlgorithm for deep copies. */
    public Box(Box other) {
        this.boxId = other.boxId;
        this.sku = other.sku;
        this.length = other.length;
        this.width = other.width;
        this.height = other.height;
        this.weight = other.weight;
        this.originalLength = other.originalLength;
        this.originalWidth = other.originalWidth;
        this.originalHeight = other.originalHeight;
        this.niItemCode = other.niItemCode;
        this.descriptionOfGoods = other.descriptionOfGoods;
        this.lotNo = other.lotNo;
        this.lineId = other.lineId;
        this.storeNo = other.storeNo;
        this.dcNo = other.dcNo;
        this.centerLabel = other.centerLabel;
        this.location = other.location;
        this.expiryDate = other.expiryDate;
        this.requestedDeliveryDate = other.requestedDeliveryDate;
        this.centerExpectedCartons = other.centerExpectedCartons;
        this.originalQuantity = other.originalQuantity;
        this.partialCarton = other.partialCarton;
        this.cartonIndex = other.cartonIndex;
        this.sourceRow = other.sourceRow;
        this.standUprightOnly = other.standUprightOnly;
        this.noLoadOnTop = other.noLoadOnTop;
        this.stackability = other.stackability;
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
        this.rotation = other.rotation;
        this.placed = other.placed;
        this.layer = other.layer;
        this.pickSequence = other.pickSequence;
    }

    public double getVolume() {
        return length * width * height;
    }

    // ── Getters and Setters ───────────────────────────────────────────────────

    public String getBoxId() { return boxId; }
    public void setBoxId(String boxId) { this.boxId = boxId; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public double getLength() { return length; }
    public void setLength(double length) { this.length = length; }

    public double getWidth() { return width; }
    public void setWidth(double width) { this.width = width; }

    public double getHeight() { return height; }
    public void setHeight(double height) { this.height = height; }

    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = weight; }

    public Double getOriginalLength() { return originalLength; }
    public void setOriginalLength(Double originalLength) { this.originalLength = originalLength; }

    public Double getOriginalWidth() { return originalWidth; }
    public void setOriginalWidth(Double originalWidth) { this.originalWidth = originalWidth; }

    public Double getOriginalHeight() { return originalHeight; }
    public void setOriginalHeight(Double originalHeight) { this.originalHeight = originalHeight; }

    public String getNiItemCode() { return niItemCode; }
    public void setNiItemCode(String niItemCode) { this.niItemCode = niItemCode; }

    public String getDescriptionOfGoods() { return descriptionOfGoods; }
    public void setDescriptionOfGoods(String descriptionOfGoods) { this.descriptionOfGoods = descriptionOfGoods; }

    public String getLotNo() { return lotNo; }
    public void setLotNo(String lotNo) { this.lotNo = lotNo; }

    public String getLineId() { return lineId; }
    public void setLineId(String lineId) { this.lineId = lineId; }

    public String getStoreNo() { return storeNo; }
    public void setStoreNo(String storeNo) { this.storeNo = storeNo; }

    public String getDcNo() { return dcNo; }
    public void setDcNo(String dcNo) { this.dcNo = dcNo; }

    public String getCenterLabel() { return centerLabel; }
    public void setCenterLabel(String centerLabel) { this.centerLabel = centerLabel; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getExpiryDate() { return expiryDate; }
    public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }

    public String getRequestedDeliveryDate() { return requestedDeliveryDate; }
    public void setRequestedDeliveryDate(String requestedDeliveryDate) { this.requestedDeliveryDate = requestedDeliveryDate; }

    public Double getCenterExpectedCartons() { return centerExpectedCartons; }
    public void setCenterExpectedCartons(Double centerExpectedCartons) { this.centerExpectedCartons = centerExpectedCartons; }

    public Double getOriginalQuantity() { return originalQuantity; }
    public void setOriginalQuantity(Double originalQuantity) { this.originalQuantity = originalQuantity; }

    public boolean isPartialCarton() { return partialCarton; }
    public void setPartialCarton(boolean partialCarton) { this.partialCarton = partialCarton; }

    public Integer getCartonIndex() { return cartonIndex; }
    public void setCartonIndex(Integer cartonIndex) { this.cartonIndex = cartonIndex; }

    public Integer getSourceRow() { return sourceRow; }
    public void setSourceRow(Integer sourceRow) { this.sourceRow = sourceRow; }

    public boolean isStandUprightOnly() { return standUprightOnly; }
    public void setStandUprightOnly(boolean standUprightOnly) { this.standUprightOnly = standUprightOnly; }

    public boolean isNoLoadOnTop() { return noLoadOnTop; }
    public void setNoLoadOnTop(boolean noLoadOnTop) { this.noLoadOnTop = noLoadOnTop; }

    public String getStackability() { return stackability; }
    public void setStackability(String stackability) { this.stackability = stackability; }

    public double getX() { return x; }
    public void setX(double x) { this.x = x; }

    public double getY() { return y; }
    public void setY(double y) { this.y = y; }

    public double getZ() { return z; }
    public void setZ(double z) { this.z = z; }

    public String getRotation() { return rotation; }
    public void setRotation(String rotation) { this.rotation = rotation; }

    public boolean isPlaced() { return placed; }
    public void setPlaced(boolean placed) { this.placed = placed; }

    public int getLayer() { return layer; }
    public void setLayer(int layer) { this.layer = layer; }

    public int getPickSequence() { return pickSequence; }
    public void setPickSequence(int pickSequence) { this.pickSequence = pickSequence; }
}
