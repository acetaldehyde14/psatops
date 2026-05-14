package com.psap.palletisation.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psap.palletisation.dto.response.PalletiseResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PalletiseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final Map<String, Object> SAMPLE_REQUEST = Map.of(
            "order_id", "TEST-001",
            "algorithm", "EXTREME_POINT",
            "pallet", Map.of(
                    "length_mm", 1200, "width_mm", 1100,
                    "max_height_mm", 1150, "max_weight_kg", 1500
            ),
            "constraints", Map.of(
                    "allow_rotation", true, "mix_products", true,
                    "respect_fefo", true, "respect_delivery_date", false
            ),
            "items", List.of(
                    Map.of("sku", "SKU-001", "quantity", 2,
                            "length_mm", 300, "width_mm", 200, "height_mm", 150, "weight_kg", 1.5)
            )
    );

    @Test
    void validRequestReturns200WithJobId() throws Exception {
        MvcResult result = mockMvc.perform(post("/palletise")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(SAMPLE_REQUEST)))
                .andExpect(status().isOk())
                .andReturn();

        PalletiseResponse resp = objectMapper.readValue(
                result.getResponse().getContentAsString(), PalletiseResponse.class);

        assertThat(resp.getJobId()).isNotBlank();
        assertThat(resp.getStatus()).isEqualTo("completed");
    }

    @Test
    void emptyItemsReturns400() throws Exception {
        Map<String, Object> req = Map.of(
                "order_id", "TEST",
                "algorithm", "EXTREME_POINT",
                "pallet", Map.of("length_mm", 1200, "width_mm", 1100, "max_height_mm", 1150, "max_weight_kg", 1500),
                "constraints", Map.of(),
                "items", List.of()
        );
        mockMvc.perform(post("/palletise")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rawArrayBodyReturns200() throws Exception {
        List<Map<String, Object>> rawItems = List.of(
                Map.of("sku", "RAW-SKU", "quantity", 1,
                        "length_mm", 300, "width_mm", 200, "height_mm", 150, "weight_kg", 2.0)
        );
        MvcResult result = mockMvc.perform(post("/palletise")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rawItems)))
                .andExpect(status().isOk())
                .andReturn();

        PalletiseResponse resp = objectMapper.readValue(
                result.getResponse().getContentAsString(), PalletiseResponse.class);
        assertThat(resp.getJobId()).isNotBlank();
        assertThat(resp.getSummary().getTotalBoxes()).isEqualTo(1);
    }
}
