"""Parse uploaded CSV/Excel files into ItemRequest-compatible dicts."""
import io
import json
from typing import List, Dict, Any, Tuple
import pandas as pd


REQUIRED_FIELDS = {"sku", "quantity", "length_mm", "width_mm", "height_mm"}

FIELD_ALIASES: Dict[str, List[str]] = {
    "sku": ["sku", "product_code", "product", "item", "item_code", "nia_item_code"],
    "quantity": ["quantity", "qty", "amount"],
    "length_mm": ["length_mm", "length"],
    "length_cm": ["length_cm"],
    "width_mm": ["width_mm", "width"],
    "width_cm": ["width_cm"],
    "height_mm": ["height_mm", "height"],
    "height_cm": ["height_cm"],
    "weight_kg": ["weight_kg", "weight"],
    "nia_item_code": ["nia_item_code"],
    "description_of_goods": ["description_of_goods"],
    "total_qty_pcs": ["total_qty_pcs"],
    "qty_per_ctn": ["qty_per_ctn"],
    "store_no": ["store_no", "store"],
    "dc_no": ["dc_no", "dc"],
    "center_label": ["center_label"],
    "center_expected_cartons": ["center_expected_cartons"],
}

OPTIONAL_FIELDS = {
    "item", "lot_no", "pallet_id", "description", "category_name",
    "organisation", "uom", "requested_delivery_date", "expiry_date",
    "location", "product_manufacturing_location", "country_of_origin",
    "store_no", "dc_no", "nia_item_code", "description_of_goods",
    "total_qty_pcs", "qty_per_ctn", "center_label", "center_expected_cartons",
}

# Maps canonical field name → list of accepted column aliases
BOOL_CONSTRAINT_ALIASES: Dict[str, List[str]] = {
    "stand_upright_only": ["stand_upright_only", "upright_only", "must_stand_upright"],
    "no_load_on_top": ["no_load_on_top", "no_stack_on_top", "top_load_forbidden"],
}


def _parse_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return bool(val) if not pd.isna(val) else False  # type: ignore[arg-type]
    s = str(val).strip().lower()
    return s in ("true", "yes", "y", "1")


def _find_alias(cols: set, aliases: List[str]) -> str | None:
    for alias in aliases:
        if alias in cols:
            return alias
    return None


def _is_missing(val: Any) -> bool:
    return val is None or bool(pd.isna(val)) or str(val).strip() == ""


def _get(row: pd.Series, cols: set, canonical: str) -> Any:
    col = _find_alias(cols, FIELD_ALIASES[canonical])
    if col is None:
        return None
    return row.get(col)


def _parse_float(row: pd.Series, cols: set, field: str, row_no: int, warnings: List[str], required: bool = True) -> float | None:
    val = _get(row, cols, field)
    if _is_missing(val):
        if required:
            warnings.append(f"Row {row_no}: missing {field}.")
        return None
    try:
        parsed = float(val)
    except (ValueError, TypeError):
        warnings.append(f"Row {row_no}: invalid value for {field}.")
        return None
    return parsed


def _parse_dimension(row: pd.Series, cols: set, axis: str, row_no: int, warnings: List[str]) -> float | None:
    mm = _parse_float(row, cols, f"{axis}_mm", row_no, warnings, required=False)
    if mm is not None:
        return mm
    cm = _parse_float(row, cols, f"{axis}_cm", row_no, warnings, required=False)
    if cm is not None:
        return cm * 10
    warnings.append(f"Row {row_no}: missing {axis}_mm.")
    return None


def parse_file(content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    warnings: List[str] = []

    lower_filename = filename.lower()
    if lower_filename.endswith(".json"):
        parsed = json.loads(content.decode("utf-8"))
        if not isinstance(parsed, list):
            return [], ["JSON upload must be an array of item rows."]
        records = [row for row in parsed if isinstance(row, dict)]
        skipped = len(parsed) - len(records)
        if skipped:
            warnings.append(f"Skipped {skipped} non-object JSON row(s).")
        return records, warnings
    if lower_filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content))
    else:
        df = pd.read_csv(io.BytesIO(content))

    # Normalise column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    cols = set(df.columns)

    missing = [
        field for field in REQUIRED_FIELDS
        if _find_alias(cols, FIELD_ALIASES[field]) is None
        and (field not in {"length_mm", "width_mm", "height_mm"} or _find_alias(cols, FIELD_ALIASES[field.replace("_mm", "_cm")]) is None)
    ]
    if missing:
        warnings.append(f"Missing required columns: {sorted(missing)}.")

    # Resolve constraint column aliases
    constraint_col_map: Dict[str, str | None] = {
        canon: _find_alias(cols, aliases)
        for canon, aliases in BOOL_CONSTRAINT_ALIASES.items()
    }

    records: List[Dict[str, Any]] = []
    for idx, row in df.iterrows():
        row_no = int(idx) + 2
        item: Dict[str, Any] = {}
        item["source_row"] = row_no
        item["line_id"] = f"row-{row_no}"

        sku = _get(row, cols, "sku")
        if _is_missing(sku):
            warnings.append(f"Row {row_no}: missing sku; row skipped.")
            continue
        item["sku"] = str(sku).strip()

        try:
            quantity = _get(row, cols, "quantity")
            if _is_missing(quantity):
                raise ValueError
            item["quantity"] = float(quantity)
        except (ValueError, TypeError):
            warnings.append(f"Row {row_no}: invalid or missing quantity; row skipped.")
            continue

        dims = {
            "length_mm": _parse_dimension(row, cols, "length", row_no, warnings),
            "width_mm": _parse_dimension(row, cols, "width", row_no, warnings),
            "height_mm": _parse_dimension(row, cols, "height", row_no, warnings),
        }
        if any(value is None or value <= 0 for value in dims.values()):
            warnings.append(f"Row {row_no}: invalid or missing dimensions; row skipped.")
            continue
        item.update(dims)

        weight = _parse_float(row, cols, "weight_kg", row_no, warnings, required=False)
        if weight is None:
            weight = 0
            warnings.append(f"Row {row_no}: missing weight_kg; using 0.")
        item["weight_kg"] = weight

        # Optional string fields
        for f in OPTIONAL_FIELDS:
            val = row.get(f)
            if val is not None and not (isinstance(val, float) and pd.isna(val)):
                item[f] = str(val)

        for canonical in ("store_no", "dc_no"):
            val = _get(row, cols, canonical)
            if not _is_missing(val):
                item[canonical] = str(val)

        for canonical in ("nia_item_code", "description_of_goods", "center_label"):
            val = _get(row, cols, canonical)
            if not _is_missing(val):
                item[canonical] = str(val)

        for canonical in ("total_qty_pcs", "qty_per_ctn", "center_expected_cartons"):
            val = _get(row, cols, canonical)
            if not _is_missing(val):
                try:
                    item[canonical] = float(val)
                except (ValueError, TypeError):
                    warnings.append(f"Row {row_no}: invalid value for {canonical}.")

        # Boolean constraint fields
        for canon, col in constraint_col_map.items():
            if col and col in row.index:
                val = row[col]
                if not (isinstance(val, float) and pd.isna(val)):
                    item[canon] = _parse_bool(val)
                else:
                    item[canon] = False
            else:
                item[canon] = False

        records.append(item)

    return records, warnings
