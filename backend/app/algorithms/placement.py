"""Shared placement validation helpers."""
from app.core.models import Box, Pallet

SUPPORT_THRESHOLD = 0.70
EPS = 0.01


def xy_overlap_area(ax: float, ay: float, al: float, aw: float, bx: float, by: float, bl: float, bw: float) -> float:
    ox = min(ax + al, bx + bl) - max(ax, bx)
    oy = min(ay + aw, by + bw) - max(ay, by)
    return ox * oy if ox > 0 and oy > 0 else 0.0


def support_fraction_for(box: Box, pallet: Pallet, x: float, y: float, z: float) -> float:
    if z <= EPS:
        return 1.0
    base = box.length * box.width
    if base == 0:
        return 1.0
    supported = 0.0
    for placed in pallet.boxes:
        if abs((placed.z + placed.height) - z) < 1.0:
            supported += xy_overlap_area(
                x, y, box.length, box.width,
                placed.x, placed.y, placed.length, placed.width,
            )
    return min(supported / base, 1.0)


def has_no_load_on_top_violation(box: Box, pallet: Pallet, x: float, y: float, z: float) -> bool:
    for placed in pallet.boxes:
        if not placed.no_load_on_top:
            continue
        if abs((placed.z + placed.height) - z) >= 1.0:
            continue
        if xy_overlap_area(
            x, y, box.length, box.width,
            placed.x, placed.y, placed.length, placed.width,
        ) > 1.0:
            return True
    return False


def placement_stability_ok(pallet: Pallet, box: Box, x: float, y: float, z: float, constraints) -> bool:
    if not bool(getattr(constraints, "do_not_allow_stability_issues", True)):
        return True
    if has_no_load_on_top_violation(box, pallet, x, y, z):
        return False
    return support_fraction_for(box, pallet, x, y, z) >= SUPPORT_THRESHOLD


def rotation_score(box: Box, constraints) -> float:
    if not bool(getattr(constraints, "prefer_larger_base", False)):
        return 0.0
    return -0.001 * (box.length * box.width) + 0.01 * box.height
