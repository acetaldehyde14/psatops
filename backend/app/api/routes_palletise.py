from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, HTTPException, Body
from pydantic import ValidationError
from app.core.schemas import PalletiseRequest, PalletiseResponse, CompareRequest, CompareResponse, AlgorithmCompareEntry, AlgorithmType
from app.services.job_store import job_store
from app.services.validation_service import validate_request
from app.algorithms.optimiser import run_optimisation
import copy

router = APIRouter()


def _default_request_from_raw_items(items: list[dict[str, Any]]) -> PalletiseRequest:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return PalletiseRequest.model_validate({
        "order_id": f"RAW-JSON-{timestamp}",
        "algorithm": "EXTREME_POINT",
        "pallet": {
            "length_mm": 1200,
            "width_mm": 1000,
            "max_height_mm": 1150,
            "max_weight_kg": 1500,
        },
        "constraints": {
            "allow_rotation": True,
            "prefer_larger_base": True,
            "do_not_allow_stability_issues": True,
            "mix_products": True,
            "respect_fefo": True,
            "respect_delivery_date": False,
            "prefer_partial_pallets": True,
            "prefer_location_cluster": True,
        },
        "items": items,
    })


def _normalise_palletise_body(body: Any) -> PalletiseRequest:
    if isinstance(body, list):
        if not all(isinstance(item, dict) for item in body):
            raise HTTPException(status_code=400, detail="Raw JSON array must contain item objects.")
        return _default_request_from_raw_items(body)
    if isinstance(body, dict):
        return PalletiseRequest.model_validate(body)
    raise HTTPException(status_code=400, detail="Request body must be a palletise object or raw item array.")


@router.post("/palletise", response_model=PalletiseResponse)
async def palletise(body: Any = Body(...)):
    try:
        req = _normalise_palletise_body(body)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors())
    print("constraints received:", req.constraints)
    errors, warnings = validate_request(req)
    if errors:
        raise HTTPException(status_code=400, detail=errors)
    job_id = job_store.create_job()
    result = run_optimisation(req, job_id)
    result.summary.warnings = warnings + result.summary.warnings
    job_store.save(job_id, result)
    job_store.save_pallet_config(job_id, req.pallet.model_dump())
    return result


@router.post("/palletise/raw-items", response_model=PalletiseResponse)
async def palletise_raw_items(items: list[dict[str, Any]]):
    return await palletise(items)


@router.post("/palletise/compare", response_model=CompareResponse)
async def compare(req: CompareRequest):
    if not req.items:
        raise HTTPException(status_code=400, detail=["No order items provided."])
    results = []
    for algo in req.algorithms:
        single_req = PalletiseRequest(
            order_id=req.order_id,
            algorithm=algo,
            pallet=req.pallet,
            constraints=req.constraints,
            items=copy.deepcopy(req.items),
        )
        errors, warnings = validate_request(single_req)
        if errors:
            raise HTTPException(status_code=400, detail=errors)
        job_id = job_store.create_job()
        result = run_optimisation(single_req, job_id)
        result.summary.warnings = warnings + result.summary.warnings
        job_store.save(job_id, result)
        job_store.save_pallet_config(job_id, req.pallet.model_dump())
        results.append(AlgorithmCompareEntry(
            algorithm=algo.value,
            pallets_used=result.summary.pallets_used,
            average_volume_utilisation_pct=result.summary.average_volume_utilisation_pct,
            average_area_utilisation_pct=result.summary.average_area_utilisation_pct,
            total_weight_kg=result.summary.total_weight_kg,
            floating_boxes=result.summary.floating_boxes,
            unstable_boxes=result.summary.unstable_boxes,
            warnings=result.summary.warnings,
            job_id=job_id,
        ))
    return CompareResponse(order_id=req.order_id, results=results)
