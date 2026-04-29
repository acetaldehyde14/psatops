"""Validate palletise requests."""
from typing import List
from app.core.schemas import PalletiseRequest


def validate_request(req: PalletiseRequest) -> List[str]:
    warnings = []
    for item in req.items:
        if item.length_mm <= 0 or item.width_mm <= 0 or item.height_mm <= 0:
            warnings.append(f"SKU {item.sku}: dimensions must be positive.")
        if item.weight_kg <= 0:
            warnings.append(f"SKU {item.sku}: weight must be positive.")
        if item.quantity <= 0:
            warnings.append(f"SKU {item.sku}: quantity must be positive.")
        # Check if single box fits on pallet
        fits = (
            item.length_mm <= req.pallet.length_mm
            or item.width_mm <= req.pallet.length_mm
        ) and (
            item.length_mm <= req.pallet.width_mm
            or item.width_mm <= req.pallet.width_mm
        )
        if not fits:
            warnings.append(
                f"SKU {item.sku}: box ({item.length_mm}x{item.width_mm}) may not fit pallet footprint."
            )
    return warnings
