from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import io
from app.core.schemas import (
    LayoutPatchRequest, LayoutPatchResponse, PalletResult,
)
from app.services.job_store import job_store
from app.services.export_service import to_csv
from app.services.layout_validation_service import validate_adjusted_layout

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    result = job_store.get(job_id)
    if not result:
        status = job_store.get_status(job_id)
        if status:
            return status
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    data = result.model_dump()
    data["manually_adjusted"] = job_store.is_manually_adjusted(job_id)
    data["layout_source"] = "manual_adjusted" if data["manually_adjusted"] else "generated"
    return data


@router.patch("/jobs/{job_id}/layout", response_model=LayoutPatchResponse)
async def patch_layout(job_id: str, body: LayoutPatchRequest):
    original = job_store.get_original(job_id)
    if not original:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    pallet_config = job_store.get_pallet_config(job_id) or {
        "length_mm": 1200, "width_mm": 1100,
        "max_height_mm": 1150, "max_weight_kg": 1500,
    }

    original_box_ids = job_store.get_all_box_ids(job_id)
    orig_box_map = {
        b.box_id: b
        for p in original.pallets
        for b in p.boxes
    }

    validation = validate_adjusted_layout(
        body, pallet_config, original_box_ids, orig_box_map
    )

    adjusted_at = datetime.now(timezone.utc).isoformat()

    # Build adjusted PalletResult objects, merging position patches with original metadata
    adjusted_pallets: list[PalletResult] = []
    for pp in body.pallets:
        new_boxes = []
        for bp in pp.boxes:
            orig_box = orig_box_map.get(bp.box_id)
            if orig_box:
                updated = orig_box.model_copy(update={
                    "x_mm": bp.x_mm,
                    "y_mm": bp.y_mm,
                    "z_mm": bp.z_mm,
                    "length_mm": bp.length_mm,
                    "width_mm": bp.width_mm,
                    "height_mm": bp.height_mm,
                    "rotation": bp.rotation,
                    "layer": bp.layer,
                })
                new_boxes.append(updated)

        pallet_vol = (pallet_config["length_mm"] * pallet_config["width_mm"]
                      * pallet_config["max_height_mm"])
        pallet_area = pallet_config["length_mm"] * pallet_config["width_mm"]
        used_vol = sum(b.length_mm * b.width_mm * b.height_mm for b in new_boxes)
        used_area = sum(b.length_mm * b.width_mm for b in new_boxes)

        adjusted_pallets.append(PalletResult(
            pallet_no=pp.pallet_no,
            volume_utilisation_pct=round(used_vol / pallet_vol * 100, 2) if pallet_vol else 0,
            area_utilisation_pct=round(min(used_area / pallet_area * 100, 100), 2) if pallet_area else 0,
            weight_kg=round(sum(b.weight_kg for b in new_boxes), 3),
            box_count=len(new_boxes),
            boxes=new_boxes,
        ))

    job_store.save_adjusted(job_id, adjusted_pallets, adjusted_at)

    return LayoutPatchResponse(
        job_id=job_id,
        status="saved",
        manually_adjusted=True,
        adjusted_at=adjusted_at,
        layout_source="manual_adjusted",
        validation=validation,
    )


@router.get("/jobs/{job_id}/visualisation")
async def get_visualisation(job_id: str):
    result = job_store.get(job_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return {
        "job_id": job_id,
        "manually_adjusted": job_store.is_manually_adjusted(job_id),
        "pallets": [
            {
                "pallet_no": p.pallet_no,
                "boxes": [
                    {
                        "box_id": b.box_id, "sku": b.sku,
                        "x": b.x_mm, "y": b.y_mm, "z": b.z_mm,
                        "l": b.length_mm, "w": b.width_mm, "h": b.height_mm,
                        "rotation": b.rotation, "layer": b.layer,
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
    layout_source = "manual_adjusted" if job_store.is_manually_adjusted(job_id) else "generated"
    csv_content = to_csv(result, layout_source)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={job_id}.csv"},
    )
