import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

SAMPLE_REQUEST = {
    "order_id": "TEST-001",
    "algorithm": "EXTREME_POINT",
    "pallet": {
        "length_mm": 1200,
        "width_mm": 1000,
        "max_height_mm": 1150,
        "max_weight_kg": 1500
    },
    "constraints": {
        "allow_rotation": True,
        "stack_by": "weight",
        "mix_products": True,
        "respect_fefo": True,
        "respect_delivery_date": False,
        "prefer_partial_pallets": True,
        "prefer_location_cluster": True
    },
    "items": [
        {
            "sku": "TEST-SKU-001",
            "quantity": 5,
            "length_mm": 300,
            "width_mm": 200,
            "height_mm": 150,
            "weight_kg": 1.5,
            "lot_no": "LOT001",
            "expiry_date": "2026-12-31",
            "location": "R01-L01-C01-D01"
        },
        {
            "sku": "TEST-SKU-002",
            "quantity": 3,
            "length_mm": 400,
            "width_mm": 300,
            "height_mm": 200,
            "weight_kg": 3.0,
            "lot_no": "LOT002",
        }
    ]
}


def test_palletise_basic():
    response = client.post("/api/v1/palletise", json=SAMPLE_REQUEST)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["order_id"] == "TEST-001"
    assert "job_id" in data
    assert data["summary"]["total_boxes"] == 8  # 5 + 3
    assert len(data["pallets"]) >= 1


def test_palletise_returns_coordinates():
    response = client.post("/api/v1/palletise", json=SAMPLE_REQUEST)
    data = response.json()
    for pallet in data["pallets"]:
        for box in pallet["boxes"]:
            assert "x_mm" in box
            assert "y_mm" in box
            assert "z_mm" in box
            assert box["x_mm"] >= 0
            assert box["y_mm"] >= 0
            assert box["z_mm"] >= 0


def test_palletise_first_fit():
    req = dict(SAMPLE_REQUEST)
    req["algorithm"] = "FIRST_FIT"
    response = client.post("/api/v1/palletise", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["algorithm_used"] == "FIRST_FIT"


def test_palletise_best_fit():
    req = dict(SAMPLE_REQUEST)
    req["algorithm"] = "BEST_FIT"
    response = client.post("/api/v1/palletise", json=req)
    assert response.status_code == 200


def test_palletise_genetic():
    req = dict(SAMPLE_REQUEST)
    req["algorithm"] = "GENETIC"
    response = client.post("/api/v1/palletise", json=req)
    assert response.status_code == 200


def test_compare():
    compare_req = {
        "order_id": "TEST-CMP-001",
        "algorithms": ["FIRST_FIT", "BEST_FIT", "EXTREME_POINT"],
        "pallet": SAMPLE_REQUEST["pallet"],
        "constraints": SAMPLE_REQUEST["constraints"],
        "items": SAMPLE_REQUEST["items"],
    }
    response = client.post("/api/v1/palletise/compare", json=compare_req)
    assert response.status_code == 200
    data = response.json()
    assert len(data["results"]) == 3


def test_get_job():
    # First create a job
    response = client.post("/api/v1/palletise", json=SAMPLE_REQUEST)
    job_id = response.json()["job_id"]

    # Then retrieve it
    response = client.get(f"/api/v1/jobs/{job_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == job_id


def test_export_csv():
    response = client.post("/api/v1/palletise", json=SAMPLE_REQUEST)
    job_id = response.json()["job_id"]

    response = client.get(f"/api/v1/jobs/{job_id}/export/csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]


def test_job_not_found():
    response = client.get("/api/v1/jobs/nonexistent_job_id")
    assert response.status_code == 404
