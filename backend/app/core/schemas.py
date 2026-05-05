from pydantic import AliasChoices, BaseModel, Field, model_validator
from typing import List, Optional, Dict, Any, Literal, Union
from enum import Enum


class AlgorithmType(str, Enum):
    FIRST_FIT = "FIRST_FIT"
    BEST_FIT = "BEST_FIT"
    EXTREME_POINT = "EXTREME_POINT"
    GENETIC = "GENETIC"
    AUTO = "AUTO"


class StackBy(str, Enum):
    WEIGHT = "weight"
    VOLUME = "volume"
    HEIGHT = "height"


class PalletSpec(BaseModel):
    length_mm: float = Field(default=1200, gt=0)
    width_mm: float = Field(default=1100, gt=0)
    max_height_mm: float = Field(default=1150, gt=0)
    max_weight_kg: float = Field(default=1500, gt=0)


class Constraints(BaseModel):
    allow_rotation: bool = True
    fractional_quantity_mode: Literal["ceil", "floor", "exact_error", "ignore_fractional_zero"] = "ceil"
    do_not_allow_stability_issues: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "do_not_allow_stability_issues",
            "no_stability_issues",
            "disallow_stability_issues",
        ),
    )
    prefer_larger_base: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "prefer_larger_base",
            "prefer_lay_flat",
            "lay_down_larger_base",
        ),
    )
    stack_by: StackBy = StackBy.WEIGHT
    mix_products: bool = True
    respect_fefo: bool = True
    respect_delivery_date: bool = False
    prefer_partial_pallets: bool = True
    prefer_location_cluster: bool = True


class ItemRequest(BaseModel):
    sku: str
    nia_item_code: Optional[str] = None
    description_of_goods: Optional[str] = None
    quantity: float = Field(default=1)
    total_qty_pcs: Optional[float] = None
    qty_per_ctn: Optional[float] = None
    length_mm: float = Field(gt=0)
    width_mm: float = Field(gt=0)
    height_mm: float = Field(gt=0)
    weight_kg: float = Field(default=0, ge=0)
    # Box constraints
    stand_upright_only: bool = False
    no_load_on_top: bool = False
    # Optional warehouse fields
    item: Optional[str] = None
    lot_no: Optional[str] = None
    pallet_id: Optional[str] = None
    description: Optional[str] = None
    category_name: Optional[str] = None
    organisation: Optional[str] = None
    uom: Optional[str] = None
    requested_delivery_date: Optional[str] = None
    expiry_date: Optional[str] = None
    location: Optional[str] = None
    product_manufacturing_location: Optional[str] = None
    country_of_origin: Optional[str] = None
    line_id: Optional[str] = None
    source_row: Optional[int] = None
    store: Optional[str] = None
    dc: Optional[str] = None
    store_no: Optional[str] = None
    dc_no: Optional[str] = None
    center_label: Optional[str] = None
    center_expected_cartons: Optional[float] = None

    @model_validator(mode="before")
    @classmethod
    def normalise_raw_item(cls, data):
        if not isinstance(data, dict):
            return data
        normalised = dict(data)
        if not normalised.get("sku") and normalised.get("nia_item_code"):
            normalised["sku"] = normalised["nia_item_code"]
        if not normalised.get("description") and normalised.get("description_of_goods"):
            normalised["description"] = normalised["description_of_goods"]
        if not normalised.get("store_no") and normalised.get("store"):
            normalised["store_no"] = normalised["store"]
        if not normalised.get("dc_no") and normalised.get("dc"):
            normalised["dc_no"] = normalised["dc"]
        return normalised


class PalletiseRequest(BaseModel):
    order_id: str = ""
    algorithm: AlgorithmType = AlgorithmType.EXTREME_POINT
    pallet: PalletSpec = PalletSpec()
    constraints: Constraints = Constraints()
    items: List[ItemRequest]


class CompareRequest(BaseModel):
    order_id: str = ""
    algorithms: List[AlgorithmType] = [
        AlgorithmType.FIRST_FIT,
        AlgorithmType.BEST_FIT,
        AlgorithmType.EXTREME_POINT,
        AlgorithmType.GENETIC,
    ]
    pallet: PalletSpec = PalletSpec()
    constraints: Constraints = Constraints()
    items: List[ItemRequest]


class BoxResult(BaseModel):
    box_id: str
    sku: str
    nia_item_code: Optional[str] = None
    description_of_goods: Optional[str] = None
    lot_no: Optional[str] = None
    line_id: Optional[str] = None
    source_row: Optional[int] = None
    store_no: Optional[str] = None
    dc_no: Optional[str] = None
    center_label: Optional[str] = None
    center_expected_cartons: Optional[float] = None
    original_quantity: Optional[float] = None
    partial_carton: bool = False
    carton_index: Optional[int] = None
    x_mm: float
    y_mm: float
    z_mm: float
    length_mm: float
    width_mm: float
    height_mm: float
    weight_kg: float
    rotation: str = "LWH"
    base_area_mm2: Optional[float] = None
    is_larger_base_orientation: Optional[bool] = None
    layer: int = 1
    pick_sequence: int = 1
    location: Optional[str] = None
    expiry_date: Optional[str] = None
    # Box constraints (carried through from ItemRequest)
    stand_upright_only: bool = False
    no_load_on_top: bool = False
    # original_height_mm: preserved for stand_upright_only validation
    original_height_mm: Optional[float] = None


class PalletResult(BaseModel):
    pallet_no: int
    volume_utilisation_pct: float
    area_utilisation_pct: float
    weight_kg: float
    box_count: int
    sku_totals: Dict[str, int] = Field(default_factory=dict)
    boxes: List[BoxResult]


class StabilityIssue(BaseModel):
    type: str
    severity: str = "warning"
    box_id: Optional[str] = None
    pallet_no: Optional[int] = None
    sku: Optional[str] = None
    message: str


class UnplacedBox(BaseModel):
    box_id: str
    sku: str
    reason: str


class StabilitySummary(BaseModel):
    is_stable: bool
    issues: List[StabilityIssue] = []


class WarningItem(BaseModel):
    id: str
    type: Optional[str] = None
    sku: Optional[str] = None
    message: str
    dismissible: bool = False


class CenterTotal(BaseModel):
    input_lines: int = 0
    expected_cartons: Optional[float] = None
    expanded_cartons: int = 0
    quantity_sum_raw: float = 0


class SummaryResult(BaseModel):
    pallets_used: int
    total_boxes: int
    average_volume_utilisation_pct: float
    average_area_utilisation_pct: float
    total_weight_kg: float
    floating_boxes: int
    unstable_boxes: int
    stability_issues: List[StabilityIssue] = []
    sku_totals: Dict[str, int] = Field(default_factory=dict)
    request_total_boxes: int = 0
    request_sku_totals: Dict[str, int] = Field(default_factory=dict)
    center_totals: Dict[str, CenterTotal] = Field(default_factory=dict)
    warnings: List[Union[str, WarningItem]] = []


class PalletiseResponse(BaseModel):
    job_id: str
    order_id: str
    status: str
    algorithm_used: str
    summary: SummaryResult
    pallets: List[PalletResult]
    constraints_used: Dict[str, Any] = Field(default_factory=dict)
    stability: StabilitySummary = Field(default_factory=lambda: StabilitySummary(is_stable=True))
    unplaced_boxes: List[UnplacedBox] = []


class AlgorithmCompareEntry(BaseModel):
    algorithm: str
    pallets_used: int
    average_volume_utilisation_pct: float
    average_area_utilisation_pct: float
    total_weight_kg: float
    floating_boxes: int
    unstable_boxes: int
    warnings: List[Union[str, WarningItem]] = []
    job_id: str


class CompareResponse(BaseModel):
    order_id: str
    results: List[AlgorithmCompareEntry]


class UploadResponse(BaseModel):
    filename: str
    rows_parsed: int
    items: List[Dict[str, Any]]
    warnings: List[str] = []


class JobStatus(BaseModel):
    job_id: str
    status: str
    created_at: str
    algorithm_used: Optional[str] = None
    order_id: Optional[str] = None


# ── Manual Adjustment ──────────────────────────────────────────────────────────

class ManualAdjustmentSettings(BaseModel):
    edge_threshold_length_mm: float = 0.0
    edge_threshold_width_mm: float = 0.0
    snap_grid_mm: int = 50
    drag_sensitivity: float = 0.35
    autoFitSearchRadiusMm: float = 150.0
    do_not_allow_stability_issues: bool = True
    prefer_larger_base: bool = False


class BoxPatch(BaseModel):
    box_id: str
    x_mm: float
    y_mm: float
    z_mm: float
    length_mm: float
    width_mm: float
    height_mm: float
    rotation: str = "LWH"
    layer: int = 1
    # Constraints — frontend echoes these back; backend overrides with originals
    stand_upright_only: bool = False
    no_load_on_top: bool = False
    manual_locked: bool = False


class PalletPatch(BaseModel):
    pallet_no: int
    boxes: List[BoxPatch]


class LayoutPatchRequest(BaseModel):
    pallets: List[PalletPatch]
    settings: ManualAdjustmentSettings = ManualAdjustmentSettings()


class AdjustmentValidation(BaseModel):
    is_valid: bool
    invalidBoxIds: List[str] = []
    issues: List[StabilityIssue] = []
    errors: List[str] = []
    warnings: List[str] = []


class LayoutPatchResponse(BaseModel):
    job_id: str
    status: str
    manually_adjusted: bool
    adjusted_at: str
    layout_source: str = "manual_adjusted"
    validation: AdjustmentValidation
