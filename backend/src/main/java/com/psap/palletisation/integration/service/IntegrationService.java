package com.psap.palletisation.integration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.psap.palletisation.entity.*;
import com.psap.palletisation.integration.IntegrationErrorCodes;
import com.psap.palletisation.integration.IntegrationException;
import com.psap.palletisation.integration.dto.request.MasterDataRequest;
import com.psap.palletisation.integration.dto.request.OrderRequest;
import com.psap.palletisation.integration.dto.request.OrderSkuRequest;
import com.psap.palletisation.integration.dto.request.SkuRequest;
import com.psap.palletisation.integration.dto.response.*;
import com.psap.palletisation.repository.*;
import com.psap.palletisation.service.JobStoreService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;


@Service
public class IntegrationService {

    private final SkuMasterRepository skuMasterRepo;
    private final IntegrationOrderRepository orderRepo;
    private final IntegrationJobRepository jobRepo;
    private final IntegrationResultRepository resultRepo;
    private final IntegrationResultBoxRepository resultBoxRepo;
    private final JobStoreService jobStoreService;
    private final ObjectMapper objectMapper;
    private final IntegrationAsyncRunner asyncRunner;

    public IntegrationService(
            SkuMasterRepository skuMasterRepo,
            IntegrationOrderRepository orderRepo,
            IntegrationJobRepository jobRepo,
            IntegrationResultRepository resultRepo,
            IntegrationResultBoxRepository resultBoxRepo,
            JobStoreService jobStoreService,
            ObjectMapper objectMapper,
            IntegrationAsyncRunner asyncRunner) {
        this.skuMasterRepo = skuMasterRepo;
        this.orderRepo = orderRepo;
        this.jobRepo = jobRepo;
        this.resultRepo = resultRepo;
        this.resultBoxRepo = resultBoxRepo;
        this.jobStoreService = jobStoreService;
        this.objectMapper = objectMapper;
        this.asyncRunner = asyncRunner;
    }

    // --- Master Data ---

    @Transactional
    public MasterDataResponse processMasterData(MasterDataRequest req) {
        String txType = req.getTransactionType().toUpperCase();
        int count = 0;
        for (SkuRequest skuReq : req.getSkuList()) {
            switch (txType) {
                case "ADD", "UPDATE" -> {
                    Optional<SkuMasterEntity> existing = skuMasterRepo.findByOrgIdAndSkuId(req.getOrgId(), skuReq.getSkuId());
                    SkuMasterEntity entity = existing.orElseGet(SkuMasterEntity::new);
                    entity.setOrgId(req.getOrgId());
                    entity.setSkuId(skuReq.getSkuId());
                    entity.setDescription(skuReq.getDescription());
                    entity.setLengthMm(skuReq.getLengthMm());
                    entity.setWidthMm(skuReq.getWidthMm());
                    entity.setHeightMm(skuReq.getHeightMm());
                    entity.setWeightKg(skuReq.getWeightKg());
                    entity.setAllowRotation(skuReq.getAllowRotation());
                    entity.setNoLoadOnTop(skuReq.getNoLoadOnTop());
                    entity.setStackRule(skuReq.getStackRule());
                    entity.setLocation(skuReq.getLocation());
                    entity.setFamily(skuReq.getFamily());
                    entity.setLabel(skuReq.getLabel());
                    entity.setMaxStackWeightKg(skuReq.getMaxStackWeightKg());
                    entity.setMaxStackHeightMm(skuReq.getMaxStackHeightMm());
                    Instant now = Instant.now();
                    if (entity.getCreatedAt() == null) entity.setCreatedAt(now);
                    entity.setUpdatedAt(now);
                    skuMasterRepo.save(entity);
                    count++;
                }
                case "DELETE" -> {
                    skuMasterRepo.deleteByOrgIdAndSkuId(req.getOrgId(), skuReq.getSkuId());
                    count++;
                }
                default -> throw new IllegalArgumentException("Unknown transactionType: " + txType);
            }
        }
        return new MasterDataResponse(req.getOrgId(), txType, count, "Processed " + count + " SKU(s)");
    }

    // --- Order ---

    @Transactional
    public IntegrationOrderEntity processOrder(OrderRequest req) {
        String txType = req.getTransactionType().toUpperCase();

        switch (txType) {
            case "DELETE" -> {
                IntegrationOrderEntity order = orderRepo.findByOrderId(req.getOrderId())
                        .orElseThrow(() -> new IntegrationException(IntegrationErrorCodes.ORDER_NOT_FOUND,
                                "Order not found: " + req.getOrderId(), req.getOrderId()));
                deleteOrderInternal(order.getOrderId());
                return order;
            }
            case "UPDATE" -> {
                IntegrationOrderEntity order = orderRepo.findByOrderId(req.getOrderId())
                        .orElseThrow(() -> new IntegrationException(IntegrationErrorCodes.ORDER_NOT_FOUND,
                                "Order not found: " + req.getOrderId(), req.getOrderId()));
                validateSkus(req);
                updateOrderFields(order, req);
                order.setUpdatedAt(Instant.now());
                return orderRepo.save(order);
            }
            default -> { // ADD
                if (orderRepo.existsByOrderId(req.getOrderId())) {
                    throw new IntegrationException(IntegrationErrorCodes.ORDER_ALREADY_EXISTS,
                            "Order already exists: " + req.getOrderId(), req.getOrderId());
                }
                validateSkus(req);
                IntegrationOrderEntity order = new IntegrationOrderEntity();
                order.setOrderId(req.getOrderId());
                updateOrderFields(order, req);
                order.setStatus("RECEIVED");
                Instant now = Instant.now();
                order.setCreatedAt(now);
                order.setUpdatedAt(now);
                return orderRepo.save(order);
            }
        }
    }

    private void validateSkus(OrderRequest req) {
        List<String> missing = req.getSkuList().stream()
                .map(OrderSkuRequest::getSkuId)
                .filter(skuId -> !skuMasterRepo.existsByOrgIdAndSkuId(req.getOrgId(), skuId))
                .collect(Collectors.toList());
        if (!missing.isEmpty()) {
            throw new IntegrationException(IntegrationErrorCodes.SKU_NOT_IN_MASTER_DATA,
                    "SKU(s) not found in master data: " + String.join(", ", missing), req.getOrderId());
        }
    }

    private void updateOrderFields(IntegrationOrderEntity order, OrderRequest req) {
        order.setOrgId(req.getOrgId());
        order.setCustomerName(req.getCustomerName());
        order.setDeliveryDate(req.getDeliveryDate());
        order.setLoadType(req.getLoadType());
        try {
            if (req.getPallet() != null) {
                order.setPalletSpecJson(objectMapper.writeValueAsString(req.getPallet()));
            }
            // Store constraints and skuList combined in constraintsJson
            Map<String, Object> constraintsWrapper = new LinkedHashMap<>();
            if (req.getConstraints() != null) {
                constraintsWrapper.put("constraints", req.getConstraints());
            }
            constraintsWrapper.put("skuList", req.getSkuList());
            order.setConstraintsJson(objectMapper.writeValueAsString(constraintsWrapper));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialise order data", e);
        }
    }

    // --- Trigger Optimisation ---

    @Transactional
    public IntegrationJobEntity triggerOptimisation(String orderId) {
        IntegrationOrderEntity order = orderRepo.findByOrderId(orderId)
                .orElseThrow(() -> new IntegrationException(IntegrationErrorCodes.ORDER_NOT_FOUND,
                        "Order not found: " + orderId, orderId));

        if (!"RECEIVED".equals(order.getStatus()) && !"VALIDATED".equals(order.getStatus())) {
            throw new IntegrationException(IntegrationErrorCodes.INVALID_ORDER_STATUS,
                    "Order status must be RECEIVED or VALIDATED to trigger optimisation, current: " + order.getStatus(),
                    orderId);
        }

        String jobId = jobStoreService.createJob();
        order.setStatus("OPTIMISING");
        order.setJobId(jobId);
        order.setUpdatedAt(Instant.now());
        orderRepo.save(order);

        IntegrationJobEntity jobEntity = new IntegrationJobEntity();
        jobEntity.setOrderId(orderId);
        jobEntity.setJobId(jobId);
        jobEntity.setStatus("OPTIMISING");
        jobEntity.setStartedAt(Instant.now());
        IntegrationJobEntity savedJob = jobRepo.save(jobEntity);

        asyncRunner.runOptimisationAsync(orderId, jobId);

        return savedJob;
    }

    // --- Status ---

    public OrderStatusResponse getOrderStatus(String orderId) {
        IntegrationOrderEntity order = orderRepo.findByOrderId(orderId)
                .orElseThrow(() -> new IntegrationException(IntegrationErrorCodes.ORDER_NOT_FOUND,
                        "Order not found: " + orderId, orderId));
        OrderStatusResponse resp = new OrderStatusResponse();
        resp.setOrderId(order.getOrderId());
        resp.setStatus(order.getStatus());
        resp.setJobId(order.getJobId());
        resp.setErrorCode(order.getErrorCode());
        resp.setErrorDescription(order.getErrorDescription());
        resp.setCreatedAt(order.getCreatedAt());
        resp.setUpdatedAt(order.getUpdatedAt());
        return resp;
    }

    // --- Load Data ---

    public LoadDataResponse getLoadData(String orderId) {
        IntegrationOrderEntity order = orderRepo.findByOrderId(orderId)
                .orElseThrow(() -> new IntegrationException(IntegrationErrorCodes.ORDER_NOT_FOUND,
                        "Order not found: " + orderId, orderId));
        IntegrationResultEntity result = resultRepo.findByOrderId(orderId)
                .orElseThrow(() -> new IntegrationException(IntegrationErrorCodes.RESULT_NOT_AVAILABLE,
                        "Result not available for order: " + orderId, orderId));
        List<IntegrationResultBoxEntity> boxes = resultBoxRepo.findByOrderId(orderId);
        return buildLoadDataResponse(order, result, boxes);
    }

    public MixedPalletDataResponse getMixedPalletData(String orderId) {
        IntegrationOrderEntity order = orderRepo.findByOrderId(orderId)
                .orElseThrow(() -> new IntegrationException(IntegrationErrorCodes.ORDER_NOT_FOUND,
                        "Order not found: " + orderId, orderId));
        IntegrationResultEntity result = resultRepo.findByOrderId(orderId)
                .orElseThrow(() -> new IntegrationException(IntegrationErrorCodes.RESULT_NOT_AVAILABLE,
                        "Result not available for order: " + orderId, orderId));
        List<IntegrationResultBoxEntity> boxes = resultBoxRepo.findByOrderId(orderId);

        LoadDataResponse loadData = buildLoadDataResponse(order, result, boxes);
        MixedPalletDataResponse resp = new MixedPalletDataResponse();
        resp.setOrderId(loadData.getOrderId());
        resp.setLoadCount(loadData.getLoadCount());
        resp.setCutCount(loadData.getCutCount());
        resp.setCubePercent(loadData.getCubePercent());
        resp.setFloorPercent(loadData.getFloorPercent());
        resp.setPalletCount(loadData.getPalletCount());
        resp.setTotalWeightKg(loadData.getTotalWeightKg());
        resp.setStatus(loadData.getStatus());
        resp.setErrorCode(loadData.getErrorCode());
        resp.setErrorDescription(loadData.getErrorDescription());
        resp.setPallets(loadData.getPallets());
        return resp;
    }

    private LoadDataResponse buildLoadDataResponse(IntegrationOrderEntity order,
                                                    IntegrationResultEntity result,
                                                    List<IntegrationResultBoxEntity> boxes) {
        // Group boxes by palletNo
        Map<Integer, List<IntegrationResultBoxEntity>> byPallet = new LinkedHashMap<>();
        for (IntegrationResultBoxEntity box : boxes) {
            byPallet.computeIfAbsent(box.getPalletNo(), k -> new ArrayList<>()).add(box);
        }

        List<LoadPalletResult> palletResults = new ArrayList<>();
        for (Map.Entry<Integer, List<IntegrationResultBoxEntity>> entry : byPallet.entrySet()) {
            LoadPalletResult pr = new LoadPalletResult();
            pr.setPalletNo(entry.getKey());
            IntegrationResultBoxEntity first = entry.getValue().get(0);
            pr.setPalletType(first.getPalletType());
            pr.setCubePercent(first.getCubePercent());
            pr.setFloorPercent(first.getFloorPercent());
            pr.setTotalWeightKg(first.getTotalWeightKg());

            List<LoadBoxResult> boxResults = new ArrayList<>();
            for (IntegrationResultBoxEntity b : entry.getValue()) {
                LoadBoxResult br = new LoadBoxResult();
                br.setOrderNum(b.getOrderNum());
                br.setSkuId(b.getSkuId());
                br.setQuantity(b.getQuantity());
                br.setSeqNum(b.getSeqNum());
                br.setPalletNo(b.getPalletNo());
                br.setX1(b.getX1()); br.setY1(b.getY1()); br.setZ1(b.getZ1());
                br.setX2(b.getX2()); br.setY2(b.getY2()); br.setZ2(b.getZ2());
                br.setRotation(b.getRotation());
                br.setDimVert(b.getDimVert());
                br.setStop(b.getStop());
                br.setPriority(b.getPriority());
                br.setUnitized(b.getUnitized());
                br.setOrgId(b.getOrgId());
                boxResults.add(br);
            }
            pr.setBoxes(boxResults);
            palletResults.add(pr);
        }

        LoadDataResponse resp = new LoadDataResponse();
        resp.setOrderId(order.getOrderId());
        resp.setLoadCount(result.getLoadCount());
        resp.setCutCount(result.getCutCount());
        resp.setCubePercent(result.getCubePercent());
        resp.setFloorPercent(result.getFloorPercent());
        resp.setPalletCount(result.getPalletCount());
        resp.setTotalWeightKg(result.getTotalWeightKg());
        resp.setStatus(result.getStatus());
        resp.setErrorCode(result.getErrorCode());
        resp.setErrorDescription(result.getErrorDescription());
        resp.setPallets(palletResults);
        return resp;
    }

    // --- Delete ---

    @Transactional
    public void deleteOrder(String orderId) {
        if (!orderRepo.existsByOrderId(orderId)) {
            throw new IntegrationException(IntegrationErrorCodes.ORDER_NOT_FOUND,
                    "Order not found: " + orderId, orderId);
        }
        deleteOrderInternal(orderId);
    }

    private void deleteOrderInternal(String orderId) {
        resultBoxRepo.deleteByOrderId(orderId);
        resultRepo.deleteByOrderId(orderId);
        jobRepo.findByOrderId(orderId).ifPresent(jobRepo::delete);
        orderRepo.deleteByOrderId(orderId);
    }
}
