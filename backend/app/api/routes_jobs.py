from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io
from app.services.job_store import job_store
from app.services.export_service import to_csv

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    result = job_store.get(job_id)
    if not result:
        status = job_store.get_status(job_id)
        if status:
            return status
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return result


@router.get("/jobs/{job_id}/visualisation")
async def get_visualisation(job_id: str):
    result = job_store.get(job_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    # Return a lightweight structure for 3D rendering
    return {
        "job_id": job_id,
        "pallets": [
            {
                "pallet_no": p.pallet_no,
                "boxes": [
                    {
                        "box_id": b.box_id,
                        "sku": b.sku,
                        "x": b.x_mm, "y": b.y_mm, "z": b.z_mm,
                        "l": b.length_mm, "w": b.width_mm, "h": b.height_mm,
                        "rotation": b.rotation,
                        "layer": b.layer,
                    }
                    for b in p.boxes
                ],
            }
            for p in result.pallets
        ],
    }


@router.get("/jobs/{job_id}/export/csv")
async def export_csv(job_id: str):
    result = job_store.get(job_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    csv_content = to_csv(result)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={job_id}.csv"},
    )
