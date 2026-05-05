"""
Comprehensive validation for manually adjusted pallet layouts.

All geometry uses mm.  Boxes are axis-aligned rectangular prisms.
"""
import re
from typing import List, Dict, Optional
from app.core.schemas import (
    LayoutPatchRequest, AdjustmentValidation, BoxResult,
    ManualAdjustmentSettings, StabilityIssue,
)

SUPPORT_THRESHOLD = 0.70   # 70 % of base area must be supported


def _issue_type(message: str) -> str:
    msg = message.lower()
    if "floating" in msg or "support" in msg:
        return "floating" if "no support" in msg or "floating" in msg else "unstable"
    if "overlap" in msg:
        return "overlap"
    if "threshold" in msg or "edge" in msg or "outside" in msg:
        return "boundary"
    if "height" in msg:
        return "height"
    if "no_load_on_top" in msg:
        return "no_load_on_top"
    if "stand_upright_only" in msg:
        return "stand_upright_only"
    if "duplicate" in msg:
        return "duplicate"
    if "missing" in msg:
        return "missing"
    return "validation"


def _box_ids_from_message(message: str) -> List[str]:
    ids = re.findall(r"[Bb]ox(?:es)? '?([A-Za-z0-9_-]+)'?", message)
    ids.extend(re.findall(r"and '([A-Za-z0-9_-]+)'", message))
    ids.extend(re.findall(r"of '([A-Za-z0-9_-]+)'", message))
    ids.extend(re.findall(r"Duplicate box_id '([A-Za-z0-9_-]+)'", message))
    return list(dict.fromkeys(ids))


def _issues_from_messages(
    errors: List[str],
    warnings: List[str],
    box_meta: Dict[str, tuple[int, Optional[str]]],
) -> List[StabilityIssue]:
    issues: List[StabilityIssue] = []
    for severity, messages in (("error", errors), ("warning", warnings)):
        for message in messages:
            ids = _box_ids_from_message(message)
            if not ids:
                issues.append(
                    StabilityIssue(
                        type=_issue_type(message),
                        severity=severity,
                        message=message,
                    )
                )
                continue
            for bid in ids:
                pallet_no, sku = box_meta.get(bid, (None, None))
                issues.append(
                    StabilityIssue(
                        type=_issue_type(message),
                        severity=severity,
                        box_id=bid,
                        pallet_no=pallet_no,
                        sku=sku,
                        message=message,
                    )
                )
    return issues


# ─────────────────────────────────────────────────────────────────────────────
# Geometry helpers
# ─────────────────────────────────────────────────────────────────────────────

def _overlaps(ax, ay, az, al, aw, ah, bx, by, bz, bl, bw, bh) -> bool:
    """Return True if two boxes have overlapping (non-touching) volume."""
    EPS = 0.5  # 0.5 mm tolerance — touching faces are OK
    return (
        ax < bx + bl - EPS and ax + al > bx + EPS
        and ay < by + bw - EPS and ay + aw > by + EPS
        and az < bz + bh - EPS and az + ah > bz + EPS
    )


def _xy_overlap_area(ax, ay, al, aw, bx, by, bl, bw) -> float:
    """Return the overlapping area in the XY plane between two box footprints."""
    ox = min(ax + al, bx + bl) - max(ax, bx)
    oy = min(ay + aw, by + bw) - max(ay, by)
    if ox <= 0 or oy <= 0:
        return 0.0
    return ox * oy


# ─────────────────────────────────────────────────────────────────────────────
# Individual check functions
# ─────────────────────────────────────────────────────────────────────────────

def check_boundary_with_threshold(
    boxes: List[dict],
    pallet: dict,
    settings: ManualAdjustmentSettings,
    errors: List[str],
) -> None:
    tl = settings.edge_threshold_length_mm
    tw = settings.edge_threshold_width_mm
    L = pallet["length_mm"]
    W = pallet["width_mm"]

    for b in boxes:
        bid = b["box_id"]
        x, y = b["x_mm"], b["y_mm"]
        l, w = b["length_mm"], b["width_mm"]

        if x < tl - 0.5:
            errors.append(f"Box '{bid}': x={x:.1f} violates length edge threshold ({tl} mm).")
        if y < tw - 0.5:
            errors.append(f"Box '{bid}': y={y:.1f} violates width edge threshold ({tw} mm).")
        if x + l > L - tl + 0.5:
            errors.append(f"Box '{bid}': right edge {x+l:.1f} violates length edge threshold (max {L-tl:.1f}).")
        if y + w > W - tw + 0.5:
            errors.append(f"Box '{bid}': front edge {y+w:.1f} violates width edge threshold (max {W-tw:.1f}).")


def check_max_height(boxes: List[dict], pallet: dict, errors: List[str]) -> None:
    H = pallet["max_height_mm"]
    for b in boxes:
        top = b["z_mm"] + b["height_mm"]
        if top > H + 0.5:
            errors.append(f"Box '{b['box_id']}': top {top:.1f} mm exceeds pallet max height {H} mm.")


def check_max_weight(
    boxes: List[dict],
    pallet_no: int,
    pallet: dict,
    errors: List[str],
) -> None:
    total = sum(b.get("weight_kg", 0) for b in boxes)
    if total > pallet["max_weight_kg"] + 0.001:
        errors.append(
            f"Pallet {pallet_no}: total weight {total:.2f} kg exceeds max {pallet['max_weight_kg']} kg."
        )


def check_overlap(boxes: List[dict], pallet_no: int, errors: List[str]) -> None:
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            if _overlaps(
                a["x_mm"], a["y_mm"], a["z_mm"], a["length_mm"], a["width_mm"], a["height_mm"],
                b["x_mm"], b["y_mm"], b["z_mm"], b["length_mm"], b["width_mm"], b["height_mm"],
            ):
                errors.append(
                    f"Pallet {pallet_no}: boxes '{a['box_id']}' and '{b['box_id']}' overlap."
                )


def check_floating(
    boxes: List[dict],
    pallet_no: int,
    errors: List[str],
    warnings: List[str],
    strict_stability: bool,
) -> None:
    """Box at z=0 is on the floor.  z>0 requires ≥70% XY support from boxes directly below."""
    for box in boxes:
        if box["z_mm"] < 0.5:
            continue  # floor

        base_area = box["length_mm"] * box["width_mm"]
        if base_area == 0:
            continue

        supported = 0.0
        for other in boxes:
            if other["box_id"] == box["box_id"]:
                continue
            if abs((other["z_mm"] + other["height_mm"]) - box["z_mm"]) < 1.0:
                supported += _xy_overlap_area(
                    box["x_mm"], box["y_mm"], box["length_mm"], box["width_mm"],
                    other["x_mm"], other["y_mm"], other["length_mm"], other["width_mm"],
                )

        frac = min(supported / base_area, 1.0)
        if frac == 0.0:
            message = (
                f"Pallet {pallet_no}: box '{box['box_id']}' is floating "
                f"(z={box['z_mm']:.1f}, no support below)."
            )
            (errors if strict_stability else warnings).append(message)
        elif frac < SUPPORT_THRESHOLD:
            message = (
                f"Pallet {pallet_no}: box '{box['box_id']}' has only "
                f"{frac*100:.0f}% support (minimum {SUPPORT_THRESHOLD*100:.0f}%)."
            )
            (errors if strict_stability else warnings).append(message)


def check_no_load_on_top(
    boxes: List[dict],
    orig_map: Dict[str, BoxResult],
    pallet_no: int,
    errors: List[str],
    warnings: List[str],
    strict_stability: bool,
) -> None:
    """If box has no_load_on_top, nothing may rest on its top face."""
    for box in boxes:
        orig = orig_map.get(box["box_id"])
        no_load = (orig.no_load_on_top if orig else False) or box.get("no_load_on_top", False)
        if not no_load:
            continue
        top_z = box["z_mm"] + box["height_mm"]
        for other in boxes:
            if other["box_id"] == box["box_id"]:
                continue
            if abs(other["z_mm"] - top_z) < 1.0:
                overlap = _xy_overlap_area(
                    box["x_mm"], box["y_mm"], box["length_mm"], box["width_mm"],
                    other["x_mm"], other["y_mm"], other["length_mm"], other["width_mm"],
                )
                if overlap > 1.0:
                    message = (
                        f"Pallet {pallet_no}: box '{other['box_id']}' is on top of "
                        f"'{box['box_id']}' which has no_load_on_top constraint."
                    )
                    (errors if strict_stability else warnings).append(message)


def check_stand_upright_only(
    boxes: List[dict],
    orig_map: Dict[str, BoxResult],
    pallet_no: int,
    errors: List[str],
) -> None:
    """
    If box has stand_upright_only, its height_mm must equal original_height_mm.
    This prevents rotations that would flip the upright axis.
    """
    for box in boxes:
        orig = orig_map.get(box["box_id"])
        upright = (orig.stand_upright_only if orig else False) or box.get("stand_upright_only", False)
        if not upright:
            continue
        orig_h = orig.original_height_mm if orig and orig.original_height_mm else (orig.height_mm if orig else None)
        if orig_h is None:
            continue
        if abs(box["height_mm"] - orig_h) > 0.5:
            errors.append(
                f"Pallet {pallet_no}: box '{box['box_id']}' has stand_upright_only constraint "
                f"but height changed from {orig_h:.1f} to {box['height_mm']:.1f} mm."
            )


def check_duplicate_box_ids(
    all_boxes: List[dict],
    errors: List[str],
) -> None:
    seen: set = set()
    for b in all_boxes:
        bid = b["box_id"]
        if bid in seen:
            errors.append(f"Duplicate box_id '{bid}' found in adjusted layout.")
        seen.add(bid)


def check_missing_and_extra_boxes(
    submitted_ids: set,
    original_ids: set,
    warnings: List[str],
    errors: List[str],
) -> None:
    for bid in sorted(original_ids - submitted_ids):
        warnings.append(f"Box '{bid}' from generated layout is missing in adjusted layout.")
    for bid in sorted(submitted_ids - original_ids):
        errors.append(f"Box '{bid}' is not in the original generated layout (unknown box).")


# ─────────────────────────────────────────────────────────────────────────────
# Top-level validator
# ─────────────────────────────────────────────────────────────────────────────

def validate_adjusted_layout(
    layout: LayoutPatchRequest,
    pallet_config: dict,
    original_box_ids: set,
    orig_box_map: Dict[str, BoxResult],
) -> AdjustmentValidation:
    """
    Full validation of a manually adjusted layout.

    pallet_config  keys: length_mm, width_mm, max_height_mm, max_weight_kg
    original_box_ids: set of box_ids from the generated result
    orig_box_map: box_id → original BoxResult (for constraint lookup)
    """
    errors: List[str] = []
    warnings: List[str] = []

    all_boxes: List[dict] = []
    submitted_ids: set = set()
    box_meta: Dict[str, tuple[int, Optional[str]]] = {}

    for pallet in layout.pallets:
        boxes = [b.model_dump() for b in pallet.boxes]
        all_boxes.extend(boxes)
        for b in boxes:
            orig = orig_box_map.get(b["box_id"])
            box_meta[b["box_id"]] = (pallet.pallet_no, orig.sku if orig else None)

        check_boundary_with_threshold(boxes, pallet_config, layout.settings, errors)
        check_max_height(boxes, pallet_config, errors)
        check_max_weight(boxes, pallet.pallet_no, pallet_config, errors)
        check_overlap(boxes, pallet.pallet_no, errors)
        check_floating(
            boxes,
            pallet.pallet_no,
            errors,
            warnings,
            layout.settings.do_not_allow_stability_issues,
        )
        check_no_load_on_top(
            boxes,
            orig_box_map,
            pallet.pallet_no,
            errors,
            warnings,
            layout.settings.do_not_allow_stability_issues,
        )
        check_stand_upright_only(boxes, orig_box_map, pallet.pallet_no, errors)

        for b in boxes:
            submitted_ids.add(b["box_id"])

    check_duplicate_box_ids(all_boxes, errors)
    check_missing_and_extra_boxes(submitted_ids, original_box_ids, warnings, errors)
    issues = _issues_from_messages(errors, warnings, box_meta)
    invalid_box_ids = sorted({
        issue.box_id
        for issue in issues
        if issue.box_id and issue.severity == "error"
    })

    return AdjustmentValidation(
        is_valid=len(errors) == 0,
        invalidBoxIds=invalid_box_ids,
        issues=issues,
        errors=errors,
        warnings=warnings,
    )
