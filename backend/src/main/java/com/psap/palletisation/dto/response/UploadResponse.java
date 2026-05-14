package com.psap.palletisation.dto.response;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class UploadResponse {

    private String filename;
    private int rowsParsed;
    private List<Map<String, Object>> items = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();

    public String getFilename() { return filename; }
    public void setFilename(String filename) { this.filename = filename; }

    public int getRowsParsed() { return rowsParsed; }
    public void setRowsParsed(int rowsParsed) { this.rowsParsed = rowsParsed; }

    public List<Map<String, Object>> getItems() { return items; }
    public void setItems(List<Map<String, Object>> items) { this.items = items; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
}
