"""
Genetic Algorithm scaffold for palletisation.
Evolves: box order, rotation preference, mixing strategy.
Uses EXTREME_POINT as the placement engine.
"""
import random
import copy
from typing import List
from app.core.models import Box, Pallet
from app.algorithms.extreme_point import run_extreme_point
from app.algorithms.scoring import score_solution


POPULATION_SIZE = 10
GENERATIONS = 5
MUTATION_RATE = 0.2
ELITE = 2


def _chromosome(boxes: List[Box]) -> List[int]:
    """A chromosome is a permutation of box indices."""
    indices = list(range(len(boxes)))
    random.shuffle(indices)
    return indices


def _decode(chromosome: List[int], boxes: List[Box], pallet_spec, allow_rotation: bool) -> List[Pallet]:
    ordered = [copy.deepcopy(boxes[i]) for i in chromosome]
    return run_extreme_point(ordered, pallet_spec, allow_rotation)


def _crossover(p1: List[int], p2: List[int]) -> List[int]:
    """Order crossover (OX)."""
    n = len(p1)
    a, b = sorted(random.sample(range(n), 2))
    child = [-1] * n
    child[a:b] = p1[a:b]
    fill = [x for x in p2 if x not in child]
    j = 0
    for i in range(n):
        if child[i] == -1:
            child[i] = fill[j]
            j += 1
    return child


def _mutate(chromosome: List[int]) -> List[int]:
    """Swap mutation."""
    c = chromosome[:]
    if len(c) >= 2 and random.random() < MUTATION_RATE:
        i, j = random.sample(range(len(c)), 2)
        c[i], c[j] = c[j], c[i]
    return c


def run_genetic(
    boxes: List[Box],
    pallet_spec,
    allow_rotation: bool = True,
) -> List[Pallet]:
    if not boxes:
        return []

    population = [_chromosome(boxes) for _ in range(POPULATION_SIZE)]
    best_solution = None
    best_score = float("inf")

    for gen in range(GENERATIONS):
        scored = []
        for chrom in population:
            pallets = _decode(chrom, boxes, pallet_spec, allow_rotation)
            s = score_solution(pallets)
            scored.append((s, chrom, pallets))
        scored.sort(key=lambda x: x[0])

        if scored[0][0] < best_score:
            best_score = scored[0][0]
            best_solution = scored[0][2]

        # Elitism + crossover
        next_gen = [scored[i][1] for i in range(ELITE)]
        while len(next_gen) < POPULATION_SIZE:
            p1 = random.choice(scored[:5])[1]
            p2 = random.choice(scored[:5])[1]
            child = _crossover(p1, p2)
            child = _mutate(child)
            next_gen.append(child)
        population = next_gen

    if best_solution is None:
        best_solution = _decode(population[0], boxes, pallet_spec, allow_rotation)

    return best_solution
