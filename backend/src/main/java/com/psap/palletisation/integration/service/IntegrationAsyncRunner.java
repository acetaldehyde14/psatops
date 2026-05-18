package com.psap.palletisation.integration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psap.palletisation.algorithm.OptimiserService;
import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.ItemRequest;
import com.psap.palletisation.dto.request.PalletiseRequest;
import com.psap.palletisation.dto.request.PalletSpec;
import com.psap.palletisation.dto.response.BoxResult;
import com.psap.palletisation.dto.response.PalletResult;
import com.psap.palletisation.dto.response.PalletiseResponse;
import com.psap.palletisation.entity.*;
import com.psap.palletisation.integration.IntegrationErrorCodes;
import com.psap.palletisation.integration.dto.request.OrderSkuRequest;
import com.psap.palletisation.repository.*;
import com.psap.palletisation.service.JobStoreService;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class IntegrationAsyncRunner {

    private final SkuMasterRepository skuMasterRepo;
    private final IntegrationOrderRepository orderRepo;
    private final IntegrationJobRepository jobRepo;
    private final IntegrationResultRepository resultRepo;
    private final IntegrationResultBoxRepository resultBoxRepo;
    private final OptimiserService optimiserService;
    private final JobStoreService jobStoreService;
    private final ObjectMapper objectMapper;

    public IntegrationAsyncRunner(
            SkuMasterRepository skuMasterRepo,
            IntegrationOrderRepository orderRepo,
            IntegrationJobRepository jobRepo,
            IntegrationResultRepository resultRepo,
            IntegrationResultBoxRepository resultBoxRepo,
            OptimiserService optimiserService,
            JobStoreService jobStoreService,
            ObjectMapper objectMapper) {
        this.skuMasterRepo = skuMasterRepo;
        this.orderRepo = orderRepo;
        this.jobRepo = jobRepo;
        this.resultRepo = resultRepo;
        this.resultBoxRepo = resultBoxRepo;
        this.optimiserService = optimiserService;
        this.jobStoreService = jobStoreService;
        this.objectMapper = objectMapper;
    }

    @Async
    public void runOptimisationAsync(String orderId, String jobId) {
        try {
            IntegrationOrderEntity order = orderRepo.findByOrderId(orderId)
                    .orElseThrow(() -> new RuntimeException("Order not found during async: " + orderId));

            // Deserialise pallet spec
            PalletSpec palletSpec = new PalletSpec();
            if (order.getPalletSpecJson() != null) {
                palletSpec = objectMapper.readValue(order.getPalletSpecJson(), PalletSpec.class);
            }

            // Deserialise constraints and skuList from combined JSON
            Constraints constraints = new Constraints();
            List<OrderSkuRequest> skuList = new ArrayList<>();
            if (order.getConstraintsJson() != null) {
                com.fasterxml.jackson.databind.JsonNode root = objectMapper.readTree(order.getConstraintsJson());
                if (root.has("constraints")) {
                    constraints = objectMapper.treeToValue(root.get("constraints"), Constraints.class);
                }
                if (root.has("skuList")) {
                    skuList = objectMapper.treeToValue(root.get("skuList"),
                            objectMapper.getTypeFactory().constructCollectionType(List.class, OrderSkuRequest.class));
                }
            }

            // Expand order SKU lines into ItemRequest list
            List<ItemRequest> items = new ArrayList<>();
            for (OrderSkuRequest skuReq : skuList) {
                SkuMasterEntity sku = skuMasterRepo.findByOrgIdAndSkuId(order.getOrgId(), skuReq.getSkuId())
                        .orElseThrow(() -> new RuntimeException("SKU not found in master: " + skuReq.getSkuId()));

                ItemRequest item = new ItemRequest();
                item.setSku(skuReq.getSkuId());
                item.setQuantity(skuReq.getQuantity() != null ? skuReq.getQuantity() : 1.0);
                item.setLengthMm(sku.getLengthMm() != null ? sku.getLengthMm() : 0.0);
                item.setWidthMm(sku.getWidthMm() != null ? sku.getWidthMm() : 0.0);
                item.setHeightMm(sku.getHeightMm() != null ? sku.getHeightMm() : 0.0);
                item.setWeightKg(sku.getWeightKg() != null ? sku.getWeightKg() : 0.0);
                if (sku.getNoLoadOnTop() != null) item.setNoLoadOnTop(sku.getNoLoadOnTop());
                if (sku.getLocation() != null) item.setLocation(sku.getLocation());
                item.setDescriptionOfGoods(sku.getDescription());
                item.setLineId(skuReq.getOrderNum());
                items.add(item);
            }

            // Build PalletiseRequest
            PalletiseRequest palletiseRequest = new PalletiseRequest();
            palletiseRequest.setOrderId(orderId);
            palletiseRequest.setPallet(palletSpec);
            palletiseRequest.setConstraints(constraints);
            palletiseRequest.setItems(items);

            // Run optimisation
            PalletiseResponse result = optimiserService.runOptimisation(palletiseRequest, jobId);
            jobStoreService.save(jobId, result);

            // Persist result
            persistResult(orderId, jobId, order.getOrgId(), order.getLoadType(), result);

            // Update statuses
            updateJobStatus(jobId, "COMPLETED", result.getAlgorithmUsed(), null);
            updateOrderStatus(orderId, "COMPLETED", null, null);

        } catch (Exception e) {
            updateJobStatus(jobId, "FAILED", null, e.getMessage());
            updateOrderStatus(orderId, "FAILED",
                    IntegrationErrorCodes.OPTIMISATION_FAILED,
                    e.getMessage() != null ? e.getMessage() : "Optimisation failed");
        }
    }

    @Transactional
    public void persistResult(String orderId, String jobId, String orgId, String loadType, PalletiseResponse response) {
        // Delete any existing result
        resultRepo.findByOrderId(orderId).ifPresent(r -> {
            resultBoxRepo.deleteByOrderId(orderId);
            resultRepo.delete(r);
        });

        List<PalletResult> pallets = response.getPallets() != null ? response.getPallets() : List.of();

        // Summary metrics — using actual PalletResult getter names
        double totalWeight = pallets.stream()
                .mapToDouble(p -> p.getWeightKg())
                .sum();
        double avgCube = pallets.isEmpty() ? 0.0 :
                pallets.stream().mapToDouble(p -> p.getVolumeUtilisationPct())
                        .average().orElse(0.0);
        double avgFloor = pallets.isEmpty() ? 0.0 :
                pallets.stream().mapToDouble(p -> p.getAreaUtilisationPct())
                        .average().orElse(0.0);

        IntegrationResultEntity resultEntity = new IntegrationResultEntity();
        resultEntity.setOrderId(orderId);
        resultEntity.setJobId(jobId);
        resultEntity.setLoadCount(pallets.size());
        resultEntity.setCutCount(0);
        resultEntity.setCubePercent(avgCube);
        resultEntity.setFloorPercent(avgFloor);
        resultEntity.setPalletCount(pallets.size());
        resultEntity.setTotalWeightKg(totalWeight);
        resultEntity.setStatus("COMPLETED");
        resultEntity.setCreatedAt(Instant.now());
        resultRepo.save(resultEntity);

        // Persist boxes
        List<IntegrationResultBoxEntity> boxEntities = new ArrayList<>();
        for (PalletResult pallet : pallets) {
            if (pallet.getBoxes() == null) continue;
            for (BoxResult box : pallet.getBoxes()) {
                IntegrationResultBoxEntity boxEntity = new IntegrationResultBoxEntity();
                boxEntity.setOrderId(orderId);
                boxEntity.setPalletNo(pallet.getPalletNo());
                boxEntity.setPalletType(loadType);
                boxEntity.setOrderNum(box.getLineId());
                boxEntity.setSkuId(box.getSku());
                boxEntity.setQuantity(1.0);
                boxEntity.setSeqNum(box.getPickSequence());
                boxEntity.setOrgId(orgId);

                // Coordinates — primitive doubles from BoxResult
                double x1 = box.getXMm();
                double y1 = box.getYMm();
                double z1 = box.getZMm();
                double effL = box.getLengthMm();
                double effW = box.getWidthMm();
                double effH = box.getHeightMm();

                boxEntity.setX1(x1);
                boxEntity.setY1(y1);
                boxEntity.setZ1(z1);
                boxEntity.setX2(x1 + effL);
                boxEntity.setY2(y1 + effW);
                boxEntity.setZ2(z1 + effH);
                boxEntity.setRotation(box.getRotation());
                boxEntity.setDimVert(effH);
                boxEntity.setUnitized(false);

                boxEntity.setCubePercent(pallet.getVolumeUtilisationPct());
                boxEntity.setFloorPercent(pallet.getAreaUtilisationPct());
                boxEntity.setTotalWeightKg(pallet.getWeightKg());

                boxEntities.add(boxEntity);
            }
        }
        resultBoxRepo.saveAll(boxEntities);
    }

    private void updateJobStatus(String jobId, String status, String algorithmUsed, String errorMessage) {
        jobRepo.findByJobId(jobId).ifPresent(job -> {
            job.setStatus(status);
            if (algorithmUsed != null) job.setAlgorithmUsed(algorithmUsed);
            if (errorMessage != null) job.setErrorMessage(errorMessage);
            job.setCompletedAt(Instant.now());
            jobRepo.save(job);
        });
    }

    private void updateOrderStatus(String orderId, String status, Integer errorCode, String errorDescription) {
        orderRepo.findByOrderId(orderId).ifPresent(order -> {
            order.setStatus(status);
            order.setErrorCode(errorCode);
            order.setErrorDescription(errorDescription);
            order.setUpdatedAt(Instant.now());
            orderRepo.save(order);
        });
    }
}
