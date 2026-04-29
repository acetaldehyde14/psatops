"""First Fit Decreasing (FFD) bin packing algorithm."""
from typing import List
from app.core.models import Box, Pallet


def _can_place(pallet: Pallet, box: Box, x: float, y: float, z: float) -> bool:
    l, w, h = box.length, box.width, box.height
    if x + l > pallet.length + 0.01:
        return False
    if y + w > pallet.width + 0.01:
        return False
    if z + h > pallet.max_height + 0.01:
        return False
    if pallet.used_weight + box.weight > pallet.max_weight + 0.001:
        return False
    for placed in pallet.boxes:
        if (x < placed.x + placed.length - 0.01
                and x + l > placed.x + 0.01
                and y < placed.y + placed.width - 0.01
                and y + w > placed.y + 0.01
                and z < placed.z + placed.height - 0.01
                and z + h > placed.z + 0.01):
            return False
    return True


def _find_position(pallet: Pallet, box: Box, allow_rotation: bool):
    """Scan grid positions left-to-right, front-to-back, bottom-to-top."""
    for rot in box.rotations(allow_rotation):
        box.length, box.width, box.height, box.rotation = rot
        # Build candidate z heights per (x, y) column
        z_top = 0.0
        if pallet.boxes:
            z_top = max(b.z + b.height for b in pallet.boxes)

        # Try to place at z=0 first with a simple row sweep
        step_x = box.length
        step_y = box.width
        z = 0.0
        x = 0.0
        while x + box.length <= pallet.length + 0.01:
            y = 0.0
            while y + box.width <= pallet.width + 0.01:
                # Determine z: top of the highest box in this footprint
                z = _find_z(pallet, box, x, y)
                if _can_place(pallet, box, x, y, z):
                    return x, y, z
                y += step_y
            x += step_x
    return None


def _find_z(pallet: Pallet, box: Box, x: float, y: float) -> float:
    z = 0.0
    for placed in pallet.boxes:
        if (x < placed.x + placed.length - 0.01
                and x + box.length > placed.x + 0.01
                and y < placed.y + placed.width - 0.01
                and y + box.width > placed.y + 0.01):
            z = max(z, placed.z + placed.height)
    return z


def run_first_fit(
    boxes: List[Box],
    pallet_spec,
    allow_rotation: bool = True,
) -> List[Pallet]:
    # Sort by volume descending (FFD)
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
            pos = _find_position(pallet, box, allow_rotation)
            if pos is not None:
                box.x, box.y, box.z = pos
                box.placed = True
                box.layer = int(box.z // 250) + 1
                pallet.boxes.append(box)
                placed = True
                break
        if not placed:
            current = new_pallet()
            pos = _find_position(current, box, allow_rotation)
            if pos is not None:
                box.x, box.y, box.z = pos
                box.placed = True
                box.layer = int(box.z // 250) + 1
                current.boxes.append(box)
            else:
                # Force place at 0,0,0 as fallback
                box.x, box.y, box.z = 0.0, 0.0, 0.0
                box.placed = True
                current.boxes.append(box)

    # Assign pick sequences
    for pallet in pallets:
        for i, b in enumerate(sorted(pallet.boxes, key=lambda x: (x.layer, x.z, x.x, x.y)), start=1):
            b.pick_sequence = i

    return pallets
