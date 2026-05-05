"""Best Fit placement - place box where residual space is minimised."""
import os
from typing import List, Optional, Tuple
from app.core.models import Box, Pallet
from app.algorithms.first_fit import _can_place, _find_z
from app.algorithms.rotations import get_allowed_rotations
from app.algorithms.placement import rotation_score


def _residual_volume(pallet: Pallet) -> float:
    cap = pallet.length * pallet.width * pallet.max_height
    return cap - pallet.used_volume


def _find_best_position(pallet: Pallet, box: Box, allow_rotation, prefer_larger_base=False):
    best_pos = None
    best_score = float("inf")
    constraints = allow_rotation

    rotations = get_allowed_rotations(box, allow_rotation, prefer_larger_base)
    if os.getenv("DEBUG"):
        print(
            f"prefer_larger_base={prefer_larger_base}, "
            f"box={box.sku}, rotations={rotations}"
        )
    for rot in rotations:
        orig = (box.length, box.width, box.height, box.rotation)
        box.length, box.width, box.height, box.rotation = rot

        step_x = box.length
        step_y = box.width
        x = 0.0
        while x + box.length <= pallet.length + 0.01:
            y = 0.0
            while y + box.width <= pallet.width + 0.01:
                z = _find_z(pallet, box, x, y)
                if _can_place(pallet, box, x, y, z, constraints):
                    score = z + rotation_score(box, constraints)
                    if score < best_score:
                        best_score = score
                        best_pos = (x, y, z, box.length, box.width, box.height, box.rotation)
                y += step_y
            x += step_x

        box.length, box.width, box.height, box.rotation = orig

    return best_pos


def run_best_fit(
    boxes: List[Box],
    pallet_spec,
    allow_rotation=True,
    prefer_larger_base=False,
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

    for box in sorted_boxes:
        # Find the pallet where residual volume is smallest after placing (best fit)
        best_pallet = None
        best_pos = None
        best_residual = float("inf")

        for pallet in pallets:
            pos = _find_best_position(pallet, box, allow_rotation, prefer_larger_base)
            if pos is not None:
                residual = _residual_volume(pallet) - box.volume
                if residual < best_residual:
                    best_residual = residual
                    best_pallet = pallet
                    best_pos = pos

        if best_pallet is None:
            best_pallet = new_pallet()
            best_pos = _find_best_position(best_pallet, box, allow_rotation, prefer_larger_base)

        if best_pos is not None:
            box.x, box.y, box.z = best_pos[0], best_pos[1], best_pos[2]
            box.length, box.width, box.height, box.rotation = best_pos[3], best_pos[4], best_pos[5], best_pos[6]
            box.placed = True
            box.layer = int(box.z // 250) + 1
            best_pallet.boxes.append(box)
        else:
            p = new_pallet()
            box.placed = False

    for pallet in pallets:
        for i, b in enumerate(sorted(pallet.boxes, key=lambda x: (x.layer, x.z, x.x, x.y)), start=1):
            b.pick_sequence = i

    return pallets
