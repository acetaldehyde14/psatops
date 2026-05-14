package com.psap.palletisation.dto.request;

import java.util.List;

public class PalletPatch {

    private int palletNo;
    private List<BoxPatch> boxes;

    public int getPalletNo() { return palletNo; }
    public void setPalletNo(int palletNo) { this.palletNo = palletNo; }

    public List<BoxPatch> getBoxes() { return boxes; }
    public void setBoxes(List<BoxPatch> boxes) { this.boxes = boxes; }
}
