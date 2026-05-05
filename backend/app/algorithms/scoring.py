"""Scoring utilities for comparing algorithm outputs."""
from typing import List
from app.core.models import Box, Pallet
from app.algorithms.placement import support_fraction_for, SUPPORT_THRESHOLD


def score_solution(pallets: List[Pallet], constraints=None) -> float:
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
    stability_penalty = 0.0
    orientation_score = 0.0
    for p in pallets:
        if not p.boxes:
            continue
        total_w = sum(b.weight for b in p.boxes) or 1
        cx = sum((b.x + b.length / 2) * b.weight for b in p.boxes) / total_w
        cy = sum((b.y + b.width / 2) * b.weight for b in p.boxes) / total_w
        cog_penalty += abs(cx - p.length / 2) + abs(cy - p.width / 2)
        for b in p.boxes:
            if getattr(constraints, "prefer_larger_base", False):
                orientation_score += -0.001 * (b.length * b.width) + 0.01 * b.height
            if not getattr(constraints, "do_not_allow_stability_issues", True):
                frac = support_fraction_for(b, p, b.x, b.y, b.z)
                if frac < SUPPORT_THRESHOLD:
                    stability_penalty += (SUPPORT_THRESHOLD - frac) * 500

    score = n * 1000 - avg_util * 500 + cog_penalty * 0.001 + stability_penalty + orientation_score
    return score


def score_candidate(candidate: Box, pallet: Pallet, constraints=None) -> float:
    """Score a single placement candidate. Lower is better."""
    score = candidate.z * 1000 + candidate.x + candidate.y

    if getattr(constraints, "prefer_larger_base", False) and not getattr(candidate, "stand_upright_only", False):
        base_area = candidate.length * candidate.width
        score -= base_area * 0.01
        score += candidate.height * 5

        original_dims = [
            getattr(candidate, "original_length", None) or candidate.length,
            getattr(candidate, "original_width", None) or candidate.width,
            getattr(candidate, "original_height", None) or candidate.height,
        ]
        smallest_dim = min(original_dims)
        if abs(candidate.height - smallest_dim) > 1e-6:
            score += 100000

    return score
