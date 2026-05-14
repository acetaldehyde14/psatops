package com.psap.palletisation.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {

    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of("message", "Palletisation Optimiser API", "docs", "/api/v1");
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "app", "Palletisation Optimiser", "version", "0.1.0");
    }
}
