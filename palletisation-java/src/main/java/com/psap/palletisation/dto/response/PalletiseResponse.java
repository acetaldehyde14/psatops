package com.psap.palletisation.dto.response;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PalletiseResponse {

    private String jobId;
    private String orderId;
    private String status;
    private String algorithmUsed;
    private SummaryResult summary;
    private List<PalletResult> pallets = new ArrayList<>();
    private Map<String, Object> constraintsUsed = new HashMap<>();
    private StabilitySummary stability = new StabilitySummary(true);
    private List<UnplacedBox> unplacedBoxes = new ArrayList<>();

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getAlgorithmUsed() { return algorithmUsed; }
    public void setAlgorithmUsed(String algorithmUsed) { this.algorithmUsed = algorithmUsed; }

    public SummaryResult getSummary() { return summary; }
    public void setSummary(SummaryResult summary) { this.summary = summary; }

    public List<PalletResult> getPallets() { return pallets; }
    public void setPallets(List<PalletResult> pallets) { this.pallets = pallets; }

    public Map<String, Object> getConstraintsUsed() { return constraintsUsed; }
    public void setConstraintsUsed(Map<String, Object> constraintsUsed) { this.constraintsUsed = constraintsUsed; }

    public StabilitySummary getStability() { return stability; }
    public void setStability(StabilitySummary stability) { this.stability = stability; }

    public List<UnplacedBox> getUnplacedBoxes() { return unplacedBoxes; }
    public void setUnplacedBoxes(List<UnplacedBox> unplacedBoxes) { this.unplacedBoxes = unplacedBoxes; }
}
