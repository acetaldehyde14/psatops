"""
3D Extreme Point Bin Packing.

After each placement, new extreme points are generated at the corners
of placed boxes, pruned to those reachable from below.
"""
from typing import List, Set, Tuple
from app.core.models import Box, Pallet


Point = Tuple[float, float, float]


def _overlaps(ax, ay, az, al, aw, ah, bx, by, bz, bl, bw, bh) -> bool:
    EPS = 0.01
    return (
        ax < bx + bl - EPS and ax + al > bx + EPS
        and ay < by + bw - EPS and ay + aw > by + EPS
        and az < bz + bh - EPS and az + ah > bz + EPS
    )


def _can_place_ep(pallet: Pallet, box: Box, x: float, y: float, z: float) -> bool:
    l, w, h = box.length, box.width, box.height
    EPS = 0.01
    if x + l > pallet.length + EPS:
        return False
    if y + w > pallet.width + EPS:
        return False
    if z + h > pallet.max_height + EPS:
        return False
    if pallet.used_weight + box.weight > pallet.max_weight + 0.001:
        return False
    for placed in pallet.boxes:
        if _overlaps(x, y, z, l, w, h,
                     placed.x, placed.y, placed.z,
                     placed.length, placed.width, placed.height):
            return False
    return True


def _generate_extreme_points(pallet: Pallet) -> List[Point]:
    """Generate new extreme points after placement."""
    if not pallet.boxes:
        return [(0.0, 0.0, 0.0)]

    points: Set[Point] = {(0.0, 0.0, 0.0)}
    for b in pallet.boxes:
        points.add((b.x + b.length, b.y, b.z))
        points.add((b.x, b.y + b.width, b.z))
        points.add((b.x, b.y, b.z + b.height))

    # Clamp to pallet bounds
    valid = []
    for px, py, pz in points:
        if px <= pallet.length + 0.01 and py <= pallet.width + 0.01 and pz <= pallet.max_height + 0.01:
            valid.append((px, py, pz))

    return valid


def _place_box_ep(pallet: Pallet, box: Box, allow_rotation: bool) -> bool:
    """Try to place box at an extreme point. Returns True if placed."""
    points = _generate_extreme_points(pallet)
    # Sort by z, then x, then y (gravity-first)
    points.sort(key=lambda p: (p[2], p[0], p[1]))

    for pt in points:
        x, y, z = pt
        for rot in box.rotations(allow_rotation):
            box.length, box.width, box.height, box.rotation = rot
            if _can_place_ep(pallet, box, x, y, z):
                box.x, box.y, box.z = x, y, z
                box.placed = True
                box.layer = int(z // 250) + 1
                pallet.boxes.append(box)
                return True

    return False


def run_extreme_point(
    boxes: List[Box],
    pallet_spec,
    allow_rotation: bool = True,
) -> List[Pallet]:
    sorted_boxes = sorted(boxes, key=lambda b: b.volume, reverse=True)
    pallets: List[Pallet] = []
    pallet_no = 1

    def new_pallet():
        nonlocal pallet_no
        p = Pallet(
            length=pallet_spec.length_mm,
            width=pallet_spec.width_mm,
            max_height=pallet_spec.max_height_mm,
            max_weight=pallet_spec.max_weight_kg,
            pallet_no=pallet_no,
        )
        pallets.append(p)
        pallet_no += 1
        return p

    current = new_pallet()

    for box in sorted_boxes:
        placed = False
        for pallet in pallets:
            if _place_box_ep(pallet, box, allow_rotation):
                placed = True
                break
        if not placed:
            current = new_pallet()
            if not _place_box_ep(current, box, allow_rotation):
                box.x, box.y, box.z = 0.0, 0.0, 0.0
                box.placed = True
                current.boxes.append(box)

    for pallet in pallets:
        for i, b in enumerate(sorted(pallet.boxes, key=lambda x: (x.layer, x.z, x.x, x.y)), start=1):
            b.pick_sequence = i

    return pallets
