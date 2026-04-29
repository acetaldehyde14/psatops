"""Stability validation for placed boxes."""
from typing import List, Tuple
from app.core.models import Box, Pallet


def _overlaps_xy(b1: Box, b2: Box) -> bool:
    """Check if two boxes overlap in the XY plane."""
    return (
        b1.x < b2.x + b2.length
        and b1.x + b1.length > b2.x
        and b1.y < b2.y + b2.width
        and b1.y + b1.width > b2.y
    )


def support_area_fraction(box: Box, boxes_below: List[Box]) -> float:
    """Return fraction of box base area supported by boxes below."""
    if not boxes_below:
        return 0.0

    total = box.length * box.width
    if total == 0:
        return 1.0

    supported = 0.0
    for below in boxes_below:
        ox_start = max(box.x, below.x)
        ox_end = min(box.x + box.length, below.x + below.length)
        oy_start = max(box.y, below.y)
        oy_end = min(box.y + box.width, below.y + below.width)
        if ox_end > ox_start and oy_end > oy_start:
            supported += (ox_end - ox_start) * (oy_end - oy_start)

    return min(supported / total, 1.0)


def validate_pallet(pallet: Pallet) -> Tuple[int, int, List[str]]:
    """
    Returns (floating_count, unstable_count, warnings).
    A box is floating if z > 0 and not supported.
    A box is unstable if support_area < 50%.
    """
    floating = 0
    unstable = 0
    warnings: List[str] = []

    for box in pallet.boxes:
        if box.z == 0:
            continue  # on the floor

        # Find boxes whose top face is at box.z
        supporting = [
            b for b in pallet.boxes
            if b is not box and abs((b.z + b.height) - box.z) < 0.1
            and _overlaps_xy(box, b)
        ]

        if not supporting:
            floating += 1
            warnings.append(
                f"Box {box.box_id} (SKU {box.sku}) at z={box.z:.1f} has no support."
            )
        else:
            frac = support_area_fraction(box, supporting)
            if frac < 0.5:
                unstable += 1
                warnings.append(
                    f"Box {box.box_id} (SKU {box.sku}) has only {frac*100:.0f}% support."
                )

    return floating, unstable, warnings
