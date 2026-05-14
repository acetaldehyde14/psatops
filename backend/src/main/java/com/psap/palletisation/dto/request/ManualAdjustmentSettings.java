package com.psap.palletisation.dto.request;

public class ManualAdjustmentSettings {

    private double edgeThresholdLengthMm = 0.0;
    private double edgeThresholdWidthMm = 0.0;
    private int snapGridMm = 50;
    private double dragSensitivity = 0.35;
    private double autoFitSearchRadiusMm = 150.0;
    private boolean doNotAllowStabilityIssues = true;
    private boolean preferLargerBase = false;
    private boolean enforceNoLoadOnTop = true;

    public double getEdgeThresholdLengthMm() { return edgeThresholdLengthMm; }
    public void setEdgeThresholdLengthMm(double edgeThresholdLengthMm) { this.edgeThresholdLengthMm = edgeThresholdLengthMm; }

    public double getEdgeThresholdWidthMm() { return edgeThresholdWidthMm; }
    public void setEdgeThresholdWidthMm(double edgeThresholdWidthMm) { this.edgeThresholdWidthMm = edgeThresholdWidthMm; }

    public int getSnapGridMm() { return snapGridMm; }
    public void setSnapGridMm(int snapGridMm) { this.snapGridMm = snapGridMm; }

    public double getDragSensitivity() { return dragSensitivity; }
    public void setDragSensitivity(double dragSensitivity) { this.dragSensitivity = dragSensitivity; }

    public double getAutoFitSearchRadiusMm() { return autoFitSearchRadiusMm; }
    public void setAutoFitSearchRadiusMm(double autoFitSearchRadiusMm) { this.autoFitSearchRadiusMm = autoFitSearchRadiusMm; }

    public boolean isDoNotAllowStabilityIssues() { return doNotAllowStabilityIssues; }
    public void setDoNotAllowStabilityIssues(boolean doNotAllowStabilityIssues) { this.doNotAllowStabilityIssues = doNotAllowStabilityIssues; }

    public boolean isPreferLargerBase() { return preferLargerBase; }
    public void setPreferLargerBase(boolean preferLargerBase) { this.preferLargerBase = preferLargerBase; }

    public boolean isEnforceNoLoadOnTop() { return enforceNoLoadOnTop; }
    public void setEnforceNoLoadOnTop(boolean enforceNoLoadOnTop) { this.enforceNoLoadOnTop = enforceNoLoadOnTop; }
}
