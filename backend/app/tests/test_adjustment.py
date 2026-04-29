"""Tests for improved manual adjustment validation."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

PALLET = {"length_mm": 1200, "width_mm": 1100, "max_height_mm": 1150, "max_weight_kg": 1500}
CONSTRAINTS = {
    "allow_rotation": True, "stack_by": "weight", "mix_products": True,
    "respect_fefo": True, "respect_delivery_date": False,
    "prefer_partial_pallets": True, "prefer_location_cluster": True,
}

ITEMS_2 = [
    {"sku": "A", "quantity": 1, "length_mm": 400, "width_mm": 300, "height_mm": 200, "weight_kg": 2.0,
     "no_load_on_top": False, "stand_upright_only": False},
    {"sku": "B", "quantity": 1, "length_mm": 300, "width_mm": 250, "height_mm": 150, "weight_kg": 1.0,
     "no_load_on_top": False, "stand_upright_only": False},
]


def _run_job(items=None):
    items = items or ITEMS_2
    r = client.post("/api/v1/palletise", json={
        "order_id": "ADJ-TEST", "algorithm": "EXTREME_POINT",
        "pallet": PALLET, "constraints": CONSTRAINTS, "items": items,
    })
    assert r.status_code == 200
    data = r.json()
    job_id = data["job_id"]
    # Build identity patch (keep everything in place)
    pallets_patch = [
        {"pallet_no": p["pallet_no"],
         "boxes": [{"box_id": b["box_id"], "x_mm": b["x_mm"], "y_mm": b["y_mm"],
                    "z_mm": b["z_mm"], "length_mm": b["length_mm"], "width_mm": b["width_mm"],
                    "height_mm": b["height_mm"], "rotation": b["rotation"], "layer": b["layer"]}
                   for b in p["boxes"]]}
        for p in data["pallets"]
    ]
    return job_id, data, pallets_patch


# ── identity patch passes ──────────────────────────────────────────────────────

def test_valid_identity_patch():
    job_id, data, patch = _run_job()
    r = client.patch(f"/api/v1/jobs/{job_id}/layout",
                     json={"pallets": patch, "settings": {"edge_threshold_length_mm": 0,
                                                           "edge_threshold_width_mm": 0,
                                                           "snap_grid_mm": 50}})
    assert r.status_code == 200
    resp = r.json()
    assert resp["manually_adjusted"] is True
    assert resp["validation"]["is_valid"] is True
    assert resp["validation"]["errors"] == []


# ── overlap rejected ───────────────────────────────────────────────────────────

def test_overlap_rejected():
    job_id, data, _ = _run_job()
    boxes = [b for p in data["pallets"] for b in p["boxes"]]
    if len(boxes) < 2:
        pytest.skip("Need ≥2 boxes")
    b0, b1 = boxes[0], boxes[1]
    patch = {"pallets": [{"pallet_no": 1, "boxes": [
        {"box_id": b0["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": 0,
         "length_mm": b0["length_mm"], "width_mm": b0["width_mm"],
         "height_mm": b0["height_mm"], "rotation": "LWH", "layer": 1},
        {"box_id": b1["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": 0,
         "length_mm": b1["length_mm"], "width_mm": b1["width_mm"],
         "height_mm": b1["height_mm"], "rotation": "LWH", "layer": 1},
    ]}], "settings": {"edge_threshold_length_mm": 0, "edge_threshold_width_mm": 0, "snap_grid_mm": 50}}
    r = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    resp = r.json()
    assert resp["validation"]["is_valid"] is False
    assert any("overlap" in e for e in resp["validation"]["errors"])


# ── floating rejected ──────────────────────────────────────────────────────────

def test_floating_rejected():
    job_id, data, _ = _run_job()
    boxes = [b for p in data["pallets"] for b in p["boxes"]]
    b0 = boxes[0]
    patch = {"pallets": [{"pallet_no": 1, "boxes": [
        {"box_id": b0["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": 500,   # floating!
         "length_mm": b0["length_mm"], "width_mm": b0["width_mm"],
         "height_mm": b0["height_mm"], "rotation": "LWH", "layer": 2},
    ]}], "settings": {"edge_threshold_length_mm": 0, "edge_threshold_width_mm": 0, "snap_grid_mm": 50}}
    r = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    resp = r.json()
    assert resp["validation"]["is_valid"] is False
    assert any("floating" in e.lower() for e in resp["validation"]["errors"])


# ── edge threshold boundary rejected ──────────────────────────────────────────

def test_threshold_boundary_rejected():
    job_id, data, _ = _run_job()
    b0 = data["pallets"][0]["boxes"][0]
    patch = {"pallets": [{"pallet_no": 1, "boxes": [
        {"box_id": b0["box_id"], "x_mm": 5, "y_mm": 5, "z_mm": 0,
         "length_mm": b0["length_mm"], "width_mm": b0["width_mm"],
         "height_mm": b0["height_mm"], "rotation": "LWH", "layer": 1},
    ]}], "settings": {"edge_threshold_length_mm": 20, "edge_threshold_width_mm": 20, "snap_grid_mm": 50}}
    r = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    resp = r.json()
    assert resp["validation"]["is_valid"] is False
    assert any("threshold" in e.lower() or "edge" in e.lower() for e in resp["validation"]["errors"])


# ── no_load_on_top rejected ────────────────────────────────────────────────────

def test_no_load_on_top_rejected():
    """Box B stacked on box A which has no_load_on_top=True → error."""
    items = [
        {"sku": "BASE", "quantity": 1, "length_mm": 400, "width_mm": 300,
         "height_mm": 200, "weight_kg": 2.0, "no_load_on_top": True, "stand_upright_only": False},
        {"sku": "TOP", "quantity": 1, "length_mm": 300, "width_mm": 200,
         "height_mm": 150, "weight_kg": 1.0, "no_load_on_top": False, "stand_upright_only": False},
    ]
    r = client.post("/api/v1/palletise", json={
        "order_id": "NLT-TEST", "algorithm": "EXTREME_POINT",
        "pallet": PALLET, "constraints": CONSTRAINTS, "items": items,
    })
    job_id = r.json()["job_id"]
    data = r.json()
    boxes = [b for p in data["pallets"] for b in p["boxes"]]
    base = next(b for b in boxes if b["sku"] == "BASE")
    top = next(b for b in boxes if b["sku"] == "TOP")

    patch = {"pallets": [{"pallet_no": 1, "boxes": [
        {"box_id": base["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": 0,
         "length_mm": base["length_mm"], "width_mm": base["width_mm"],
         "height_mm": base["height_mm"], "rotation": "LWH", "layer": 1},
        {"box_id": top["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": base["height_mm"],
         "length_mm": top["length_mm"], "width_mm": top["width_mm"],
         "height_mm": top["height_mm"], "rotation": "LWH", "layer": 2},
    ]}], "settings": {"edge_threshold_length_mm": 0, "edge_threshold_width_mm": 0, "snap_grid_mm": 50}}

    resp = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch).json()
    assert resp["validation"]["is_valid"] is False
    assert any("no_load_on_top" in e for e in resp["validation"]["errors"])


# ── stand_upright_only rotation rejected ──────────────────────────────────────

def test_stand_upright_only_rejects_height_change():
    """Changing height_mm for a stand_upright_only box → error."""
    items = [
        {"sku": "UPRIGHT", "quantity": 1, "length_mm": 400, "width_mm": 300,
         "height_mm": 200, "weight_kg": 2.0, "no_load_on_top": False, "stand_upright_only": True},
    ]
    r = client.post("/api/v1/palletise", json={
        "order_id": "SU-TEST", "algorithm": "EXTREME_POINT",
        "pallet": PALLET, "constraints": CONSTRAINTS, "items": items,
    })
    job_id = r.json()["job_id"]
    data = r.json()
    b = data["pallets"][0]["boxes"][0]

    patch = {"pallets": [{"pallet_no": 1, "boxes": [
        {"box_id": b["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": 0,
         # Swap height and length (simulating rotation that changes vertical axis)
         "length_mm": b["height_mm"], "width_mm": b["width_mm"],
         "height_mm": b["length_mm"],
         "rotation": "HWL", "layer": 1},
    ]}], "settings": {"edge_threshold_length_mm": 0, "edge_threshold_width_mm": 0, "snap_grid_mm": 50}}

    resp = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch).json()
    assert resp["validation"]["is_valid"] is False
    assert any("stand_upright_only" in e for e in resp["validation"]["errors"])


# ── max height rejected ────────────────────────────────────────────────────────

def test_max_height_rejected():
    job_id, data, _ = _run_job()
    b0 = data["pallets"][0]["boxes"][0]
    patch = {"pallets": [{"pallet_no": 1, "boxes": [
        {"box_id": b0["box_id"], "x_mm": 0, "y_mm": 0, "z_mm": 1100,
         "length_mm": b0["length_mm"], "width_mm": b0["width_mm"],
         "height_mm": 200, "rotation": "LWH", "layer": 5},
    ]}], "settings": {"edge_threshold_length_mm": 0, "edge_threshold_width_mm": 0, "snap_grid_mm": 50}}
    r = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    resp = r.json()
    assert resp["validation"]["is_valid"] is False
    assert any("height" in e.lower() for e in resp["validation"]["errors"])


# ── unknown box rejected ───────────────────────────────────────────────────────

def test_unknown_box_rejected():
    job_id, _, _ = _run_job()
    patch = {"pallets": [{"pallet_no": 1, "boxes": [
        {"box_id": "GHOST_BOX_999", "x_mm": 0, "y_mm": 0, "z_mm": 0,
         "length_mm": 100, "width_mm": 100, "height_mm": 100, "rotation": "LWH", "layer": 1},
    ]}], "settings": {"edge_threshold_length_mm": 0, "edge_threshold_width_mm": 0, "snap_grid_mm": 50}}
    r = client.patch(f"/api/v1/jobs/{job_id}/layout", json=patch)
    resp = r.json()
    assert any("not in the original" in e or "unknown" in e.lower()
               for e in resp["validation"]["errors"])


# ── missing box warned ─────────────────────────────────────────────────────────

def test_missing_box_warned():
    job_id, data, patch = _run_job()
    # Remove first box from patch
    patch[0]["boxes"] = patch[0]["boxes"][1:]
    r = client.patch(f"/api/v1/jobs/{job_id}/layout",
                     json={"pallets": patch, "settings": {"edge_threshold_length_mm": 0,
                                                           "edge_threshold_width_mm": 0,
                                                           "snap_grid_mm": 50}})
    resp = r.json()
    assert any("missing" in w.lower() for w in resp["validation"]["warnings"])


# ── adjusted layout reflected in GET ──────────────────────────────────────────

def test_adjusted_reflected_in_get():
    job_id, data, patch = _run_job()
    client.patch(f"/api/v1/jobs/{job_id}/layout",
                 json={"pallets": patch, "settings": {}})
    get = client.get(f"/api/v1/jobs/{job_id}").json()
    assert get["manually_adjusted"] is True
    assert get["layout_source"] == "manual_adjusted"


# ── CSV export reflects layout_source ─────────────────────────────────────────

def test_csv_layout_source():
    job_id, data, patch = _run_job()
    r1 = client.get(f"/api/v1/jobs/{job_id}/export/csv")
    assert "generated" in r1.text

    client.patch(f"/api/v1/jobs/{job_id}/layout",
                 json={"pallets": patch, "settings": {}})
    r2 = client.get(f"/api/v1/jobs/{job_id}/export/csv")
    assert "manual_adjusted" in r2.text


# ── constraint fields carried through from generation ─────────────────────────

def test_constraints_in_generated_result():
    items = [
        {"sku": "X", "quantity": 1, "length_mm": 300, "width_mm": 200, "height_mm": 150,
         "weight_kg": 1.0, "stand_upright_only": True, "no_load_on_top": True},
    ]
    r = client.post("/api/v1/palletise", json={
        "order_id": "CONST-TEST", "algorithm": "EXTREME_POINT",
        "pallet": PALLET, "constraints": CONSTRAINTS, "items": items,
    })
    data = r.json()
    box = data["pallets"][0]["boxes"][0]
    assert box["stand_upright_only"] is True
    assert box["no_load_on_top"] is True
    assert box["original_height_mm"] == 150.0
