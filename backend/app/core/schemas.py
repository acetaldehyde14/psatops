from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date
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
    width_mm: float = Field(default=1000, gt=0)
    max_height_mm: float = Field(default=1150, gt=0)
    max_weight_kg: float = Field(default=1500, gt=0)


class Constraints(BaseModel):
    allow_rotation: bool = True
    stack_by: StackBy = StackBy.WEIGHT
    mix_products: bool = True
    respect_fefo: bool = True
    respect_delivery_date: bool = False
    prefer_partial_pallets: bool = True
    prefer_location_cluster: bool = True


class ItemRequest(BaseModel):
    sku: str
    quantity: int = Field(default=1, ge=1)
    length_mm: float = Field(gt=0)
    width_mm: float = Field(gt=0)
    height_mm: float = Field(gt=0)
    weight_kg: float = Field(gt=0)
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
    store_no: Optional[str] = None
    dc_no: Optional[str] = None


class PalletiseRequest(BaseModel):
    order_id: str = "ORD-001"
    algorithm: AlgorithmType = AlgorithmType.EXTREME_POINT
    pallet: PalletSpec = PalletSpec()
    constraints: Constraints = Constraints()
    items: List[ItemRequest]


class CompareRequest(BaseModel):
    order_id: str = "ORD-001"
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
    lot_no: Optional[str] = None
    x_mm: float
    y_mm: float
    z_mm: float
    length_mm: float
    width_mm: float
    height_mm: float
    weight_kg: float
    rotation: str = "LWH"
    layer: int = 1
    pick_sequence: int = 1
    location: Optional[str] = None
    expiry_date: Optional[str] = None


class PalletResult(BaseModel):
    pallet_no: int
    volume_utilisation_pct: float
    area_utilisation_pct: float
    weight_kg: float
    box_count: int
    boxes: List[BoxResult]


class SummaryResult(BaseModel):
    pallets_used: int
    total_boxes: int
    average_volume_utilisation_pct: float
    average_area_utilisation_pct: float
    total_weight_kg: float
    floating_boxes: int
    unstable_boxes: int
    warnings: List[str] = []


class PalletiseResponse(BaseModel):
    job_id: str
    order_id: str
    status: str
    algorithm_used: str
    summary: SummaryResult
    pallets: List[PalletResult]


class AlgorithmCompareEntry(BaseModel):
    algorithm: str
    pallets_used: int
    average_volume_utilisation_pct: float
    average_area_utilisation_pct: float
    total_weight_kg: float
    floating_boxes: int
    unstable_boxes: int
    warnings: List[str] = []
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
