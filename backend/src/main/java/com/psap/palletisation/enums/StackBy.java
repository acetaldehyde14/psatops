package com.psap.palletisation.enums;

import com.fasterxml.jackson.annotation.JsonValue;

public enum StackBy {
    WEIGHT("weight"),
    VOLUME("volume"),
    HEIGHT("height");

    private final String value;

    StackBy(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }
}
