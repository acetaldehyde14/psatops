from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.schemas import UploadResponse
from app.services.parser_service import parse_file

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    allowed = (".csv", ".xlsx", ".xls", ".json")
    if not any(file.filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Use: {allowed}")

    content = await file.read()
    items, warnings = parse_file(content, file.filename)
    if not items:
        raise HTTPException(status_code=400, detail=warnings or ["No valid order rows found"])

    return UploadResponse(
        filename=file.filename,
        rows_parsed=len(items),
        items=items,
        warnings=warnings,
    )
