package com.psap.palletisation.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.psap.palletisation.algorithm.OptimiserService;
import com.psap.palletisation.dto.request.*;
import com.psap.palletisation.dto.response.*;
import com.psap.palletisation.enums.AlgorithmType;
import com.psap.palletisation.service.JobStoreService;
import com.psap.palletisation.service.ValidationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class PalletiseController {

    private final OptimiserService optimiser;
    private final JobStoreService jobStore;
    private final ValidationService validation;
    private final ObjectMapper objectMapper;

    public PalletiseController(OptimiserService optimiser, JobStoreService jobStore,
                                ValidationService validation, ObjectMapper objectMapper) {
        this.optimiser = optimiser;
        this.jobStore = jobStore;
        this.validation = validation;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/palletise")
    public ResponseEntity<PalletiseResponse> palletise(@RequestBody JsonNode body) {
        PalletiseRequest req = normalisePalletiseBody(body);
        return runAndRespond(req);
    }

    @PostMapping("/palletise/raw-items")
    public ResponseEntity<PalletiseResponse> palletiseRaw(@RequestBody List<Map<String, Object>> items) {
        PalletiseRequest req = defaultRequestFromRawItems(items);
        return runAndRespond(req);
    }

    @PostMapping("/palletise/compare")
    public ResponseEntity<CompareResponse> compare(@RequestBody CompareRequest req) {
        if (req.getItems() == null || req.getItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No order items provided.");
        }

        List<AlgorithmCompareEntry> results = new ArrayList<>();
        for (AlgorithmType algo : req.getAlgorithms()) {
            PalletiseRequest single = new PalletiseRequest();
            single.setOrderId(req.getOrderId());
            single.setAlgorithm(algo);
            single.setPallet(req.getPallet());
            single.setConstraints(req.getConstraints());
            single.setItems(new ArrayList<>(req.getItems()));

            ValidationService.ValidationResult vr = validation.validateRequest(single);
            if (!vr.errors().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        String.join("; ", vr.errors()));
            }

            String jobId = jobStore.createJob();
            PalletiseResponse result = optimiser.runOptimisation(single, jobId);
            result.getSummary().getWarnings().addAll(0, vr.warnings().stream().map(w -> (Object) w).toList());
            jobStore.save(jobId, result);
            jobStore.savePalletConfig(jobId,
                    req.getPallet().getLengthMm(), req.getPallet().getWidthMm(),
                    req.getPallet().getMaxHeightMm(), req.getPallet().getMaxWeightKg());

            AlgorithmCompareEntry entry = new AlgorithmCompareEntry();
            entry.setAlgorithm(algo.name());
            entry.setPalletsUsed(result.getSummary().getPalletsUsed());
            entry.setAverageVolumeUtilisationPct(result.getSummary().getAverageVolumeUtilisationPct());
            entry.setAverageAreaUtilisationPct(result.getSummary().getAverageAreaUtilisationPct());
            entry.setTotalWeightKg(result.getSummary().getTotalWeightKg());
            entry.setFloatingBoxes(result.getSummary().getFloatingBoxes());
            entry.setUnstableBoxes(result.getSummary().getUnstableBoxes());
            entry.setWarnings(result.getSummary().getWarnings());
            entry.setJobId(jobId);
            results.add(entry);
        }

        CompareResponse resp = new CompareResponse();
        resp.setOrderId(req.getOrderId());
        resp.setResults(results);
        return ResponseEntity.ok(resp);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ResponseEntity<PalletiseResponse> runAndRespond(PalletiseRequest req) {
        ValidationService.ValidationResult vr = validation.validateRequest(req);
        if (!vr.errors().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    objectMapper.valueToTree(vr.errors()).toString());
        }

        String jobId = jobStore.createJob();
        PalletiseResponse result = optimiser.runOptimisation(req, jobId);
        // Prepend validation warnings
        List<Object> combined = new ArrayList<>();
        vr.warnings().forEach(w -> combined.add(w));
        combined.addAll(result.getSummary().getWarnings());
        result.getSummary().setWarnings(combined);

        jobStore.save(jobId, result);
        jobStore.savePalletConfig(jobId,
                req.getPallet().getLengthMm(), req.getPallet().getWidthMm(),
                req.getPallet().getMaxHeightMm(), req.getPallet().getMaxWeightKg());

        return ResponseEntity.ok(result);
    }

    private PalletiseRequest normalisePalletiseBody(JsonNode body) {
        if (body.isArray()) {
            List<Map<String, Object>> items = new ArrayList<>();
            for (JsonNode node : body) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = objectMapper.convertValue(node, Map.class);
                items.add(map);
            }
            return defaultRequestFromRawItems(items);
        }
        if (body.isObject()) {
            return objectMapper.convertValue(body, PalletiseRequest.class);
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Request body must be a palletise object or raw item array.");
    }

    private PalletiseRequest defaultRequestFromRawItems(List<Map<String, Object>> rawItems) {
        String timestamp = ZonedDateTime.now(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));

        List<ItemRequest> items = new ArrayList<>();
        for (Map<String, Object> raw : rawItems) {
            ItemRequest item = objectMapper.convertValue(raw, ItemRequest.class);
            items.add(item);
        }

        PalletSpec pallet = new PalletSpec();
        pallet.setLengthMm(1200); pallet.setWidthMm(1000);
        pallet.setMaxHeightMm(1150); pallet.setMaxWeightKg(1500);

        Constraints constraints = new Constraints();
        constraints.setAllowRotation(true);
        constraints.setPreferLargerBase(true);
        constraints.setDoNotAllowStabilityIssues(true);
        constraints.setEnforceNoLoadOnTop(true);
        constraints.setMixProducts(true);
        constraints.setRespectFefo(true);
        constraints.setRespectDeliveryDate(false);
        constraints.setPreferPartialPallets(true);
        constraints.setPreferLocationCluster(true);

        PalletiseRequest req = new PalletiseRequest();
        req.setOrderId("RAW-JSON-" + timestamp);
        req.setAlgorithm(AlgorithmType.EXTREME_POINT);
        req.setPallet(pallet);
        req.setConstraints(constraints);
        req.setItems(items);
        return req;
    }
}
