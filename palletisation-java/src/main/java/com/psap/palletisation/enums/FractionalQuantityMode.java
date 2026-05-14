package com.psap.palletisation.enums;

import com.fasterxml.jackson.annotation.JsonValue;

public enum FractionalQuantityMode {
    CEIL("ceil"),
    FLOOR("floor"),
    EXACT_ERROR("exact_error"),
    IGNORE_FRACTIONAL_ZERO("ignore_fractional_zero");

    private final String value;

    FractionalQuantityMode(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
