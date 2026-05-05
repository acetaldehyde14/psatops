from app.algorithms.first_fit import _can_place
from app.algorithms.rotations import get_allowed_rotations
from app.core.models import Box, Pallet
from app.core.schemas import Constraints, ManualAdjustmentSettings
from app.services.layout_validation_service import validate_adjusted_layout


def _pallet() -> Pallet:
    return Pallet(length=1200, width=1100, max_height=1150, max_weight=1500, pallet_no=1)


def test_strict_stability_rejects_insufficient_support():
    pallet = _pallet()
    pallet.boxes.append(Box(box_id="base", sku="A", length=400, width=400, height=200, weight=1, x=0, y=0, z=0))
    top = Box(box_id="top", sku="B", length=700, width=400, height=100, weight=1)
    strict = Constraints(do_not_allow_stability_issues=True)
    assert _can_place(pallet, top, 0, 0, 200, strict) is False


def test_non_strict_stability_allows_insufficient_support():
    pallet = _pallet()
    pallet.boxes.append(Box(box_id="base", sku="A", length=400, width=400, height=200, weight=1, x=0, y=0, z=0))
    top = Box(box_id="top", sku="B", length=700, width=400, height=100, weight=1)
    loose = Constraints(do_not_allow_stability_issues=False)
    assert _can_place(pallet, top, 0, 0, 200, loose) is True


def test_prefer_larger_base_sorts_rotation_order():
    box = Box(box_id="box_001", sku="A", length=400, width=540, height=230, weight=1)
    default_rotations = get_allowed_rotations(box, allow_rotation=True, prefer_larger_base=False)
    preferred_rotations = get_allowed_rotations(box, allow_rotation=True, prefer_larger_base=True)

    assert default_rotations[0] == (400, 540, 230, "LWH")
    assert preferred_rotations[0][0] * preferred_rotations[0][1] == 216000
    assert preferred_rotations[0][2] == 230
    assert preferred_rotations[0][3] in {"LWH", "WLH"}


def test_stand_upright_only_keeps_height_vertical_with_larger_base():
    box = Box(box_id="box_001", sku="A", length=400, width=540, height=230, weight=1, stand_upright_only=True)
    rotations = get_allowed_rotations(box, allow_rotation=True, prefer_larger_base=True)
    assert {rot[2] for rot in rotations} == {230}
    assert [rot[3] for rot in rotations] == ["LWH", "WLH"]


def test_flat_box_larger_base_keeps_thin_height_vertical():
    box = Box(box_id="box_001", sku="A", length=400, width=540, height=9.6, weight=1)
    rotations = get_allowed_rotations(box, allow_rotation=True, prefer_larger_base=True)
    assert rotations[0] == (400, 540, 9.6, "LWH")


def test_thin_slab_larger_base_rotation_order_lays_flat():
    box = Box(box_id="box_001", sku="THIN", length=430, width=21.6, height=250, weight=1)
    rotations = get_allowed_rotations(box, allow_rotation=True, prefer_larger_base=True)
    assert rotations[0] in {
        (430, 250, 21.6, "LHW"),
        (250, 430, 21.6, "HLW"),
    }
    assert rotations[0][2] == 21.6


def test_palletise_prefer_larger_base_changes_rotation_order():
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    base_request = {
        "order_id": "ROTATION-PREF",
        "algorithm": "EXTREME_POINT",
        "pallet": {
            "length_mm": 1200,
            "width_mm": 1100,
            "max_height_mm": 1150,
            "max_weight_kg": 1500,
        },
        "constraints": {
            "allow_rotation": True,
            "stack_by": "weight",
            "mix_products": True,
            "respect_fefo": False,
            "respect_delivery_date": False,
            "prefer_partial_pallets": True,
            "prefer_location_cluster": False,
            "do_not_allow_stability_issues": True,
            "prefer_larger_base": False,
        },
        "items": [
            {
                "sku": "ROTATE-ME",
                "quantity": 1,
                "length_mm": 400,
                "width_mm": 230,
                "height_mm": 540,
                "weight_kg": 1,
            }
        ],
    }

    default_response = client.post("/api/v1/palletise", json=base_request)
    preferred_request = {
        **base_request,
        "constraints": {**base_request["constraints"], "prefer_larger_base": True},
    }
    preferred_response = client.post("/api/v1/palletise", json=preferred_request)

    assert default_response.status_code == 200
    assert preferred_response.status_code == 200
    default_box = default_response.json()["pallets"][0]["boxes"][0]
    preferred_box = preferred_response.json()["pallets"][0]["boxes"][0]
    assert default_box["rotation"] != preferred_box["rotation"]
    assert preferred_box["height_mm"] == 230


def _thin_slab_request(quantity=1, stand_upright_only=False):
    return {
        "order_id": "THIN-SLAB",
        "algorithm": "EXTREME_POINT",
        "pallet": {
            "length_mm": 1200,
            "width_mm": 1100,
            "max_height_mm": 1150,
            "max_weight_kg": 1500,
        },
        "constraints": {
            "allow_rotation": True,
            "stack_by": "weight",
            "mix_products": True,
            "respect_fefo": False,
            "respect_delivery_date": False,
            "prefer_partial_pallets": True,
            "prefer_location_cluster": False,
            "do_not_allow_stability_issues": True,
            "prefer_larger_base": True,
        },
        "items": [
            {
                "sku": "THIN",
                "quantity": quantity,
                "length_mm": 430,
                "width_mm": 21.6,
                "height_mm": 250,
                "weight_kg": 1,
                "stand_upright_only": stand_upright_only,
            }
        ],
    }


def test_extreme_point_lays_thin_box_flat_with_larger_base():
    from fastapi.testclient import TestClient
    from app.main import app

    response = TestClient(app).post("/api/v1/palletise", json=_thin_slab_request())

    assert response.status_code == 200
    box = response.json()["pallets"][0]["boxes"][0]
    assert box["height_mm"] == 21.6
    assert box["base_area_mm2"] == 430 * 250
    assert box["is_larger_base_orientation"] is True


def test_extreme_point_keeps_thin_box_upright_when_required():
    from fastapi.testclient import TestClient
    from app.main import app

    response = TestClient(app).post(
        "/api/v1/palletise",
        json=_thin_slab_request(stand_upright_only=True),
    )

    assert response.status_code == 200
    box = response.json()["pallets"][0]["boxes"][0]
    assert box["height_mm"] == 250
    assert box["base_area_mm2"] == 430 * 21.6
    assert box["is_larger_base_orientation"] is True


def test_extreme_point_lays_multiple_thin_boxes_flat_when_possible():
    from fastapi.testclient import TestClient
    from app.main import app

    response = TestClient(app).post("/api/v1/palletise", json=_thin_slab_request(quantity=10))

    assert response.status_code == 200
    boxes = [box for pallet in response.json()["pallets"] for box in pallet["boxes"]]
    assert len(boxes) == 10
    assert all(box["height_mm"] == 21.6 for box in boxes)
    assert all(box["is_larger_base_orientation"] is True for box in boxes)


def test_no_load_on_top_respects_manual_stability_setting():
    original = Box(
        box_id="base",
        sku="A",
        length=400,
        width=400,
        height=200,
        weight=1,
        no_load_on_top=True,
    )
    layout = {
        "pallets": [{
            "pallet_no": 1,
            "boxes": [
                {"box_id": "base", "x_mm": 0, "y_mm": 0, "z_mm": 0, "length_mm": 400, "width_mm": 400, "height_mm": 200, "rotation": "LWH", "layer": 1},
                {"box_id": "top", "x_mm": 0, "y_mm": 0, "z_mm": 200, "length_mm": 200, "width_mm": 200, "height_mm": 100, "rotation": "LWH", "layer": 2},
            ],
        }],
        "settings": ManualAdjustmentSettings(do_not_allow_stability_issues=False).model_dump(),
    }
    from app.core.schemas import LayoutPatchRequest
    loose = validate_adjusted_layout(
        LayoutPatchRequest.model_validate(layout),
        {"length_mm": 1200, "width_mm": 1100, "max_height_mm": 1150, "max_weight_kg": 1500},
        {"base", "top"},
        {"base": original},
    )
    assert loose.is_valid is True
    assert any("no_load_on_top" in warning for warning in loose.warnings)

    layout["settings"]["do_not_allow_stability_issues"] = True
    strict = validate_adjusted_layout(
        LayoutPatchRequest.model_validate(layout),
        {"length_mm": 1200, "width_mm": 1100, "max_height_mm": 1150, "max_weight_kg": 1500},
        {"base", "top"},
        {"base": original},
    )
    assert strict.is_valid is False
    assert any("no_load_on_top" in error for error in strict.errors)
