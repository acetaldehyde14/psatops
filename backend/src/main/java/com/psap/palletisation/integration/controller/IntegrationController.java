package com.psap.palletisation.integration.controller;

import com.psap.palletisation.entity.IntegrationJobEntity;
import com.psap.palletisation.entity.IntegrationOrderEntity;
import com.psap.palletisation.integration.IntegrationErrorCodes;
import com.psap.palletisation.integration.IntegrationException;
import com.psap.palletisation.integration.dto.request.MasterDataRequest;
import com.psap.palletisation.integration.dto.request.OrderRequest;
import com.psap.palletisation.integration.dto.response.*;
import com.psap.palletisation.integration.service.IntegrationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/integration")
public class IntegrationController {

    private final IntegrationService integrationService;

    public IntegrationController(IntegrationService integrationService) {
        this.integrationService = integrationService;
    }

    @PostMapping("/master-data")
    public ResponseEntity<?> pushMasterData(@Valid @RequestBody MasterDataRequest req) {
        try {
            MasterDataResponse resp = integrationService.processMasterData(req);
            return ResponseEntity.ok(resp);
        } catch (IntegrationException e) {
            return errorResponse(e.getErrorCode(), e.getMessage(), e.getOrderId(), HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            return errorResponse(IntegrationErrorCodes.INVALID_REQUEST, e.getMessage(), null, HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/orders")
    public ResponseEntity<?> pushOrder(@Valid @RequestBody OrderRequest req) {
        try {
            IntegrationOrderEntity order = integrationService.processOrder(req);
            OrderStatusResponse resp = new OrderStatusResponse();
            resp.setOrderId(order.getOrderId());
            resp.setStatus(order.getStatus());
            resp.setJobId(order.getJobId());
            resp.setCreatedAt(order.getCreatedAt());
            resp.setUpdatedAt(order.getUpdatedAt());
            return ResponseEntity.ok(resp);
        } catch (IntegrationException e) {
            HttpStatus status = e.getErrorCode() == IntegrationErrorCodes.ORDER_ALREADY_EXISTS
                    ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
            return errorResponse(e.getErrorCode(), e.getMessage(), e.getOrderId(), status);
        } catch (Exception e) {
            return errorResponse(IntegrationErrorCodes.INVALID_REQUEST, e.getMessage(), req.getOrderId(), HttpStatus.BAD_REQUEST);
        }
    }

    @PostMapping("/orders/{orderId}/optimise")
    public ResponseEntity<?> triggerOptimise(@PathVariable String orderId) {
        try {
            IntegrationJobEntity job = integrationService.triggerOptimisation(orderId);
            OrderStatusResponse resp = new OrderStatusResponse();
            resp.setOrderId(orderId);
            resp.setStatus(job.getStatus());
            resp.setJobId(job.getJobId());
            return ResponseEntity.accepted().body(resp);
        } catch (IntegrationException e) {
            HttpStatus status = e.getErrorCode() == IntegrationErrorCodes.ORDER_NOT_FOUND
                    ? HttpStatus.NOT_FOUND : HttpStatus.CONFLICT;
            return errorResponse(e.getErrorCode(), e.getMessage(), e.getOrderId(), status);
        } catch (Exception e) {
            return errorResponse(IntegrationErrorCodes.INVALID_REQUEST, e.getMessage(), orderId, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/orders/{orderId}/status")
    public ResponseEntity<?> getStatus(@PathVariable String orderId) {
        try {
            OrderStatusResponse resp = integrationService.getOrderStatus(orderId);
            return ResponseEntity.ok(resp);
        } catch (IntegrationException e) {
            return errorResponse(e.getErrorCode(), e.getMessage(), e.getOrderId(), HttpStatus.NOT_FOUND);
        }
    }

    @GetMapping("/orders/{orderId}/load-data")
    public ResponseEntity<?> getLoadData(@PathVariable String orderId) {
        try {
            LoadDataResponse resp = integrationService.getLoadData(orderId);
            return ResponseEntity.ok(resp);
        } catch (IntegrationException e) {
            HttpStatus status = e.getErrorCode() == IntegrationErrorCodes.ORDER_NOT_FOUND
                    ? HttpStatus.NOT_FOUND : HttpStatus.ACCEPTED;
            return errorResponse(e.getErrorCode(), e.getMessage(), e.getOrderId(), status);
        }
    }

    @GetMapping("/orders/{orderId}/mixed-pallet-data")
    public ResponseEntity<?> getMixedPalletData(@PathVariable String orderId) {
        try {
            MixedPalletDataResponse resp = integrationService.getMixedPalletData(orderId);
            return ResponseEntity.ok(resp);
        } catch (IntegrationException e) {
            HttpStatus status = e.getErrorCode() == IntegrationErrorCodes.ORDER_NOT_FOUND
                    ? HttpStatus.NOT_FOUND : HttpStatus.ACCEPTED;
            return errorResponse(e.getErrorCode(), e.getMessage(), e.getOrderId(), status);
        }
    }

    @DeleteMapping("/orders/{orderId}")
    public ResponseEntity<?> deleteOrder(@PathVariable String orderId) {
        try {
            integrationService.deleteOrder(orderId);
            return ResponseEntity.noContent().build();
        } catch (IntegrationException e) {
            return errorResponse(e.getErrorCode(), e.getMessage(), e.getOrderId(), HttpStatus.NOT_FOUND);
        }
    }

    private ResponseEntity<IntegrationErrorResponse> errorResponse(int errorCode, String message, String orderId, HttpStatus status) {
        return ResponseEntity.status(status).body(new IntegrationErrorResponse(errorCode, message, orderId));
    }
}
