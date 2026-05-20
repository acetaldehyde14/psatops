package com.psap.palletisation.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Parses uploaded CSV/XLSX/JSON files into item dicts.
 * Port of parser_service.py.
 */
@Service
public class ParserService {

    public record ParseResult(List<Map<String, Object>> items, List<String> warnings) {}

    private static final Map<String, List<String>> FIELD_ALIASES = new LinkedHashMap<>();
    private static final Map<String, List<String>> BOOL_CONSTRAINT_ALIASES = new LinkedHashMap<>();

    static {
        FIELD_ALIASES.put("sku", List.of("sku", "product_code", "product", "item", "item_code", "nia_item_code"));
        FIELD_ALIASES.put("quantity", List.of("quantity", "qty", "amount"));
        FIELD_ALIASES.put("length_mm", List.of("length_mm", "length"));
        FIELD_ALIASES.put("length_cm", List.of("length_cm"));
        FIELD_ALIASES.put("width_mm", List.of("width_mm", "width"));
        FIELD_ALIASES.put("width_cm", List.of("width_cm"));
        FIELD_ALIASES.put("height_mm", List.of("height_mm", "height"));
        FIELD_ALIASES.put("height_cm", List.of("height_cm"));
        FIELD_ALIASES.put("weight_kg", List.of("weight_kg", "weight"));
        FIELD_ALIASES.put("nia_item_code", List.of("nia_item_code"));
        FIELD_ALIASES.put("description_of_goods", List.of("description_of_goods"));
        FIELD_ALIASES.put("total_qty_pcs", List.of("total_qty_pcs"));
        FIELD_ALIASES.put("qty_per_ctn", List.of("qty_per_ctn"));
        FIELD_ALIASES.put("store_no", List.of("store_no", "store"));
        FIELD_ALIASES.put("dc_no", List.of("dc_no", "dc"));
        FIELD_ALIASES.put("center_label", List.of("center_label"));
        FIELD_ALIASES.put("center_expected_cartons", List.of("center_expected_cartons"));

        FIELD_ALIASES.put("stackability", List.of("stackability", "stack_rule", "stacking", "stack_type"));

        BOOL_CONSTRAINT_ALIASES.put("stand_upright_only", List.of("stand_upright_only", "upright_only", "must_stand_upright"));
        BOOL_CONSTRAINT_ALIASES.put("no_load_on_top", List.of("no_load_on_top", "noloadsontop", "no_loads_on_top", "no_stack_on_top", "top_load_forbidden"));
    }

    private static final Set<String> OPTIONAL_FIELDS = new HashSet<>(Arrays.asList(
            "item", "lot_no", "pallet_id", "description", "category_name",
            "organisation", "uom", "requested_delivery_date", "expiry_date",
            "location", "product_manufacturing_location", "country_of_origin",
            "store_no", "dc_no", "nia_item_code", "description_of_goods",
            "total_qty_pcs", "qty_per_ctn", "center_label", "center_expected_cartons"
    ));

    private final ObjectMapper objectMapper = new ObjectMapper();

    public ParseResult parseFile(byte[] content, String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".json")) {
            return parseJson(content);
        } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
            return parseExcel(content, filename);
        } else {
            return parseCsv(content);
        }
    }

    private ParseResult parseJson(byte[] content) {
        List<String> warnings = new ArrayList<>();
        try {
            Object parsed = objectMapper.readValue(content, Object.class);
            if (!(parsed instanceof List)) {
                return new ParseResult(List.of(), List.of("JSON upload must be an array of item rows."));
            }
            List<?> list = (List<?>) parsed;
            List<Map<String, Object>> records = new ArrayList<>();
            int skipped = 0;
            for (Object o : list) {
                if (o instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> row = (Map<String, Object>) o;
                    records.add(row);
                } else {
                    skipped++;
                }
            }
            if (skipped > 0) warnings.add("Skipped " + skipped + " non-object JSON row(s).");
            return new ParseResult(records, warnings);
        } catch (IOException e) {
            return new ParseResult(List.of(), List.of("Failed to parse JSON: " + e.getMessage()));
        }
    }

    private ParseResult parseCsv(byte[] content) {
        List<String> warnings = new ArrayList<>();
        List<Map<String, Object>> records = new ArrayList<>();
        try (CSVParser parser = CSVParser.parse(
                new InputStreamReader(new ByteArrayInputStream(content), StandardCharsets.UTF_8),
                CSVFormat.DEFAULT.withFirstRecordAsHeader().withTrim())) {

            Set<String> cols = normalizeHeaders(parser.getHeaderNames());
            Map<String, String> headerMap = buildHeaderMap(parser.getHeaderNames());

            int rowNo = 2;
            for (CSVRecord csvRecord : parser) {
                Map<String, Object> row = csvRecordToMap(csvRecord, parser.getHeaderNames());
                Map<String, Object> item = parseRow(row, cols, headerMap, rowNo, warnings);
                if (item != null) records.add(item);
                rowNo++;
            }
        } catch (IOException e) {
            warnings.add("Failed to parse CSV: " + e.getMessage());
        }
        return new ParseResult(records, warnings);
    }

    private ParseResult parseExcel(byte[] content, String filename) {
        List<String> warnings = new ArrayList<>();
        List<Map<String, Object>> records = new ArrayList<>();
        try (Workbook wb = WorkbookFactory.create(new ByteArrayInputStream(content))) {
            Sheet sheet = wb.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                warnings.add("Excel file has no header row.");
                return new ParseResult(records, warnings);
            }

            List<String> headers = new ArrayList<>();
            for (Cell cell : headerRow) {
                headers.add(cellToString(cell).strip().toLowerCase().replace(" ", "_"));
            }
            Set<String> cols = new HashSet<>(headers);
            Map<String, String> headerMap = new LinkedHashMap<>();
            for (String h : headers) headerMap.put(h, h);

            int rowNo = 2;
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) { rowNo++; continue; }
                Map<String, Object> rowMap = new LinkedHashMap<>();
                for (int j = 0; j < headers.size(); j++) {
                    Cell cell = row.getCell(j);
                    rowMap.put(headers.get(j), cell != null ? getCellValue(cell) : null);
                }
                Map<String, Object> item = parseRow(rowMap, cols, headerMap, rowNo, warnings);
                if (item != null) records.add(item);
                rowNo++;
            }
        } catch (IOException e) {
            warnings.add("Failed to parse Excel: " + e.getMessage());
        }
        return new ParseResult(records, warnings);
    }

    private Map<String, Object> parseRow(Map<String, Object> row, Set<String> cols,
                                           Map<String, String> headerMap, int rowNo, List<String> warnings) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("source_row", rowNo);
        item.put("line_id", "row-" + rowNo);

        // SKU
        Object skuVal = getField(row, "sku", cols);
        if (isMissing(skuVal)) { warnings.add("Row " + rowNo + ": missing sku; row skipped."); return null; }
        item.put("sku", skuVal.toString().strip());

        // Quantity
        Object qtyVal = getField(row, "quantity", cols);
        if (isMissing(qtyVal)) { warnings.add("Row " + rowNo + ": invalid or missing quantity; row skipped."); return null; }
        try { item.put("quantity", Double.parseDouble(qtyVal.toString())); }
        catch (NumberFormatException e) { warnings.add("Row " + rowNo + ": invalid or missing quantity; row skipped."); return null; }

        // Dimensions
        Double lengthMm = parseDimension(row, "length", cols, rowNo, warnings);
        Double widthMm  = parseDimension(row, "width",  cols, rowNo, warnings);
        Double heightMm = parseDimension(row, "height", cols, rowNo, warnings);
        if (lengthMm == null || widthMm == null || heightMm == null ||
                lengthMm <= 0 || widthMm <= 0 || heightMm <= 0) {
            warnings.add("Row " + rowNo + ": invalid or missing dimensions; row skipped.");
            return null;
        }
        item.put("length_mm", lengthMm);
        item.put("width_mm", widthMm);
        item.put("height_mm", heightMm);

        // Weight
        Object wt = getField(row, "weight_kg", cols);
        if (isMissing(wt)) {
            item.put("weight_kg", 0.0);
            warnings.add("Row " + rowNo + ": missing weight_kg; using 0.");
        } else {
            try { item.put("weight_kg", Double.parseDouble(wt.toString())); }
            catch (NumberFormatException e) { item.put("weight_kg", 0.0); }
        }

        // Optional string fields
        for (String f : OPTIONAL_FIELDS) {
            Object val = row.get(f);
            if (!isMissing(val)) item.put(f, val.toString());
        }
        for (String canonical : List.of("store_no", "dc_no")) {
            Object val = getField(row, canonical, cols);
            if (!isMissing(val)) item.put(canonical, val.toString());
        }
        for (String canonical : List.of("nia_item_code", "description_of_goods", "center_label")) {
            Object val = getField(row, canonical, cols);
            if (!isMissing(val)) item.put(canonical, val.toString());
        }
        // Stackability: pass through as-is (lowercased and stripped)
        Object stackabilityVal = getField(row, "stackability", cols);
        if (!isMissing(stackabilityVal)) item.put("stackability", stackabilityVal.toString().strip().toLowerCase());
        for (String canonical : List.of("total_qty_pcs", "qty_per_ctn", "center_expected_cartons")) {
            Object val = getField(row, canonical, cols);
            if (!isMissing(val)) {
                try { item.put(canonical, Double.parseDouble(val.toString())); }
                catch (NumberFormatException e) { warnings.add("Row " + rowNo + ": invalid value for " + canonical + "."); }
            }
        }

        // Boolean constraints
        for (Map.Entry<String, List<String>> entry : BOOL_CONSTRAINT_ALIASES.entrySet()) {
            Object val = null;
            for (String alias : entry.getValue()) {
                if (cols.contains(alias) && !isMissing(row.get(alias))) { val = row.get(alias); break; }
            }
            item.put(entry.getKey(), val != null && parseBool(val));
        }

        return item;
    }

    private Object getField(Map<String, Object> row, String canonical, Set<String> cols) {
        List<String> aliases = FIELD_ALIASES.get(canonical);
        if (aliases == null) return null;
        for (String alias : aliases) {
            if (cols.contains(alias)) {
                Object val = row.get(alias);
                if (!isMissing(val)) return val;
            }
        }
        return null;
    }

    private Double parseDimension(Map<String, Object> row, String axis, Set<String> cols, int rowNo, List<String> warnings) {
        Object mm = getField(row, axis + "_mm", cols);
        if (!isMissing(mm)) {
            try { return Double.parseDouble(mm.toString()); } catch (NumberFormatException e) {}
        }
        Object cm = getField(row, axis + "_cm", cols);
        if (!isMissing(cm)) {
            try { return Double.parseDouble(cm.toString()) * 10; } catch (NumberFormatException e) {}
        }
        return null;
    }

    private boolean isMissing(Object val) {
        return val == null || val.toString().trim().isEmpty();
    }

    private boolean parseBool(Object val) {
        if (val instanceof Boolean) return (Boolean) val;
        if (val instanceof Number) return ((Number) val).doubleValue() != 0;
        String s = val.toString().trim().toLowerCase();
        return s.equals("true") || s.equals("yes") || s.equals("y") || s.equals("1");
    }

    private Set<String> normalizeHeaders(List<String> headers) {
        Set<String> result = new LinkedHashSet<>();
        for (String h : headers) result.add(h.strip().toLowerCase().replace(" ", "_"));
        return result;
    }

    private Map<String, String> buildHeaderMap(List<String> headers) {
        Map<String, String> map = new LinkedHashMap<>();
        for (String h : headers) map.put(h.strip().toLowerCase().replace(" ", "_"), h);
        return map;
    }

    private Map<String, Object> csvRecordToMap(CSVRecord record, List<String> headers) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (String h : headers) {
            String key = h.strip().toLowerCase().replace(" ", "_");
            try { map.put(key, record.get(h)); } catch (Exception e) { map.put(key, null); }
        }
        return map;
    }

    private String cellToString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> DateUtil.isCellDateFormatted(cell)
                    ? cell.getLocalDateTimeCellValue().toString()
                    : String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }

    private Object getCellValue(Cell cell) {
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> DateUtil.isCellDateFormatted(cell)
                    ? cell.getLocalDateTimeCellValue().toString()
                    : cell.getNumericCellValue();
            case BOOLEAN -> cell.getBooleanCellValue();
            case BLANK -> null;
            default -> null;
        };
    }
}
