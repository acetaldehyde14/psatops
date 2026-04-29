"""Scoring utilities for comparing algorithm outputs."""
from typing import List
from app.core.models import Pallet


def score_solution(pallets: List[Pallet]) -> float:
    """
    Lower score is better.
    Components:
      - pallet count (dominant)
      - average volume utilisation (inverse)
      - centre-of-gravity offset
    """
    if not pallets:
        return float("inf")

    n = len(pallets)
    vol_scores = []
    for p in pallets:
        cap = p.volume_capacity
        util = p.used_volume / cap if cap > 0 else 0
        vol_scores.append(util)

    avg_util = sum(vol_scores) / len(vol_scores) if vol_scores else 0

    # CoG offset penalty (simple: abs(CoG_x - pallet_length/2) + abs(CoG_y - pallet_width/2))
    cog_penalty = 0.0
    for p in pallets:
        if not p.boxes:
            continue
        total_w = sum(b.weight for b in p.boxes) or 1
        cx = sum((b.x + b.length / 2) * b.weight for b in p.boxes) / total_w
        cy = sum((b.y + b.width / 2) * b.weight for b in p.boxes) / total_w
        cog_penalty += abs(cx - p.length / 2) + abs(cy - p.width / 2)

    score = n * 1000 - avg_util * 500 + cog_penalty * 0.001
    return score
