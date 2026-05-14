package com.psap.palletisation.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Internal domain model for a pallet (bin).
 */
public class Pallet {

    private double length;  // mm
    private double width;   // mm
    private double maxHeight; // mm
    private double maxWeight; // kg
    private int palletNo = 1;
    private List<Box> boxes = new ArrayList<>();

    public Pallet() {}

    public Pallet(double length, double width, double maxHeight, double maxWeight, int palletNo) {
        this.length = length;
        this.width = width;
        this.maxHeight = maxHeight;
        this.maxWeight = maxWeight;
        this.palletNo = palletNo;
    }

    public double getVolumeCapacity() {
        return length * width * maxHeight;
    }

    public double getFootprintArea() {
        return length * width;
    }

    public double getUsedVolume() {
        return boxes.stream().mapToDouble(Box::getVolume).sum();
    }

    public double getUsedWeight() {
        return boxes.stream().mapToDouble(Box::getWeight).sum();
    }

    public double getCurrentHeight() {
        return boxes.stream()
                .mapToDouble(b -> b.getZ() + b.getHeight())
                .max()
                .orElse(0.0);
    }

    // ── Getters and Setters ───────────────────────────────────────────────────

    public double getLength() { return length; }
    public void setLength(double length) { this.length = length; }

    public double getWidth() { return width; }
    public void setWidth(double width) { this.width = width; }

    public double getMaxHeight() { return maxHeight; }
    public void setMaxHeight(double maxHeight) { this.maxHeight = maxHeight; }

    public double getMaxWeight() { return maxWeight; }
    public void setMaxWeight(double maxWeight) { this.maxWeight = maxWeight; }

    public int getPalletNo() { return palletNo; }
    public void setPalletNo(int palletNo) { this.palletNo = palletNo; }

    public List<Box> getBoxes() { return boxes; }
    public void setBoxes(List<Box> boxes) { this.boxes = boxes; }
}
