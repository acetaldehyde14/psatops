package com.psap.palletisation.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.psap.palletisation.enums.FractionalQuantityMode;
import com.psap.palletisation.enums.StackBy;

public class Constraints {

    private boolean allowRotation = true;

    private FractionalQuantityMode fractionalQuantityMode = FractionalQuantityMode.CEIL;

    @JsonAlias({"no_stability_issues", "disallow_stability_issues"})
    private boolean doNotAllowStabilityIssues = true;

    @JsonAlias({"prefer_lay_flat", "lay_down_larger_base"})
    private boolean preferLargerBase = false;

    @JsonAlias({"respect_no_load_on_top", "no_load_on_top_constraint"})
    private boolean enforceNoLoadOnTop = true;

    private StackBy stackBy = StackBy.WEIGHT;
    private boolean mixProducts = true;
    private boolean respectFefo = true;
    private boolean respectDeliveryDate = false;
    private boolean preferPartialPallets = true;
    private boolean preferLocationCluster = true;
    private boolean cgAware = true;

    public boolean isAllowRotation() { return allowRotation; }
    public void setAllowRotation(boolean allowRotation) { this.allowRotation = allowRotation; }

    public FractionalQuantityMode getFractionalQuantityMode() { return fractionalQuantityMode; }
    public void setFractionalQuantityMode(FractionalQuantityMode fractionalQuantityMode) { this.fractionalQuantityMode = fractionalQuantityMode; }

    public boolean isDoNotAllowStabilityIssues() { return doNotAllowStabilityIssues; }
    public void setDoNotAllowStabilityIssues(boolean doNotAllowStabilityIssues) { this.doNotAllowStabilityIssues = doNotAllowStabilityIssues; }

    public boolean isPreferLargerBase() { return preferLargerBase; }
    public void setPreferLargerBase(boolean preferLargerBase) { this.preferLargerBase = preferLargerBase; }

    public boolean isEnforceNoLoadOnTop() { return enforceNoLoadOnTop; }
    public void setEnforceNoLoadOnTop(boolean enforceNoLoadOnTop) { this.enforceNoLoadOnTop = enforceNoLoadOnTop; }

    public StackBy getStackBy() { return stackBy; }
    public void setStackBy(StackBy stackBy) { this.stackBy = stackBy; }

    public boolean isMixProducts() { return mixProducts; }
    public void setMixProducts(boolean mixProducts) { this.mixProducts = mixProducts; }

    public boolean isRespectFefo() { return respectFefo; }
    public void setRespectFefo(boolean respectFefo) { this.respectFefo = respectFefo; }

    public boolean isRespectDeliveryDate() { return respectDeliveryDate; }
    public void setRespectDeliveryDate(boolean respectDeliveryDate) { this.respectDeliveryDate = respectDeliveryDate; }

    public boolean isPreferPartialPallets() { return preferPartialPallets; }
    public void setPreferPartialPallets(boolean preferPartialPallets) { this.preferPartialPallets = preferPartialPallets; }

    public boolean isPreferLocationCluster() { return preferLocationCluster; }
    public void setPreferLocationCluster(boolean preferLocationCluster) { this.preferLocationCluster = preferLocationCluster; }

    public boolean isCgAware() { return cgAware; }
    public void setCgAware(boolean cgAware) { this.cgAware = cgAware; }
}
