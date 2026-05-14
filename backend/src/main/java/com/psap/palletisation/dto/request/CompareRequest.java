package com.psap.palletisation.dto.request;

import com.psap.palletisation.enums.AlgorithmType;

import java.util.List;

public class CompareRequest {

    private String orderId = "";
    private List<AlgorithmType> algorithms = List.of(
            AlgorithmType.FIRST_FIT,
            AlgorithmType.BEST_FIT,
            AlgorithmType.EXTREME_POINT,
            AlgorithmType.GENETIC
    );
    private PalletSpec pallet = new PalletSpec();
    private Constraints constraints = new Constraints();
    private List<ItemRequest> items;

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId != null ? orderId : ""; }

    public List<AlgorithmType> getAlgorithms() { return algorithms; }
    public void setAlgorithms(List<AlgorithmType> algorithms) { this.algorithms = algorithms; }

    public PalletSpec getPallet() { return pallet; }
    public void setPallet(PalletSpec pallet) { this.pallet = pallet != null ? pallet : new PalletSpec(); }

    public Constraints getConstraints() { return constraints; }
    public void setConstraints(Constraints constraints) { this.constraints = constraints != null ? constraints : new Constraints(); }

    public List<ItemRequest> getItems() { return items; }
    public void setItems(List<ItemRequest> items) { this.items = items; }
}
