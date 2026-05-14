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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class JobControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private static final Map<String, Object> SAMPLE_REQUEST = Map.of(
            "order_id", "JOB-TEST",
            "algorithm", "EXTREME_POINT",
            "pallet", Map.of("length_mm", 1200, "width_mm", 1100, "max_height_mm", 1150, "max_weight_kg", 1500),
            "constraints", Map.of("allow_rotation", true),
            "items", List.of(
                    Map.of("sku", "JOB-SKU", "quantity", 1,
                            "length_mm", 300, "width_mm", 200, "height_mm", 150, "weight_kg", 2.0)
            )
    );

    @Test
    void unknownJobReturns404() throws Exception {
        mockMvc.perform(get("/jobs/nonexistent_job_xyz"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getJobAfterPalletiseReturnsCompleted() throws Exception {
        // First create a job
        MvcResult palletiseResult = mockMvc.perform(post("/palletise")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(SAMPLE_REQUEST)))
                .andExpect(status().isOk())
                .andReturn();

        PalletiseResponse resp = objectMapper.readValue(
                palletiseResult.getResponse().getContentAsString(), PalletiseResponse.class);
        String jobId = resp.getJobId();

        // Then retrieve it
        MvcResult getResult = mockMvc.perform(get("/jobs/" + jobId))
                .andExpect(status().isOk())
                .andReturn();

        @SuppressWarnings("unchecked")
        Map<String, Object> data = objectMapper.readValue(
                getResult.getResponse().getContentAsString(), Map.class);

        assertThat(data.get("job_id")).isEqualTo(jobId);
        assertThat(data.get("status")).isEqualTo("completed");
    }

    @Test
    void exportCsvReturnsTextCsv() throws Exception {
        // Create a job first
        MvcResult palletiseResult = mockMvc.perform(post("/palletise")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(SAMPLE_REQUEST)))
                .andExpect(status().isOk())
                .andReturn();

        PalletiseResponse resp = objectMapper.readValue(
                palletiseResult.getResponse().getContentAsString(), PalletiseResponse.class);
        String jobId = resp.getJobId();

        mockMvc.perform(get("/jobs/" + jobId + "/export/csv"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.parseMediaType("text/csv")));
    }
}
