"""
Domain models used internally by algorithms.
These are plain Python dataclasses for performance.
"""
from dataclasses import dataclass, field
from typing import List, Optional, Tuple


@dataclass
class Box:
    box_id: str
    sku: str
    length: float  # mm
    width: float   # mm
    height: float  # mm
    weight: float  # kg
    original_length: Optional[float] = None
    original_width: Optional[float] = None
    original_height: Optional[float] = None
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
    expiry_date: Optional[str] = None
    location: Optional[str] = None
    requested_delivery_date: Optional[str] = None
    # Box constraints
    stand_upright_only: bool = False
    no_load_on_top: bool = False
    # Placement results
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    rotation: str = "LWH"
    placed: bool = False
    layer: int = 1
    pick_sequence: int = 0

    def __post_init__(self) -> None:
        if self.original_length is None:
            self.original_length = self.length
        if self.original_width is None:
            self.original_width = self.width
        if self.original_height is None:
            self.original_height = self.height

    @property
    def volume(self) -> float:
        return self.length * self.width * self.height

    def rotations(self, allow: bool = True) -> List[Tuple[float, float, float, str]]:
        """Return possible (l, w, h, label) rotations."""
        from app.algorithms.rotations import get_allowed_rotations
        return get_allowed_rotations(self, allow_rotation=allow)


@dataclass
class Pallet:
    length: float   # mm
    width: float    # mm
    max_height: float  # mm
    max_weight: float  # kg
    boxes: List[Box] = field(default_factory=list)
    pallet_no: int = 1

    @property
    def volume_capacity(self) -> float:
        return self.length * self.width * self.max_height

    @property
    def footprint_area(self) -> float:
        return self.length * self.width

    @property
    def used_volume(self) -> float:
        return sum(b.length * b.width * b.height for b in self.boxes)

    @property
    def used_weight(self) -> float:
        return sum(b.weight for b in self.boxes)

    @property
    def current_height(self) -> float:
        if not self.boxes:
            return 0.0
        return max(b.z + b.height for b in self.boxes)
