"""
Main optimiser entry point.
Handles box expansion, sorting, business rules, and dispatches to algorithms.
"""
import copy
import math
import uuid
from typing import List, Tuple
from collections import Counter, defaultdict
from app.core.models import Box, Pallet
from app.core.schemas import (
    PalletiseRequest, PalletiseResponse, PalletResult, BoxResult,
    SummaryResult, AlgorithmType, StabilitySummary, UnplacedBox, CenterTotal, WarningItem,
)
from app.algorithms.first_fit import run_first_fit
from app.algorithms.best_fit import run_best_fit
from app.algorithms.extreme_point import run_extreme_point
from app.algorithms.genetic import run_genetic
from app.algorithms.stability import validate_pallet
from app.algorithms.scoring import score_solution
from app.algorithms.rotations import is_largest_base_orientation


def _is_fractional(value: float) -> bool:
    return abs(value - round(value)) > 1e-9


def _carton_count(quantity: float, mode: str, sku: str) -> tuple[int, bool, str | None]:
    if quantity <= 0:
        return 0, False, None
    if not _is_fractional(quantity):
        return int(quantity), False, None

    if mode == "exact_error":
        raise ValueError(f"Fractional carton quantity {quantity:g} for SKU {sku} is not allowed.")
    if mode == "floor":
        count = math.floor(quantity)
    elif mode == "ignore_fractional_zero" and quantity < 1:
        count = 0
    else:
        count = math.ceil(quantity)

    warning = f"Fractional carton quantity {quantity:g} for SKU {sku} rounded up to {count} cartons."
    if mode == "floor":
        warning = f"Fractional carton quantity {quantity:g} for SKU {sku} rounded down to {count} cartons."
    elif mode == "ignore_fractional_zero" and quantity < 1:
        warning = f"Fractional carton quantity {quantity:g} for SKU {sku} ignored because it is less than 1 carton."
    return count, True, warning


def _expand_items(req: PalletiseRequest) -> Tuple[List[Box], List[str | WarningItem]]:
    """Expand item quantities into individual Box objects."""
    boxes: List[Box] = []
    warnings: List[str | WarningItem] = []
    counter = 1
    for line_index, item in enumerate(req.items, start=1):
        line_id = item.line_id or f"line_{line_index}"
        store_no = item.store_no or item.store
        dc_no = item.dc_no or item.dc
        description = item.description or item.description_of_goods
        for field_name in ("length_mm", "width_mm", "height_mm"):
            value = getattr(item, field_name)
            if value < 5:
                warnings.append(WarningItem(
                    id=f"small_dimension:{item.sku}:{field_name}:{value:g}",
                    type="small_dimension",
                    sku=item.sku,
                    message=f"SKU {item.sku} has very small dimension {field_name}={value:g}mm. Confirm units are correct.",
                    dismissible=True,
                ))

        quantity = float(item.quantity or 0)
        try:
            carton_count, has_partial, warning = _carton_count(
                quantity,
                req.constraints.fractional_quantity_mode,
                item.sku,
            )
        except ValueError as exc:
            warnings.append(str(exc))
            continue
        if warning:
            warnings.append(warning)

        for carton_index in range(1, carton_count + 1):
            b = Box(
                box_id=f"{item.sku}-{line_index}-{carton_index}",
                sku=item.sku,
                length=item.length_mm,
                width=item.width_mm,
                height=item.height_mm,
                weight=item.weight_kg,
                original_length=item.length_mm,
                original_width=item.width_mm,
                original_height=item.height_mm,
                nia_item_code=item.nia_item_code,
                description_of_goods=item.description_of_goods or description,
                lot_no=item.lot_no,
                line_id=line_id,
                source_row=item.source_row,
                store_no=store_no,
                dc_no=dc_no,
                center_label=item.center_label,
                center_expected_cartons=item.center_expected_cartons,
                original_quantity=quantity,
                partial_carton=has_partial and carton_index == carton_count,
                carton_index=carton_index,
                expiry_date=item.expiry_date,
                location=item.location,
                requested_delivery_date=item.requested_delivery_date,
                stand_upright_only=item.stand_upright_only,
                no_load_on_top=item.no_load_on_top,
            )
            boxes.append(b)
            counter += 1
    return boxes, warnings


def _apply_business_rules(boxes: List[Box], req: PalletiseRequest) -> List[Box]:
    """Sort boxes according to warehouse constraints."""
    c = req.constraints

    # FEFO: sort by expiry date ascending
    if c.respect_fefo:
        boxes.sort(key=lambda b: (b.expiry_date or "9999-12-31"))

    # Group by delivery date
    if c.respect_delivery_date:
        boxes.sort(key=lambda b: (b.requested_delivery_date or "9999-12-31", b.expiry_date or "9999-12-31"))

    # Location cluster preference: sort by location prefix (Row)
    if c.prefer_location_cluster:
        def loc_key(b: Box):
            if not b.location:
                return ("Z", "Z", "Z", "Z")
            parts = b.location.split("-")
            return tuple(parts[:4]) if len(parts) >= 4 else tuple(parts + ["Z"] * 4)[:4]
        boxes.sort(key=loc_key)

    return boxes


def _pallets_to_response(
    job_id: str,
    order_id: str,
    algorithm: str,
    pallets: List[Pallet],
    warnings: List[str | WarningItem],
    constraints_used: dict | None = None,
    unplaced_boxes: List[UnplacedBox] | None = None,
    center_totals: dict | None = None,
) -> PalletiseResponse:
    total_floating = 0
    total_unstable = 0
    all_warnings = list(warnings)
    stability_issues = []
    pallet_results = []

    visible_pallets = [p for p in pallets if p.boxes]
    pallet_vol = visible_pallets[0].length * visible_pallets[0].width * visible_pallets[0].max_height if visible_pallets else 1
    pallet_area = visible_pallets[0].length * visible_pallets[0].width if visible_pallets else 1

    vol_utils = []
    area_utils = []
    total_weight = 0.0
    total_boxes = 0
    response_sku_totals: Counter[str] = Counter()

    for pallet in visible_pallets:
        floating, unstable, stab_warns, stab_issues = validate_pallet(pallet)
        total_floating += floating
        total_unstable += unstable
        all_warnings.extend(stab_warns)
        stability_issues.extend(stab_issues)

        used_vol = pallet.used_volume
        vol_util = (used_vol / pallet_vol * 100) if pallet_vol > 0 else 0

        # Area utilisation: max footprint projection
        xs = set()
        ys = set()
        for b in pallet.boxes:
            xs.add(round(b.x, 1))
            ys.add(round(b.y, 1))
        used_area = sum(b.length * b.width for b in pallet.boxes)
        area_util = min((used_area / pallet_area * 100), 100) if pallet_area > 0 else 0

        vol_utils.append(vol_util)
        area_utils.append(area_util)
        w = pallet.used_weight
        total_weight += w
        total_boxes += len(pallet.boxes)

        boxes_out = []
        pallet_sku_totals: Counter[str] = Counter()
        for b in pallet.boxes:
            pallet_sku_totals[b.sku] += 1
            response_sku_totals[b.sku] += 1
            boxes_out.append(BoxResult(
                box_id=b.box_id,
                sku=b.sku,
                nia_item_code=b.nia_item_code,
                description_of_goods=b.description_of_goods,
                lot_no=b.lot_no,
                line_id=b.line_id,
                source_row=b.source_row,
                store_no=b.store_no,
                dc_no=b.dc_no,
                center_label=b.center_label,
                center_expected_cartons=b.center_expected_cartons,
                original_quantity=b.original_quantity,
                partial_carton=b.partial_carton,
                carton_index=b.carton_index,
                x_mm=round(b.x, 2),
                y_mm=round(b.y, 2),
                z_mm=round(b.z, 2),
                length_mm=round(b.length, 2),
                width_mm=round(b.width, 2),
                height_mm=round(b.height, 2),
                weight_kg=b.weight,
                rotation=b.rotation,
                base_area_mm2=round(b.length * b.width, 2),
                is_larger_base_orientation=is_largest_base_orientation(b, b.length, b.width, b.height),
                layer=b.layer,
                pick_sequence=b.pick_sequence,
                location=b.location,
                expiry_date=b.expiry_date,
                stand_upright_only=b.stand_upright_only,
                no_load_on_top=b.no_load_on_top,
                original_height_mm=round(b.original_height or b.height, 2),
            ))

        pallet_results.append(PalletResult(
            pallet_no=pallet.pallet_no,
            volume_utilisation_pct=round(vol_util, 2),
            area_utilisation_pct=round(area_util, 2),
            weight_kg=round(w, 3),
            box_count=len(pallet.boxes),
            sku_totals=dict(sorted(pallet_sku_totals.items())),
            boxes=boxes_out,
        ))

    avg_vol = sum(vol_utils) / len(vol_utils) if vol_utils else 0
    avg_area = sum(area_utils) / len(area_utils) if area_utils else 0

    summary = SummaryResult(
        pallets_used=len(visible_pallets),
        total_boxes=total_boxes,
        average_volume_utilisation_pct=round(avg_vol, 2),
        average_area_utilisation_pct=round(avg_area, 2),
        total_weight_kg=round(total_weight, 3),
        floating_boxes=total_floating,
        unstable_boxes=total_unstable,
        stability_issues=stability_issues,
        sku_totals=dict(sorted(response_sku_totals.items())),
        request_total_boxes=sum(item.quantity for item in []),
        request_sku_totals={},
        center_totals=center_totals or {},
        warnings=all_warnings,
    )

    return PalletiseResponse(
        job_id=job_id,
        order_id=order_id,
        status="completed",
        algorithm_used=algorithm,
        summary=summary,
        pallets=pallet_results,
        constraints_used=constraints_used or {},
        stability=StabilitySummary(is_stable=len(stability_issues) == 0, issues=stability_issues),
        unplaced_boxes=unplaced_boxes or [],
    )


def run_optimisation(req: PalletiseRequest, job_id: str) -> PalletiseResponse:
    boxes, expansion_warnings = _expand_items(req)
    print(f"Optimising {len(boxes)} boxes from {len(req.items)} item lines")
    boxes = _apply_business_rules(boxes, req)

    constraints = req.constraints
    algo = req.algorithm

    if algo == AlgorithmType.AUTO:
        # Pick best across EXTREME_POINT and GENETIC
        ep = run_extreme_point(
            copy.deepcopy(boxes),
            req.pallet,
            allow_rotation=constraints,
            prefer_larger_base=constraints.prefer_larger_base,
        )
        ga = run_genetic(
            copy.deepcopy(boxes),
            req.pallet,
            allow_rotation=constraints,
            prefer_larger_base=constraints.prefer_larger_base,
        )
        pallets = ep if score_solution(ep, constraints) <= score_solution(ga, constraints) else ga
        algo_used = "AUTO(EXTREME_POINT)" if pallets is ep else "AUTO(GENETIC)"
    elif algo == AlgorithmType.FIRST_FIT:
        pallets = run_first_fit(
            boxes,
            req.pallet,
            allow_rotation=constraints,
            prefer_larger_base=constraints.prefer_larger_base,
        )
        algo_used = "FIRST_FIT"
    elif algo == AlgorithmType.BEST_FIT:
        pallets = run_best_fit(
            boxes,
            req.pallet,
            allow_rotation=constraints,
            prefer_larger_base=constraints.prefer_larger_base,
        )
        algo_used = "BEST_FIT"
    elif algo == AlgorithmType.GENETIC:
        pallets = run_genetic(
            boxes,
            req.pallet,
            allow_rotation=constraints,
            prefer_larger_base=constraints.prefer_larger_base,
        )
        algo_used = "GENETIC"
    else:
        pallets = run_extreme_point(
            boxes,
            req.pallet,
            allow_rotation=constraints,
            prefer_larger_base=constraints.prefer_larger_base,
        )
        algo_used = "EXTREME_POINT"

    placed_ids = {b.box_id for p in pallets for b in p.boxes}
    unplaced = [
        UnplacedBox(
            box_id=box.box_id,
            sku=box.sku,
            reason="No stable placement found under current constraints"
            if constraints.do_not_allow_stability_issues
            else "No placement found under current constraints",
        )
        for box in boxes
        if box.box_id not in placed_ids
    ]
    result = _pallets_to_response(
        job_id,
        req.order_id,
        algo_used,
        pallets,
        expansion_warnings,
        constraints_used={
            "do_not_allow_stability_issues": constraints.do_not_allow_stability_issues,
            "prefer_larger_base": constraints.prefer_larger_base,
        },
        unplaced_boxes=unplaced,
        center_totals=_build_center_totals(req, boxes),
    )
    request_sku_totals: Counter[str] = Counter()
    for item in req.items:
        if item.quantity > 0:
            count, _, _ = _carton_count(
                float(item.quantity),
                constraints.fractional_quantity_mode,
                item.sku,
            )
            request_sku_totals[item.sku] += count
    result.summary.request_total_boxes = sum(request_sku_totals.values())
    result.summary.request_sku_totals = dict(sorted(request_sku_totals.items()))
    return result


def _build_center_totals(req: PalletiseRequest, boxes: List[Box]) -> dict:
    input_lines: Counter[str] = Counter()
    quantity_sum: defaultdict[str, float] = defaultdict(float)
    expected: dict[str, float | None] = {}
    expanded: Counter[str] = Counter()

    for item in req.items:
        label = item.center_label
        if not label:
            continue
        input_lines[label] += 1
        quantity_sum[label] += float(item.quantity or 0)
        if item.center_expected_cartons is not None:
            expected[label] = item.center_expected_cartons

    for box in boxes:
        if box.center_label:
            expanded[box.center_label] += 1

    labels = sorted(set(input_lines) | set(expanded))
    return {
        label: CenterTotal(
            input_lines=input_lines[label],
            expected_cartons=expected.get(label),
            expanded_cartons=expanded[label],
            quantity_sum_raw=round(quantity_sum[label], 6),
        )
        for label in labels
    }
