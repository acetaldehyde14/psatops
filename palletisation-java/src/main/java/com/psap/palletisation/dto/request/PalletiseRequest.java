package com.psap.palletisation.dto.request;

import com.psap.palletisation.enums.AlgorithmType;

import java.util.List;

public class PalletiseRequest {

    private String orderId = "";
    private AlgorithmType algorithm = AlgorithmType.EXTREME_POINT;
    private PalletSpec pallet = new PalletSpec();
    private Constraints constraints = new Constraints();
    private List<ItemRequest> items;

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId != null ? orderId : ""; }

    public AlgorithmType getAlgorithm() { return algorithm; }
    public void setAlgorithm(AlgorithmType algorithm) { this.algorithm = algorithm != null ? algorithm : AlgorithmType.EXTREME_POINT; }

    public PalletSpec getPallet() { return pallet; }
    public void setPallet(PalletSpec pallet) { this.pallet = pallet != null ? pallet : new PalletSpec(); }

    public Constraints getConstraints() { return constraints; }
    public void setConstraints(Constraints constraints) { this.constraints = constraints != null ? constraints : new Constraints(); }

    public List<ItemRequest> getItems() { return items; }
    public void setItems(List<ItemRequest> items) { this.items = items; }
}
