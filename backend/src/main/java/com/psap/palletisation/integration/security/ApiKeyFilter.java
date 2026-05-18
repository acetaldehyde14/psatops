package com.psap.palletisation.integration.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.psap.palletisation.integration.IntegrationErrorCodes;
import com.psap.palletisation.integration.dto.response.IntegrationErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class ApiKeyFilter extends OncePerRequestFilter {

    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String ENV_VAR = "PSATOPS_INTEGRATION_API_KEY";

    private final ObjectMapper objectMapper;

    public ApiKeyFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/v1/integration");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String configuredKey = System.getenv(ENV_VAR);
        if (configuredKey == null || configuredKey.isBlank()) {
            // dev mode — no key configured, allow all
            filterChain.doFilter(request, response);
            return;
        }
        String providedKey = request.getHeader(API_KEY_HEADER);
        if (providedKey == null || !providedKey.equals(configuredKey)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            IntegrationErrorResponse body = new IntegrationErrorResponse(
                    IntegrationErrorCodes.UNAUTHORISED,
                    "Missing or invalid API key",
                    null
            );
            response.getWriter().write(objectMapper.writeValueAsString(body));
            return;
        }
        filterChain.doFilter(request, response);
    }
}
