"""Rotation helpers shared by placement algorithms."""
from typing import List, Tuple
from app.core.models import Box

Rotation = Tuple[float, float, float, str]


def get_allowed_rotations(
    box: Box,
    allow_rotation: bool = True,
    prefer_larger_base: bool = False,
) -> List[Rotation]:
    """Return allowed rotations for a box in the requested preference order."""
    if not isinstance(allow_rotation, bool):
        constraints = allow_rotation
        allow_rotation = bool(getattr(constraints, "allow_rotation", True))
        prefer_larger_base = bool(getattr(constraints, "prefer_larger_base", prefer_larger_base))

    original_l = (
        getattr(box, "original_length_mm", None)
        or getattr(box, "original_length", None)
        or getattr(box, "length_mm", None)
        or box.length
    )
    original_w = (
        getattr(box, "original_width_mm", None)
        or getattr(box, "original_width", None)
        or getattr(box, "width_mm", None)
        or box.width
    )
    original_h = (
        getattr(box, "original_height_mm", None)
        or getattr(box, "original_height", None)
        or getattr(box, "height_mm", None)
        or box.height
    )

    if not allow_rotation:
        return [(original_l, original_w, original_h, getattr(box, "rotation", "LWH"))]

    rotations = [
        (original_l, original_w, original_h, "LWH"),
        (original_w, original_l, original_h, "WLH"),
        (original_l, original_h, original_w, "LHW"),
        (original_h, original_l, original_w, "HLW"),
        (original_w, original_h, original_l, "WHL"),
        (original_h, original_w, original_l, "HWL"),
    ]

    seen: set[tuple[float, float, float]] = set()
    unique: List[Rotation] = []
    for l, w, h, label in rotations:
        key = (round(l, 4), round(w, 4), round(h, 4))
        if key not in seen:
            seen.add(key)
            unique.append((l, w, h, label))

    if getattr(box, "stand_upright_only", False):
        unique = [
            (l, w, h, label)
            for l, w, h, label in unique
            if abs(h - original_h) < 1e-6
        ]

    if prefer_larger_base:
        unique.sort(
            key=lambda r: (
                -(r[0] * r[1]),
                r[2],
                -max(r[0], r[1]),
            )
        )

    return unique


def is_largest_base_orientation(box: Box, l: float, w: float, h: float) -> bool:
    rotations = get_allowed_rotations(box, allow_rotation=True, prefer_larger_base=True)
    if not rotations:
        return False
    max_base = max(rot_l * rot_w for rot_l, rot_w, _, _ in rotations)
    return abs((l * w) - max_base) < 1e-6
