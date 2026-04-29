"""
Main optimiser entry point.
Handles box expansion, sorting, business rules, and dispatches to algorithms.
"""
import copy
import uuid
from typing import List, Tuple
from app.core.models import Box, Pallet
from app.core.schemas import (
    PalletiseRequest, PalletiseResponse, PalletResult, BoxResult,
    SummaryResult, AlgorithmType,
)
from app.algorithms.first_fit import run_first_fit
from app.algorithms.best_fit import run_best_fit
from app.algorithms.extreme_point import run_extreme_point
from app.algorithms.genetic import run_genetic
from app.algorithms.stability import validate_pallet
from app.algorithms.scoring import score_solution


def _expand_items(req: PalletiseRequest) -> List[Box]:
    """Expand item quantities into individual Box objects."""
    boxes: List[Box] = []
    counter = 1
    for item in req.items:
        for _ in range(item.quantity):
            b = Box(
                box_id=f"box_{counter:04d}",
                sku=item.sku,
                length=item.length_mm,
                width=item.width_mm,
                height=item.height_mm,
                weight=item.weight_kg,
                lot_no=item.lot_no,
                expiry_date=item.expiry_date,
                location=item.location,
                requested_delivery_date=item.requested_delivery_date,
            )
            boxes.append(b)
            counter += 1
    return boxes


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
    warnings: List[str],
) -> PalletiseResponse:
    total_floating = 0
    total_unstable = 0
    all_warnings = list(warnings)
    pallet_results = []

    pallet_vol = pallets[0].length * pallets[0].width * pallets[0].max_height if pallets else 1
    pallet_area = pallets[0].length * pallets[0].width if pallets else 1

    vol_utils = []
    area_utils = []
    total_weight = 0.0
    total_boxes = 0

    for pallet in pallets:
        floating, unstable, stab_warns = validate_pallet(pallet)
        total_floating += floating
        total_unstable += unstable
        all_warnings.extend(stab_warns)

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
        for b in pallet.boxes:
            boxes_out.append(BoxResult(
                box_id=b.box_id,
                sku=b.sku,
                lot_no=b.lot_no,
                x_mm=round(b.x, 2),
                y_mm=round(b.y, 2),
                z_mm=round(b.z, 2),
                length_mm=round(b.length, 2),
                width_mm=round(b.width, 2),
                height_mm=round(b.height, 2),
                weight_kg=b.weight,
                rotation=b.rotation,
                layer=b.layer,
                pick_sequence=b.pick_sequence,
                location=b.location,
                expiry_date=b.expiry_date,
            ))

        pallet_results.append(PalletResult(
            pallet_no=pallet.pallet_no,
            volume_utilisation_pct=round(vol_util, 2),
            area_utilisation_pct=round(area_util, 2),
            weight_kg=round(w, 3),
            box_count=len(pallet.boxes),
            boxes=boxes_out,
        ))

    avg_vol = sum(vol_utils) / len(vol_utils) if vol_utils else 0
    avg_area = sum(area_utils) / len(area_utils) if area_utils else 0

    summary = SummaryResult(
        pallets_used=len(pallets),
        total_boxes=total_boxes,
        average_volume_utilisation_pct=round(avg_vol, 2),
        average_area_utilisation_pct=round(avg_area, 2),
        total_weight_kg=round(total_weight, 3),
        floating_boxes=total_floating,
        unstable_boxes=total_unstable,
        warnings=all_warnings,
    )

    return PalletiseResponse(
        job_id=job_id,
        order_id=order_id,
        status="completed",
        algorithm_used=algorithm,
        summary=summary,
        pallets=pallet_results,
    )


def run_optimisation(req: PalletiseRequest, job_id: str) -> PalletiseResponse:
    boxes = _expand_items(req)
    boxes = _apply_business_rules(boxes, req)

    allow_rotation = req.constraints.allow_rotation
    algo = req.algorithm

    if algo == AlgorithmType.AUTO:
        # Pick best across EXTREME_POINT and GENETIC
        ep = run_extreme_point(copy.deepcopy(boxes), req.pallet, allow_rotation)
        ga = run_genetic(copy.deepcopy(boxes), req.pallet, allow_rotation)
        pallets = ep if score_solution(ep) <= score_solution(ga) else ga
        algo_used = "AUTO(EXTREME_POINT)" if pallets is ep else "AUTO(GENETIC)"
    elif algo == AlgorithmType.FIRST_FIT:
        pallets = run_first_fit(boxes, req.pallet, allow_rotation)
        algo_used = "FIRST_FIT"
    elif algo == AlgorithmType.BEST_FIT:
        pallets = run_best_fit(boxes, req.pallet, allow_rotation)
        algo_used = "BEST_FIT"
    elif algo == AlgorithmType.GENETIC:
        pallets = run_genetic(boxes, req.pallet, allow_rotation)
        algo_used = "GENETIC"
    else:
        pallets = run_extreme_point(boxes, req.pallet, allow_rotation)
        algo_used = "EXTREME_POINT"

    return _pallets_to_response(job_id, req.order_id, algo_used, pallets, [])
