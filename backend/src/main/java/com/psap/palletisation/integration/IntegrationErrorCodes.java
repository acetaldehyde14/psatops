package com.psap.palletisation.integration;

public final class IntegrationErrorCodes {
    private IntegrationErrorCodes() {}

    public static final int ORDER_NOT_FOUND = 1001;
    public static final int ORDER_ALREADY_EXISTS = 1002;
    public static final int INVALID_SKU = 1003;
    public static final int SKU_NOT_IN_MASTER_DATA = 1004;
    public static final int INVALID_ORDER_STATUS = 1005;
    public static final int OPTIMISATION_FAILED = 1006;
    public static final int RESULT_NOT_AVAILABLE = 1007;
    public static final int INVALID_REQUEST = 1008;
    public static final int UNAUTHORISED = 1009;
}
