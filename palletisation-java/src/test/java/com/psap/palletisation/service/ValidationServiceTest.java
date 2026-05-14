package com.psap.palletisation.service;

import com.psap.palletisation.dto.request.Constraints;
import com.psap.palletisation.dto.request.ItemRequest;
import com.psap.palletisation.dto.request.PalletSpec;
import com.psap.palletisation.dto.request.PalletiseRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ValidationServiceTest {

    private final ValidationService service = new ValidationService();

    private PalletiseRequest request(List<ItemRequest> items) {
        PalletiseRequest req = new PalletiseRequest();
        req.setItems(items);
        req.setPallet(new PalletSpec());
        req.setConstraints(new Constraints());
        return req;
    }

    private ItemRequest item(String sku, double l, double w, double h, double wt, double qty) {
        ItemRequest i = new ItemRequest();
        i.setSku(sku);
        i.setLengthMm(l); i.setWidthMm(w); i.setHeightMm(h);
        i.setWeightKg(wt); i.setQuantity(qty);
        return i;
    }

    @Test
    void emptyItemsReturnsError() {
        ValidationService.ValidationResult result = service.validateRequest(request(List.of()));
        assertThat(result.errors()).isNotEmpty();
        assertThat(result.errors().get(0)).containsIgnoringCase("no order items");
    }

    @Test
    void zeroLengthReturnsError() {
        ItemRequest i = item("SKU", 0, 100, 100, 5, 1);
        ValidationService.ValidationResult result = service.validateRequest(request(List.of(i)));
        assertThat(result.errors()).anyMatch(e -> e.contains("dimensions must be positive"));
    }

    @Test
    void negativeLengthReturnsError() {
        ItemRequest i = item("SKU", -10, 100, 100, 5, 1);
        ValidationService.ValidationResult result = service.validateRequest(request(List.of(i)));
        assertThat(result.errors()).anyMatch(e -> e.contains("dimensions must be positive"));
    }

    @Test
    void negativeWeightReturnsError() {
        ItemRequest i = item("SKU", 100, 100, 100, -1, 1);
        ValidationService.ValidationResult result = service.validateRequest(request(List.of(i)));
        assertThat(result.errors()).anyMatch(e -> e.contains("weight cannot be negative"));
    }

    @Test
    void zeroWeightReturnsWarning() {
        ItemRequest i = item("SKU", 100, 100, 100, 0, 1);
        ValidationService.ValidationResult result = service.validateRequest(request(List.of(i)));
        assertThat(result.errors()).isEmpty();
        assertThat(result.warnings()).anyMatch(w -> w.contains("weight missing or zero"));
    }

    @Test
    void validRequestReturnsNoErrors() {
        ItemRequest i = item("SKU", 300, 200, 150, 5, 2);
        ValidationService.ValidationResult result = service.validateRequest(request(List.of(i)));
        assertThat(result.errors()).isEmpty();
    }
}
