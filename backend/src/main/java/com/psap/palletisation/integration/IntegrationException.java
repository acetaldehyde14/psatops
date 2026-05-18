package com.psap.palletisation.integration;

public class IntegrationException extends RuntimeException {
    private final int errorCode;
    private final String orderId;

    public IntegrationException(int errorCode, String message, String orderId) {
        super(message);
        this.errorCode = errorCode;
        this.orderId = orderId;
    }

    public int getErrorCode() { return errorCode; }
    public String getOrderId() { return orderId; }
}
