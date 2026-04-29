"""In-memory job store. Replace with DB-backed store for production."""
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional
from app.core.schemas import PalletiseResponse, JobStatus


class JobStore:
    def __init__(self):
        self._jobs: Dict[str, PalletiseResponse] = {}
        self._meta: Dict[str, dict] = {}

    def create_job(self) -> str:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        self._meta[job_id] = {
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        return job_id

    def save(self, job_id: str, result: PalletiseResponse) -> None:
        self._jobs[job_id] = result
        self._meta[job_id]["status"] = result.status
        self._meta[job_id]["algorithm_used"] = result.algorithm_used
        self._meta[job_id]["order_id"] = result.order_id

    def get(self, job_id: str) -> Optional[PalletiseResponse]:
        return self._jobs.get(job_id)

    def get_status(self, job_id: str) -> Optional[JobStatus]:
        meta = self._meta.get(job_id)
        if not meta:
            return None
        return JobStatus(job_id=job_id, **meta)

    def list_jobs(self) -> list:
        return [
            JobStatus(job_id=jid, **meta)
            for jid, meta in self._meta.items()
        ]


# Module-level singleton
job_store = JobStore()
