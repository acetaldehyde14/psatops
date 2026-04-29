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


def parse_file(content: bytes, filename: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    warnings: List[str] = []

    if filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content))
    else:
        df = pd.read_csv(io.BytesIO(content))

    # Normalise column names
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = REQUIRED_FIELDS - set(df.columns)
    if missing:
        warnings.append(f"Missing required columns: {missing}. Attempting best-effort parse.")

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

        # Optional
        for f in OPTIONAL_FIELDS:
            val = row.get(f)
            if val is not None and not (isinstance(val, float) and pd.isna(val)):
                item[f] = str(val)

        records.append(item)

    return records, warnings
