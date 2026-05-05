import pytest
import copy
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


def test_palletise_uses_request_items_quantity_and_sku():
    req = copy.deepcopy(SAMPLE_REQUEST)
    req["items"] = [
        {
            "sku": "REAL-UPLOAD-SKU",
            "quantity": 3,
            "length_mm": 250,
            "width_mm": 200,
            "height_mm": 100,
            "weight_kg": 1.0,
        }
    ]
    response = client.post("/api/v1/palletise", json=req)
    assert response.status_code == 200
    data = response.json()
    boxes = [box for pallet in data["pallets"] for box in pallet["boxes"]]
    assert data["summary"]["total_boxes"] == 3
    assert len(boxes) == 3
    assert {box["sku"] for box in boxes} == {"REAL-UPLOAD-SKU"}
    assert data["summary"]["sku_totals"] == {"REAL-UPLOAD-SKU": 3}
    assert data["summary"]["request_sku_totals"] == {"REAL-UPLOAD-SKU": 3}


def test_palletise_output_changes_for_different_sku():
    req_a = copy.deepcopy(SAMPLE_REQUEST)
    req_b = copy.deepcopy(SAMPLE_REQUEST)
    req_a["items"] = [{
        "sku": "SKU-A-ONLY",
        "quantity": 1,
        "length_mm": 250,
        "width_mm": 200,
        "height_mm": 100,
        "weight_kg": 1.0,
    }]
    req_b["items"] = [{
        "sku": "SKU-B-ONLY",
        "quantity": 1,
        "length_mm": 250,
        "width_mm": 200,
        "height_mm": 100,
        "weight_kg": 1.0,
    }]
    data_a = client.post("/api/v1/palletise", json=req_a).json()
    data_b = client.post("/api/v1/palletise", json=req_b).json()
    sku_a = data_a["pallets"][0]["boxes"][0]["sku"]
    sku_b = data_b["pallets"][0]["boxes"][0]["sku"]
    assert sku_a == "SKU-A-ONLY"
    assert sku_b == "SKU-B-ONLY"
    assert sku_a != sku_b


def test_palletise_empty_items_returns_400():
    req = copy.deepcopy(SAMPLE_REQUEST)
    req["items"] = []
    response = client.post("/api/v1/palletise", json=req)
    assert response.status_code == 400


def test_palletise_preserves_duplicate_sku_line_metadata():
    req = copy.deepcopy(SAMPLE_REQUEST)
    req["items"] = [
        {
            "sku": "DUP-SKU",
            "quantity": 1,
            "length_mm": 250,
            "width_mm": 200,
            "height_mm": 100,
            "weight_kg": 1.0,
            "store": "STORE-A",
            "dc": "DC-A",
            "line_id": "line-a",
            "source_row": 2,
        },
        {
            "sku": "DUP-SKU",
            "quantity": 2,
            "length_mm": 250,
            "width_mm": 200,
            "height_mm": 100,
            "weight_kg": 1.0,
            "store_no": "STORE-B",
            "dc_no": "DC-B",
            "line_id": "line-b",
            "source_row": 3,
        },
    ]
    response = client.post("/api/v1/palletise", json=req)
    assert response.status_code == 200
    data = response.json()
    boxes = [box for pallet in data["pallets"] for box in pallet["boxes"]]
    assert data["summary"]["total_boxes"] == 3
    assert data["summary"]["sku_totals"] == {"DUP-SKU": 3}
    assert {box["store_no"] for box in boxes} == {"STORE-A", "STORE-B"}
    assert {box["dc_no"] for box in boxes} == {"DC-A", "DC-B"}
    assert {box["line_id"] for box in boxes} == {"line-a", "line-b"}


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


def test_palletise_accepts_raw_json_array_and_preserves_metadata():
    raw_items = [
        {
            "sku": "NIPRO-SKU",
            "nia_item_code": "NIA-001",
            "description_of_goods": "NIPRO center cargo",
            "quantity": 2,
            "total_qty_pcs": 48,
            "qty_per_ctn": 24,
            "length_mm": 21.67,
            "width_mm": 430,
            "height_mm": 250,
            "weight_kg": 0.165,
            "store": "BP2",
            "dc": "SG",
            "center_label": "Least Cargo - BP2 - 49 cartons",
            "center_expected_cartons": 49,
        }
    ]
    response = client.post("/api/v1/palletise", json=raw_items)
    assert response.status_code == 200
    data = response.json()
    boxes = [box for pallet in data["pallets"] for box in pallet["boxes"]]
    assert data["order_id"].startswith("RAW-JSON-")
    assert data["summary"]["total_boxes"] == 2
    assert {box["sku"] for box in boxes} == {"NIPRO-SKU"}
    assert {box["nia_item_code"] for box in boxes} == {"NIA-001"}
    assert {box["store_no"] for box in boxes} == {"BP2"}
    assert {box["dc_no"] for box in boxes} == {"SG"}
    assert {box["center_label"] for box in boxes} == {"Least Cargo - BP2 - 49 cartons"}
    center = data["summary"]["center_totals"]["Least Cargo - BP2 - 49 cartons"]
    assert center["input_lines"] == 1
    assert center["expected_cartons"] == 49
    assert center["expanded_cartons"] == 2
    assert center["quantity_sum_raw"] == 2


def test_fractional_quantity_less_than_one_rounds_up_to_partial_carton():
    response = client.post("/api/v1/palletise", json=[{
        "sku": "PARTIAL-ZERO",
        "quantity": 0.03,
        "length_mm": 100,
        "width_mm": 100,
        "height_mm": 100,
        "weight_kg": 1,
    }])
    assert response.status_code == 200
    data = response.json()
    boxes = [box for pallet in data["pallets"] for box in pallet["boxes"]]
    assert len(boxes) == 1
    assert boxes[0]["partial_carton"] is True
    assert boxes[0]["original_quantity"] == 0.03
    assert any("Fractional carton quantity 0.03" in warning for warning in data["summary"]["warnings"])


def test_fractional_quantity_above_one_rounds_up_last_partial():
    response = client.post("/api/v1/palletise", json=[{
        "sku": "PARTIAL-THREE",
        "quantity": 2.5,
        "length_mm": 100,
        "width_mm": 100,
        "height_mm": 100,
        "weight_kg": 1,
    }])
    assert response.status_code == 200
    boxes = [box for pallet in response.json()["pallets"] for box in pallet["boxes"]]
    assert len(boxes) == 3
    assert sum(1 for box in boxes if box["partial_carton"]) == 1
    assert boxes[-1]["partial_carton"] is True


def test_zero_quantity_is_skipped():
    response = client.post("/api/v1/palletise", json=[{
        "sku": "ZERO-QTY",
        "quantity": 0,
        "length_mm": 100,
        "width_mm": 100,
        "height_mm": 100,
        "weight_kg": 1,
    }])
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total_boxes"] == 0
    assert data["pallets"] == []


def test_tiny_dimension_warns_but_does_not_reject():
    response = client.post("/api/v1/palletise", json=[{
        "sku": "TINY-DIM",
        "quantity": 1,
        "length_mm": 0.06,
        "width_mm": 430,
        "height_mm": 250,
        "weight_kg": 1,
    }])
    assert response.status_code == 200
    data = response.json()
    assert data["summary"]["total_boxes"] == 1
    warning = next(
        warning for warning in data["summary"]["warnings"]
        if isinstance(warning, dict) and warning.get("type") == "small_dimension"
    )
    assert warning["dismissible"] is True
    assert "length_mm=0.06mm" in warning["message"]


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


# ── Manual Adjustment Tests ────────────────────────────────────────────────────

def _generate_job():
    """Helper: run a palletise and return (job_id, first_box)."""
    response = client.post("/api/v1/palletise", json=SAMPLE_REQUEST)
    assert response.status_code == 200
    data = response.json()
    job_id = data["job_id"]
    first_box = data["pallets"][0]["boxes"][0]
    return job_id, data, first_box


def test_patch_layout_valid():
    job_id, data, box = _generate_job()
    # Build a valid patch: keep all boxes in place
    pallets_patch = []
    for p in data["pallets"]:
        pallets_patch.append({
            "pallet_no": p["pallet_no"],
            "boxes": [
                {
                    "box_id": b["box_id"],
                    "x_mm": b["x_mm"],
                    "y_mm": b["y_mm"],
                    "z_mm": b["z_mm"],
                    "length_mm": b["length_mm"],
                    "width_mm": b["width_mm"],
                    "height_mm": b["height_mm"],
                    "rotation": b["rotation"],
                    "layer": b["layer"],
                }
                for b in p["boxes"]
            ],
        })
    response = client.patch(f"/api/v1/jobs/{job_id}/layout", json={"pallets": pallets_patch})
    assert response.status_code == 200
    resp = response.json()
    assert resp["manually_adjusted"] is True
    assert resp["status"] == "saved"
    assert "adjusted_at" in resp
    assert resp["layout_source"] == "manual_adjusted"


def test_patch_layout_reflected_in_get():
    job_id, data, box = _generate_job()
    pallets_patch = [
        {
            "pallet_no": p["pallet_no"],
            "boxes": [
                {"box_id": b["box_id"], "x_mm": b["x_mm"], "y_mm": b["y_mm"],
                 "z_mm": b["z_mm"], "length_mm": b["length_mm"],
                 "width_mm": b["width_mm"], "height_mm": b["height_mm"],
                 "rotation": b["rotation"], "layer": b["layer"]}
                for b in p["boxes"]
            ],
        }
        for p in data["pallets"]
    ]
    client.patch(f"/api/v1/jobs/{job_id}/layout", json={"pallets": pallets_patch})
    get_resp = client.get(f"/api/v1/jobs/{job_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["manually_adjusted"] is True
    assert get_resp.json()["layout_source"] == "manual_adjusted"


def test_patch_layout_overlap_detected():
    job_id, data, box = _generate_job()
    # Place two boxes at the exact same position → overlap
    b0 = data["pallets"][0]["boxes"][0]
    b1 = data["pallets"][0]["boxes"][1] if len(data["pallets"][0]["boxes"]) > 1 else b0
    patch = {
        "pallets": [
            {
                "pallet_no": 1,
                "boxes": [
                    {"box_id": b0["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": 0,
                     "length_mm": b0["length_mm"], "width_mm": b0["width_mm"],
                     "height_mm": b0["height_mm"], "rotation": "LWH", "layer": 1},
                    {"box_id": b1["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": 0,
                     "length_mm": b1["length_mm"], "width_mm": b1["width_mm"],
                     "height_mm": b1["height_mm"], "rotation": "LWH", "layer": 1},
                ],
            }
        ]
    }
    if b0["box_id"] == b1["box_id"]:
        return  # only 1 box on pallet, skip overlap test
    response = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    assert response.status_code == 200
    resp = response.json()
    assert resp["validation"]["is_valid"] is False
    assert any("overlap" in e for e in resp["validation"]["errors"])


def test_patch_layout_boundary_exceeded():
    job_id, data, box = _generate_job()
    b0 = data["pallets"][0]["boxes"][0]
    patch = {
        "pallets": [
            {
                "pallet_no": 1,
                "boxes": [
                    {"box_id": b0["box_id"], "x_mm": 9999, "y_mm": 0, "z_mm": 0,
                     "length_mm": b0["length_mm"], "width_mm": b0["width_mm"],
                     "height_mm": b0["height_mm"], "rotation": "LWH", "layer": 1},
                ],
            }
        ]
    }
    response = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    assert response.status_code == 200
    resp = response.json()
    assert resp["validation"]["is_valid"] is False
    assert any("length" in e or "width" in e or "outside" in e.lower() or "exceeds" in e for e in resp["validation"]["errors"])


def test_patch_layout_missing_box_warned():
    job_id, data, box = _generate_job()
    # Submit layout with first box missing
    all_boxes = [b for p in data["pallets"] for b in p["boxes"]]
    if len(all_boxes) < 2:
        return
    patch = {
        "pallets": [
            {
                "pallet_no": data["pallets"][0]["pallet_no"],
                "boxes": [
                    {"box_id": b["box_id"], "x_mm": b["x_mm"], "y_mm": b["y_mm"],
                     "z_mm": b["z_mm"], "length_mm": b["length_mm"],
                     "width_mm": b["width_mm"], "height_mm": b["height_mm"],
                     "rotation": b["rotation"], "layer": b["layer"]}
                    for b in data["pallets"][0]["boxes"][1:]  # skip first box
                ],
            }
        ]
    }
    response = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    resp = response.json()
    assert any("missing" in w.lower() for w in resp["validation"]["warnings"])


def test_patch_layout_unknown_box_errors():
    job_id, _, _ = _generate_job()
    patch = {
        "pallets": [
            {
                "pallet_no": 1,
                "boxes": [
                    {"box_id": "FAKE_BOX_XYZ", "x_mm": 0, "y_mm": 0, "z_mm": 0,
                     "length_mm": 100, "width_mm": 100, "height_mm": 100,
                     "rotation": "LWH", "layer": 1},
                ],
            }
        ]
    }
    response = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    resp = response.json()
    assert any("not in the original" in e or "unknown" in e.lower() for e in resp["validation"]["errors"])


def test_patch_job_not_found():
    response = client.patch("/api/v1/jobs/nonexistent/layout", json={"pallets": []})
    assert response.status_code == 404


def test_export_csv_includes_layout_source():
    job_id, data, box = _generate_job()
    # Export before adjustment → generated
    resp = client.get(f"/api/v1/jobs/{job_id}/export/csv")
    assert "generated" in resp.text

    # Patch, then export → manual_adjusted
    pallets_patch = [
        {
            "pallet_no": p["pallet_no"],
            "boxes": [
                {"box_id": b["box_id"], "x_mm": b["x_mm"], "y_mm": b["y_mm"],
                 "z_mm": b["z_mm"], "length_mm": b["length_mm"],
                 "width_mm": b["width_mm"], "height_mm": b["height_mm"],
                 "rotation": b["rotation"], "layer": b["layer"]}
                for b in p["boxes"]
            ],
        }
        for p in data["pallets"]
    ]
    client.patch(f"/api/v1/jobs/{job_id}/layout", json={"pallets": pallets_patch})
    resp2 = client.get(f"/api/v1/jobs/{job_id}/export/csv")
    assert "manual_adjusted" in resp2.text
