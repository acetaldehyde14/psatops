"""Parse uploaded CSV/Excel files into ItemRequest-compatible dicts."""
import io
from typing import List, Dict, Any, Tuple
import pandas as pd


REQUIRED_FIELDS = {"sku", "quantity", "length_mm", "width_mm", "height_mm", "weight_kg"}

OPTIONAL_FIELDS = {
    "item", "lot_no", "pallet_id", "description", "category_name",
    "organisation", "uom", "requested_delivery_date", "expiry_date",
    "location", "product_manufacturing_location", "country_of_origin",
    "store_no", "dc_no",
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


def parse_file(content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    warnings: List[str] = []

    if filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content))
    else:
        df = pd.read_csv(io.BytesIO(content))

    # Normalise column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    cols = set(df.columns)

    missing = REQUIRED_FIELDS - cols
    if missing:
        warnings.append(f"Missing required columns: {missing}. Attempting best-effort parse.")

    # Resolve constraint column aliases
    constraint_col_map: Dict[str, str | None] = {
        canon: _find_alias(cols, aliases)
        for canon, aliases in BOOL_CONSTRAINT_ALIASES.items()
    }

    records: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        item: Dict[str, Any] = {}

        # Required
        item["sku"] = str(row.get("sku", "UNKNOWN"))
        try:
            item["quantity"] = int(float(row.get("quantity", 1)))
        except (ValueError, TypeError):
            item["quantity"] = 1
        for dim in ("length_mm", "width_mm", "height_mm", "weight_kg"):
            try:
                item[dim] = float(row.get(dim, 100.0))
            except (ValueError, TypeError):
                item[dim] = 100.0
                warnings.append(f"Row {_}: invalid value for {dim}, defaulting to 100.")

        # Optional string fields
        for f in OPTIONAL_FIELDS:
            val = row.get(f)
            if val is not None and not (isinstance(val, float) and pd.isna(val)):
                item[f] = str(val)

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
