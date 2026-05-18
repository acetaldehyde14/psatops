package com.psap.palletisation.integration.dto.response;

public class IntegrationErrorResponse {
    private Integer errorCode;
    private String errorDescription;
    private String orderId;

    public IntegrationErrorResponse(Integer errorCode, String errorDescription, String orderId) {
        this.errorCode = errorCode;
        this.errorDescription = errorDescription;
        this.orderId = orderId;
    }

    public Integer getErrorCode() { return errorCode; }
    public void setErrorCode(Integer errorCode) { this.errorCode = errorCode; }
    public String getErrorDescription() { return errorDescription; }
    public void setErrorDescription(String errorDescription) { this.errorDescription = errorDescription; }
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
}
