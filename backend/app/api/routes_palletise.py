from fastapi import APIRouter, HTTPException
from app.core.schemas import PalletiseRequest, PalletiseResponse, CompareRequest, CompareResponse, AlgorithmCompareEntry, AlgorithmType
from app.services.job_store import job_store
from app.services.validation_service import validate_request
from app.algorithms.optimiser import run_optimisation
import copy

router = APIRouter()


@router.post("/palletise", response_model=PalletiseResponse)
async def palletise(req: PalletiseRequest):
    warnings = validate_request(req)
    job_id = job_store.create_job()
    result = run_optimisation(req, job_id)
    result.summary.warnings = warnings + result.summary.warnings
    job_store.save(job_id, result)
    return result


@router.post("/palletise/compare", response_model=CompareResponse)
async def compare(req: CompareRequest):
    results = []
    for algo in req.algorithms:
        single_req = PalletiseRequest(
            order_id=req.order_id,
            algorithm=algo,
            pallet=req.pallet,
            constraints=req.constraints,
            items=copy.deepcopy(req.items),
        )
        job_id = job_store.create_job()
        result = run_optimisation(single_req, job_id)
        job_store.save(job_id, result)
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
