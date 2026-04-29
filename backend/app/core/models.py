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
    lot_no: Optional[str] = None
    expiry_date: Optional[str] = None
    location: Optional[str] = None
    requested_delivery_date: Optional[str] = None
    # Placement results
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    rotation: str = "LWH"
    placed: bool = False
    layer: int = 1
    pick_sequence: int = 0

    @property
    def volume(self) -> float:
        return self.length * self.width * self.height

    def rotations(self, allow: bool = True) -> List[Tuple[float, float, float, str]]:
        """Return possible (l, w, h, label) rotations."""
        l, w, h = self.length, self.width, self.height
        if not allow:
            return [(l, w, h, "LWH")]
        seen = set()
        result = []
        for dims, label in [
            ((l, w, h), "LWH"),
            ((l, h, w), "LHW"),
            ((w, l, h), "WLH"),
            ((w, h, l), "WHL"),
            ((h, l, w), "HLW"),
            ((h, w, l), "HWL"),
        ]:
            key = tuple(sorted(dims))
            if key not in seen:
                seen.add(key)
                result.append(dims + (label,))
        return result


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
