"""Stability validation for placed boxes."""
from typing import List, Tuple
from app.core.models import Box, Pallet
from app.core.schemas import StabilityIssue
from app.algorithms.placement import SUPPORT_THRESHOLD


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


def validate_pallet(pallet: Pallet) -> Tuple[int, int, List[str], List[StabilityIssue]]:
    """
    Returns (floating_count, unstable_count, warnings).
    A box is floating if z > 0 and not supported.
    A box is unstable if support_area < SUPPORT_THRESHOLD.
    """
    floating = 0
    unstable = 0
    warnings: List[str] = []
    issues: List[StabilityIssue] = []

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
            message = f"Box {box.box_id} (SKU {box.sku}) at z={box.z:.1f} has no support."
            warnings.append(message)
            issues.append(
                StabilityIssue(
                    type="floating",
                    severity="error",
                    box_id=box.box_id,
                    pallet_no=pallet.pallet_no,
                    sku=box.sku,
                    message="Box is floating or has insufficient support",
                )
            )
        else:
            frac = support_area_fraction(box, supporting)
            if frac < SUPPORT_THRESHOLD:
                unstable += 1
                message = f"Box {box.box_id} (SKU {box.sku}) has only {frac*100:.0f}% support."
                warnings.append(message)
                issues.append(
                    StabilityIssue(
                        type="unstable",
                        severity="warning",
                        box_id=box.box_id,
                        pallet_no=pallet.pallet_no,
                        sku=box.sku,
                        message=message,
                    )
                )

    for base in pallet.boxes:
        if not base.no_load_on_top:
            continue
        top_z = base.z + base.height
        for other in pallet.boxes:
            if other is base or abs(other.z - top_z) >= 1.0:
                continue
            if support_area_fraction(other, [base]) > 0:
                message = (
                    f"Box {other.box_id} (SKU {other.sku}) is on top of "
                    f"{base.box_id}, which has no_load_on_top."
                )
                warnings.append(message)
                issues.append(
                    StabilityIssue(
                        type="no_load_on_top",
                        severity="warning",
                        box_id=other.box_id,
                        pallet_no=pallet.pallet_no,
                        sku=other.sku,
                        message=message,
                    )
                )

    return floating, unstable, warnings, issues
