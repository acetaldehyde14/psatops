package com.psap.palletisation.service;

import com.psap.palletisation.dto.response.JobStatus;
import com.psap.palletisation.dto.response.PalletResult;
import com.psap.palletisation.dto.response.PalletiseResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory job store. Port of job_store.py.
 */
@Service
public class JobStoreService {

    private final Map<String, PalletiseResponse> jobs = new ConcurrentHashMap<>();
    private final Map<String, List<PalletResult>> adjusted = new ConcurrentHashMap<>();
    private final Map<String, Instant> adjustedAt = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> meta = new ConcurrentHashMap<>();

    public String createJob() {
        String hex = UUID.randomUUID().toString().replace("-", "");
        String jobId = "job_" + hex.substring(0, 12);
        Map<String, Object> m = new ConcurrentHashMap<>();
        m.put("status", "pending");
        m.put("created_at", Instant.now().toString());
        meta.put(jobId, m);
        return jobId;
    }

    public void save(String jobId, PalletiseResponse result) {
        jobs.put(jobId, result);
        Map<String, Object> m = meta.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
        m.put("status", result.getStatus());
        m.put("algorithm_used", result.getAlgorithmUsed());
        m.put("order_id", result.getOrderId());
        m.put("manually_adjusted", false);
        m.put("layout_source", "generated");
    }

    /**
     * Return result with adjusted pallets substituted if present.
     */
    public PalletiseResponse get(String jobId) {
        PalletiseResponse result = jobs.get(jobId);
        if (result == null) return null;
        if (adjusted.containsKey(jobId)) {
            // Return a shallow copy with adjusted pallets
            PalletiseResponse copy = shallowCopy(result);
            copy.setPallets(adjusted.get(jobId));
            return copy;
        }
        return result;
    }

    public PalletiseResponse getOriginal(String jobId) {
        return jobs.get(jobId);
    }

    public void saveAdjusted(String jobId, List<PalletResult> pallets, String timestamp) {
        adjusted.put(jobId, pallets);
        adjustedAt.put(jobId, Instant.parse(timestamp));
        Map<String, Object> m = meta.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>());
        m.put("manually_adjusted", true);
        m.put("layout_source", "manual_adjusted");
        m.put("adjusted_at", timestamp);
    }

    public boolean isManuallyAdjusted(String jobId) {
        Object val = meta.getOrDefault(jobId, Collections.emptyMap()).get("manually_adjusted");
        return Boolean.TRUE.equals(val);
    }

    public Set<String> getAllBoxIds(String jobId) {
        PalletiseResponse result = jobs.get(jobId);
        if (result == null) return Collections.emptySet();
        Set<String> ids = new HashSet<>();
        result.getPallets().forEach(p -> p.getBoxes().forEach(b -> ids.add(b.getBoxId())));
        return ids;
    }

    public void savePalletConfig(String jobId, double palletL, double palletW, double maxH, double maxW) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("length_mm", palletL);
        config.put("width_mm", palletW);
        config.put("max_height_mm", maxH);
        config.put("max_weight_kg", maxW);
        meta.computeIfAbsent(jobId, k -> new ConcurrentHashMap<>()).put("pallet_config", config);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getPalletConfig(String jobId) {
        Object cfg = meta.getOrDefault(jobId, Collections.emptyMap()).get("pallet_config");
        return cfg instanceof Map ? (Map<String, Object>) cfg : null;
    }

    public JobStatus getStatus(String jobId) {
        Map<String, Object> m = meta.get(jobId);
        if (m == null) return null;
        JobStatus status = new JobStatus();
        status.setJobId(jobId);
        status.setStatus((String) m.getOrDefault("status", "unknown"));
        status.setCreatedAt((String) m.getOrDefault("created_at", ""));
        status.setAlgorithmUsed((String) m.get("algorithm_used"));
        status.setOrderId((String) m.get("order_id"));
        return status;
    }

    private PalletiseResponse shallowCopy(PalletiseResponse src) {
        PalletiseResponse copy = new PalletiseResponse();
        copy.setJobId(src.getJobId());
        copy.setOrderId(src.getOrderId());
        copy.setStatus(src.getStatus());
        copy.setAlgorithmUsed(src.getAlgorithmUsed());
        copy.setSummary(src.getSummary());
        copy.setPallets(src.getPallets()); // will be overridden
        copy.setConstraintsUsed(src.getConstraintsUsed());
        copy.setStability(src.getStability());
        copy.setUnplacedBoxes(src.getUnplacedBoxes());
        return copy;
    }
}
