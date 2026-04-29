"""In-memory job store. Replace with DB-backed store for production."""
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional, List
from app.core.schemas import PalletiseResponse, JobStatus, PalletResult


class JobStore:
    def __init__(self):
        self._jobs: Dict[str, PalletiseResponse] = {}
        self._adjusted: Dict[str, List[PalletResult]] = {}   # adjusted pallets only
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
        self._meta[job_id]["manually_adjusted"] = False
        self._meta[job_id]["layout_source"] = "generated"

    def get(self, job_id: str) -> Optional[PalletiseResponse]:
        """Return job, with adjusted pallets substituted if present."""
        result = self._jobs.get(job_id)
        if result is None:
            return None
        if job_id in self._adjusted:
            # Return a copy with adjusted pallets
            data = result.model_copy(update={"pallets": self._adjusted[job_id]})
            return data
        return result

    def get_original(self, job_id: str) -> Optional[PalletiseResponse]:
        """Always return the original generated layout."""
        return self._jobs.get(job_id)

    def save_adjusted(self, job_id: str, pallets: List[PalletResult], adjusted_at: str) -> None:
        self._adjusted[job_id] = pallets
        self._meta[job_id]["manually_adjusted"] = True
        self._meta[job_id]["layout_source"] = "manual_adjusted"
        self._meta[job_id]["adjusted_at"] = adjusted_at

    def get_adjusted(self, job_id: str) -> Optional[List[PalletResult]]:
        return self._adjusted.get(job_id)

    def is_manually_adjusted(self, job_id: str) -> bool:
        return self._meta.get(job_id, {}).get("manually_adjusted", False)

    def get_all_box_ids(self, job_id: str) -> set:
        result = self._jobs.get(job_id)
        if not result:
            return set()
        return {b.box_id for p in result.pallets for b in p.boxes}

    def get_pallet_config(self, job_id: str) -> Optional[dict]:
        return self._meta.get(job_id, {}).get("pallet_config")

    def save_pallet_config(self, job_id: str, config: dict) -> None:
        self._meta[job_id]["pallet_config"] = config

    def get_status(self, job_id: str) -> Optional[JobStatus]:
        meta = self._meta.get(job_id)
        if not meta:
            return None
        # Only pass fields that JobStatus expects
        return JobStatus(
            job_id=job_id,
            status=meta["status"],
            created_at=meta["created_at"],
            algorithm_used=meta.get("algorithm_used"),
            order_id=meta.get("order_id"),
        )

    def list_jobs(self) -> list:
        return [self.get_status(jid) for jid in self._meta if self.get_status(jid)]


# Module-level singleton
job_store = JobStore()
