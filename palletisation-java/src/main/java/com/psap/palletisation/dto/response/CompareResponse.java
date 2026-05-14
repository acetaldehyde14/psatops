package com.psap.palletisation.dto.response;

import java.util.ArrayList;
import java.util.List;

public class CompareResponse {

    private String orderId;
    private List<AlgorithmCompareEntry> results = new ArrayList<>();

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public List<AlgorithmCompareEntry> getResults() { return results; }
    public void setResults(List<AlgorithmCompareEntry> results) { this.results = results; }
}
