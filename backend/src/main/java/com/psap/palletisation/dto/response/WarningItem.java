package com.psap.palletisation.dto.response;

public class WarningItem {

    private String id;
    private String type;
    private String sku;
    private String message;
    private boolean dismissible = false;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public boolean isDismissible() { return dismissible; }
    public void setDismissible(boolean dismissible) { this.dismissible = dismissible; }
}
