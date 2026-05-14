package com.psap.palletisation.dto.request;

import java.util.ArrayList;
import java.util.List;

public class LayoutPatchRequest {

    private List<PalletPatch> pallets = new ArrayList<>();
    private ManualAdjustmentSettings settings = new ManualAdjustmentSettings();

    public List<PalletPatch> getPallets() { return pallets; }
    public void setPallets(List<PalletPatch> pallets) { this.pallets = pallets != null ? pallets : new ArrayList<>(); }

    public ManualAdjustmentSettings getSettings() { return settings; }
    public void setSettings(ManualAdjustmentSettings settings) { this.settings = settings != null ? settings : new ManualAdjustmentSettings(); }
}
