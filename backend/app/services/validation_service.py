"""Validate palletise requests and manually adjusted layouts."""
from typing import List, Tuple
from app.core.schemas import PalletiseRequest, LayoutPatchRequest, AdjustmentValidation


def validate_request(req: PalletiseRequest) -> List[str]:
    warnings = []
    for item in req.items:
        if item.length_mm <= 0 or item.width_mm <= 0 or item.height_mm <= 0:
            warnings.append(f"SKU {item.sku}: dimensions must be positive.")
        if item.weight_kg <= 0:
            warnings.append(f"SKU {item.sku}: weight must be positive.")
        if item.quantity <= 0:
            warnings.append(f"SKU {item.sku}: quantity must be positive.")
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


def _boxes_overlap(ax, ay, az, al, aw, ah, bx, by, bz, bl, bw, bh) -> bool:
    EPS = 0.5  # 0.5 mm tolerance
    return (
        ax < bx + bl - EPS and ax + al > bx + EPS
        and ay < by + bw - EPS and ay + aw > by + EPS
        and az < bz + bh - EPS and az + ah > bz + EPS
    )


def _support_fraction(box, others) -> float:
    """Fraction of box base area supported by boxes directly below."""
    total = box["length_mm"] * box["width_mm"]
    if total == 0:
        return 1.0
    supported = 0.0
    for b in others:
        if abs((b["z_mm"] + b["height_mm"]) - box["z_mm"]) < 1.0:
            ox1 = max(box["x_mm"], b["x_mm"])
            ox2 = min(box["x_mm"] + box["length_mm"], b["x_mm"] + b["length_mm"])
            oy1 = max(box["y_mm"], b["y_mm"])
            oy2 = min(box["y_mm"] + box["width_mm"], b["y_mm"] + b["width_mm"])
            if ox2 > ox1 and oy2 > oy1:
                supported += (ox2 - ox1) * (oy2 - oy1)
    return min(supported / total, 1.0)


def validate_adjusted_layout(
    layout: LayoutPatchRequest,
    pallet_config: dict,
    original_box_ids: set,
) -> AdjustmentValidation:
    """
    Full validation of a manually adjusted layout.
    pallet_config: {"length_mm", "width_mm", "max_height_mm", "max_weight_kg"}
    original_box_ids: set of box_ids from the generated result (for missing/extra checks)
    """
    errors: List[str] = []
    warnings: List[str] = []

    seen_ids: set = set()
    all_submitted_ids: set = set()

    L = pallet_config["length_mm"]
    W = pallet_config["width_mm"]
    H = pallet_config["max_height_mm"]
    max_w = pallet_config["max_weight_kg"]

    for pallet in layout.pallets:
        pallet_weight = 0.0
        boxes = [b.model_dump() for b in pallet.boxes]

        for box in boxes:
            bid = box["box_id"]

            # Duplicate box_id
            if bid in seen_ids:
                errors.append(f"Duplicate box_id '{bid}' in pallet {pallet.pallet_no}.")
            seen_ids.add(bid)
            all_submitted_ids.add(bid)

            x, y, z = box["x_mm"], box["y_mm"], box["z_mm"]
            l, w, h = box["length_mm"], box["width_mm"], box["height_mm"]

            # Positive dimensions
            if l <= 0 or w <= 0 or h <= 0:
                errors.append(f"Box '{bid}': dimensions must be positive.")

            # Boundary checks
            if x < -0.5 or y < -0.5 or z < -0.5:
                errors.append(f"Box '{bid}': position ({x:.1f},{y:.1f},{z:.1f}) is outside pallet (negative coords).")
            if x + l > L + 0.5:
                errors.append(f"Box '{bid}': exceeds pallet length ({x+l:.1f} > {L}).")
            if y + w > W + 0.5:
                errors.append(f"Box '{bid}': exceeds pallet width ({y+w:.1f} > {W}).")
            if z + h > H + 0.5:
                errors.append(f"Box '{bid}': exceeds pallet max height ({z+h:.1f} > {H}).")

            pallet_weight += box.get("weight_kg", 0)

        # Weight check
        if pallet_weight > max_w + 0.001:
            errors.append(
                f"Pallet {pallet.pallet_no}: total weight {pallet_weight:.2f} kg exceeds max {max_w} kg."
            )

        # Overlap checks (O(n²) — acceptable for pallet scale)
        for i, a in enumerate(boxes):
            for j, b in enumerate(boxes):
                if i >= j:
                    continue
                if _boxes_overlap(
                    a["x_mm"], a["y_mm"], a["z_mm"], a["length_mm"], a["width_mm"], a["height_mm"],
                    b["x_mm"], b["y_mm"], b["z_mm"], b["length_mm"], b["width_mm"], b["height_mm"],
                ):
                    errors.append(
                        f"Pallet {pallet.pallet_no}: boxes '{a['box_id']}' and '{b['box_id']}' overlap."
                    )

        # Support / floating checks
        for box in boxes:
            if box["z_mm"] < 0.5:
                continue  # on the floor
            others = [b for b in boxes if b["box_id"] != box["box_id"]]
            frac = _support_fraction(box, others)
            if frac == 0.0:
                errors.append(
                    f"Pallet {pallet.pallet_no}: box '{box['box_id']}' is floating (no support at z={box['z_mm']:.1f})."
                )
            elif frac < 0.5:
                warnings.append(
                    f"Pallet {pallet.pallet_no}: box '{box['box_id']}' has only {frac*100:.0f}% support (unstable)."
                )

    # Missing / extra box checks
    missing = original_box_ids - all_submitted_ids
    extra = all_submitted_ids - original_box_ids
    for bid in sorted(missing):
        warnings.append(f"Box '{bid}' from original layout is missing in adjusted layout.")
    for bid in sorted(extra):
        errors.append(f"Box '{bid}' is not in the original layout (unknown box).")

    return AdjustmentValidation(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
    )
