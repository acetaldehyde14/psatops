package com.psap.palletisation.service;

import com.psap.palletisation.dto.response.BoxResult;
import com.psap.palletisation.dto.response.PalletResult;
import com.psap.palletisation.dto.response.PalletiseResponse;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringWriter;

/**
 * Export palletisation results to CSV.
 * Port of export_service.py using Apache Commons CSV.
 */
@Service
public class ExportService {

    private static final String[] HEADERS = {
            "job_id", "order_id", "algorithm", "layout_source",
            "pallet_no", "box_id", "sku", "lot_no",
            "x_mm", "y_mm", "z_mm",
            "length_mm", "width_mm", "height_mm",
            "weight_kg", "rotation", "layer", "pick_sequence", "location"
    };

    public String toCsv(PalletiseResponse result, String layoutSource) {
        StringWriter sw = new StringWriter();
        try (CSVPrinter printer = new CSVPrinter(sw, CSVFormat.DEFAULT.withHeader(HEADERS))) {
            for (PalletResult pallet : result.getPallets()) {
                for (BoxResult box : pallet.getBoxes()) {
                    printer.printRecord(
                            result.getJobId(),
                            result.getOrderId(),
                            result.getAlgorithmUsed(),
                            layoutSource,
                            pallet.getPalletNo(),
                            box.getBoxId(),
                            box.getSku(),
                            box.getLotNo() != null ? box.getLotNo() : "",
                            box.getXMm(),
                            box.getYMm(),
                            box.getZMm(),
                            box.getLengthMm(),
                            box.getWidthMm(),
                            box.getHeightMm(),
                            box.getWeightKg(),
                            box.getRotation(),
                            box.getLayer(),
                            box.getPickSequence(),
                            box.getLocation() != null ? box.getLocation() : ""
                    );
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate CSV", e);
        }
        return sw.toString();
    }
}
