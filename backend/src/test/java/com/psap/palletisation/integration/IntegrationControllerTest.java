package com.psap.palletisation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psap.palletisation.dto.request.PalletiseRequest;
import com.psap.palletisation.dto.request.ItemRequest;
import com.psap.palletisation.integration.dto.request.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class IntegrationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private SkuRequest buildSku(String skuId) {
        SkuRequest sku = new SkuRequest();
        sku.setSkuId(skuId);
        sku.setDescription("Test SKU " + skuId);
        sku.setLengthMm(300.0);
        sku.setWidthMm(200.0);
        sku.setHeightMm(150.0);
        sku.setWeightKg(2.5);
        sku.setAllowRotation(true);
        sku.setNoLoadOnTop(false);
        return sku;
    }

    private MasterDataRequest buildMasterDataRequest(String orgId, String... skuIds) {
        MasterDataRequest req = new MasterDataRequest();
        req.setOrgId(orgId);
        req.setTransactionType("ADD");
        req.setSkuList(java.util.Arrays.stream(skuIds).map(this::buildSku).collect(java.util.stream.Collectors.toList()));
        return req;
    }

    private OrderRequest buildOrderRequest(String orderId, String orgId, String... skuIds) {
        OrderRequest req = new OrderRequest();
        req.setOrderId(orderId);
        req.setOrgId(orgId);
        req.setCustomerName("Test Customer");
        req.setTransactionType("ADD");
        req.setLoadType("MIXED_PALLET");
        List<OrderSkuRequest> skuList = new java.util.ArrayList<>();
        for (String skuId : skuIds) {
            OrderSkuRequest s = new OrderSkuRequest();
            s.setSkuId(skuId);
            s.setQuantity(2.0);
            s.setOrderNum("ORD-001");
            skuList.add(s);
        }
        req.setSkuList(skuList);
        return req;
    }

    @Test
    void pushMasterData_returnsOk() throws Exception {
        MasterDataRequest req = buildMasterDataRequest("ORG1", "SKU-A", "SKU-B");
        mockMvc.perform(post("/api/v1/integration/master-data")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skus_processed", is(2)));
    }

    @Test
    void pushOrder_returnsOk() throws Exception {
        // First push master data
        mockMvc.perform(post("/api/v1/integration/master-data")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildMasterDataRequest("ORG1", "SKU-A"))));

        OrderRequest req = buildOrderRequest("ORDER-001", "ORG1", "SKU-A");
        mockMvc.perform(post("/api/v1/integration/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order_id", is("ORDER-001")))
                .andExpect(jsonPath("$.status", is("RECEIVED")));
    }

    @Test
    void pushOrder_missingSku_returns400() throws Exception {
        // Push master data without SKU-X
        mockMvc.perform(post("/api/v1/integration/master-data")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildMasterDataRequest("ORG1", "SKU-A"))));

        OrderRequest req = buildOrderRequest("ORDER-002", "ORG1", "SKU-X");
        mockMvc.perform(post("/api/v1/integration/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error_code", is(1004)));
    }

    @Test
    void triggerOptimise_returns202() throws Exception {
        // Setup
        mockMvc.perform(post("/api/v1/integration/master-data")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildMasterDataRequest("ORG1", "SKU-A"))));
        mockMvc.perform(post("/api/v1/integration/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildOrderRequest("ORDER-003", "ORG1", "SKU-A"))));

        mockMvc.perform(post("/api/v1/integration/orders/ORDER-003/optimise"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.order_id", is("ORDER-003")));
    }

    @Test
    void statusEndpoint_returnsStatus() throws Exception {
        mockMvc.perform(post("/api/v1/integration/master-data")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildMasterDataRequest("ORG1", "SKU-A"))));
        mockMvc.perform(post("/api/v1/integration/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildOrderRequest("ORDER-004", "ORG1", "SKU-A"))));

        mockMvc.perform(get("/api/v1/integration/orders/ORDER-004/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order_id", is("ORDER-004")))
                .andExpect(jsonPath("$.status", notNullValue()));
    }

    @Test
    void loadData_afterOptimisation_returnsCoordinates() throws Exception {
        mockMvc.perform(post("/api/v1/integration/master-data")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildMasterDataRequest("ORG1", "SKU-A"))));
        mockMvc.perform(post("/api/v1/integration/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildOrderRequest("ORDER-005", "ORG1", "SKU-A"))));
        mockMvc.perform(post("/api/v1/integration/orders/ORDER-005/optimise"));

        // Wait briefly for async to complete
        Thread.sleep(3000);

        mockMvc.perform(get("/api/v1/integration/orders/ORDER-005/load-data"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order_id", is("ORDER-005")))
                .andExpect(jsonPath("$.pallets", notNullValue()));
    }

    @Test
    void existingPalletiseEndpoint_stillWorks() throws Exception {
        PalletiseRequest req = new PalletiseRequest();
        ItemRequest item = new ItemRequest();
        item.setSku("TEST-SKU");
        item.setQuantity(1);
        item.setLengthMm(300);
        item.setWidthMm(200);
        item.setHeightMm(150);
        item.setWeightKg(5);
        req.setItems(List.of(item));

        mockMvc.perform(post("/api/v1/palletise")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }
}
