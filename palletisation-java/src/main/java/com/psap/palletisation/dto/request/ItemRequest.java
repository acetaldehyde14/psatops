package com.psap.palletisation.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.util.HashMap;
import java.util.Map;

public class ItemRequest {

    private String sku;
    private String niItemCode;
    private String descriptionOfGoods;
    private double quantity = 1;
    private Double totalQtyPcs;
    private Double qtyPerCtn;
    private double lengthMm;
    private double widthMm;
    private double heightMm;
    private double weightKg = 0;
    private boolean standUprightOnly = false;
    private boolean noLoadOnTop = false;
    private String noloadsontop;
    private String item;
    private String lotNo;
    private String palletId;
    private String description;
    private String categoryName;
    private String organisation;
    private String uom;
    private String requestedDeliveryDate;
    private String expiryDate;
    private String location;
    private String productManufacturingLocation;
    private String countryOfOrigin;
    private String lineId;
    private Integer sourceRow;
    private String store;
    private String dc;
    private String storeNo;
    private String dcNo;
    private String centerLabel;
    private Double centerExpectedCartons;

    // Extra fields captured during deserialization for flexible input
    private final Map<String, Object> extra = new HashMap<>();

    @JsonAnySetter
    public void setExtra(String key, Object value) {
        extra.put(key, value);
    }

    /** Resolve storeNo: prefer storeNo, fall back to store. */
    public String resolvedStoreNo() {
        return storeNo != null ? storeNo : store;
    }

    /** Resolve dcNo: prefer dcNo, fall back to dc. */
    public String resolvedDcNo() {
        return dcNo != null ? dcNo : dc;
    }

    /** Resolve description: prefer description, fall back to descriptionOfGoods. */
    public String resolvedDescription() {
        return description != null ? description : descriptionOfGoods;
    }

    /** Resolve no_load_on_top from either field or noloadsontop string. */
    public boolean resolvedNoLoadOnTop() {
        if (noloadsontop != null) {
            return parseBoolish(noloadsontop);
        }
        return noLoadOnTop;
    }

    private static boolean parseBoolish(String value) {
        if (value == null) return false;
        String s = value.strip().toLowerCase();
        return s.equals("true") || s.equals("yes") || s.equals("y") || s.equals("1") || s.equals("on");
    }

    // ── Getters and Setters ───────────────────────────────────────────────────

    public String getSku() { return sku; }
    public void setSku(String sku) {
        // If sku is blank but niItemCode is present, use niItemCode
        if ((sku == null || sku.isBlank()) && this.niItemCode != null) {
            this.sku = this.niItemCode;
        } else {
            this.sku = sku;
        }
    }

    public String getNiItemCode() { return niItemCode; }
    public void setNiItemCode(String niItemCode) {
        this.niItemCode = niItemCode;
        // If sku not yet set, use niItemCode as sku
        if (this.sku == null || this.sku.isBlank()) {
            this.sku = niItemCode;
        }
    }

    public String getDescriptionOfGoods() { return descriptionOfGoods; }
    public void setDescriptionOfGoods(String descriptionOfGoods) { this.descriptionOfGoods = descriptionOfGoods; }

    public double getQuantity() { return quantity; }
    public void setQuantity(double quantity) { this.quantity = quantity; }

    public Double getTotalQtyPcs() { return totalQtyPcs; }
    public void setTotalQtyPcs(Double totalQtyPcs) { this.totalQtyPcs = totalQtyPcs; }

    public Double getQtyPerCtn() { return qtyPerCtn; }
    public void setQtyPerCtn(Double qtyPerCtn) { this.qtyPerCtn = qtyPerCtn; }

    public double getLengthMm() { return lengthMm; }
    public void setLengthMm(double lengthMm) { this.lengthMm = lengthMm; }

    public double getWidthMm() { return widthMm; }
    public void setWidthMm(double widthMm) { this.widthMm = widthMm; }

    public double getHeightMm() { return heightMm; }
    public void setHeightMm(double heightMm) { this.heightMm = heightMm; }

    public double getWeightKg() { return weightKg; }
    public void setWeightKg(double weightKg) { this.weightKg = weightKg; }

    public boolean isStandUprightOnly() { return standUprightOnly; }
    public void setStandUprightOnly(boolean standUprightOnly) { this.standUprightOnly = standUprightOnly; }

    public boolean isNoLoadOnTop() { return noLoadOnTop; }
    public void setNoLoadOnTop(boolean noLoadOnTop) { this.noLoadOnTop = noLoadOnTop; }

    public String getNoloadsontop() { return noloadsontop; }
    public void setNoloadsontop(String noloadsontop) { this.noloadsontop = noloadsontop; }

    public String getItem() { return item; }
    public void setItem(String item) { this.item = item; }

    public String getLotNo() { return lotNo; }
    public void setLotNo(String lotNo) { this.lotNo = lotNo; }

    public String getPalletId() { return palletId; }
    public void setPalletId(String palletId) { this.palletId = palletId; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }

    public String getOrganisation() { return organisation; }
    public void setOrganisation(String organisation) { this.organisation = organisation; }

    public String getUom() { return uom; }
    public void setUom(String uom) { this.uom = uom; }

    public String getRequestedDeliveryDate() { return requestedDeliveryDate; }
    public void setRequestedDeliveryDate(String requestedDeliveryDate) { this.requestedDeliveryDate = requestedDeliveryDate; }

    public String getExpiryDate() { return expiryDate; }
    public void setExpiryDate(String expiryDate) { this.expiryDate = expiryDate; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getProductManufacturingLocation() { return productManufacturingLocation; }
    public void setProductManufacturingLocation(String productManufacturingLocation) { this.productManufacturingLocation = productManufacturingLocation; }

    public String getCountryOfOrigin() { return countryOfOrigin; }
    public void setCountryOfOrigin(String countryOfOrigin) { this.countryOfOrigin = countryOfOrigin; }

    public String getLineId() { return lineId; }
    public void setLineId(String lineId) { this.lineId = lineId; }

    public Integer getSourceRow() { return sourceRow; }
    public void setSourceRow(Integer sourceRow) { this.sourceRow = sourceRow; }

    public String getStore() { return store; }
    public void setStore(String store) {
        this.store = store;
        if (this.storeNo == null) this.storeNo = store;
    }

    public String getDc() { return dc; }
    public void setDc(String dc) {
        this.dc = dc;
        if (this.dcNo == null) this.dcNo = dc;
    }

    public String getStoreNo() { return storeNo; }
    public void setStoreNo(String storeNo) { this.storeNo = storeNo; }

    public String getDcNo() { return dcNo; }
    public void setDcNo(String dcNo) { this.dcNo = dcNo; }

    public String getCenterLabel() { return centerLabel; }
    public void setCenterLabel(String centerLabel) { this.centerLabel = centerLabel; }

    public Double getCenterExpectedCartons() { return centerExpectedCartons; }
    public void setCenterExpectedCartons(Double centerExpectedCartons) { this.centerExpectedCartons = centerExpectedCartons; }

    public Map<String, Object> getExtra() { return extra; }
}
