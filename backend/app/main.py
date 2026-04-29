import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import routes_health, routes_palletise, routes_upload, routes_jobs

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Palletisation optimiser API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin
        for origin in [
            "http://localhost:3000",
            os.getenv("FRONTEND_URL"),
        ]
        if origin
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_health.router, tags=["Health"])
app.include_router(routes_palletise.router, prefix="/api/v1", tags=["Palletise"])
app.include_router(routes_upload.router, prefix="/api/v1", tags=["Upload"])
app.include_router(routes_jobs.router, prefix="/api/v1", tags=["Jobs"])


@app.get("/")
async def root():
    return {"message": "Palletisation Optimiser API", "docs": "/docs"}
