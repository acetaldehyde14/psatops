/**
 * Snapping utilities for manual pallet adjustment.
 * All values are in mm.
 */

export interface Rect2D {
  x: number;
  y: number;
  l: number;
  w: number;
}

export type SnapGuide =
  | { axis: "x"; value: number; source: "grid" | "threshold" | "box" | "gap"; magnetic?: boolean }
  | { axis: "y"; value: number; source: "grid" | "threshold" | "box" | "gap"; magnetic?: boolean };

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
  snappedToGap?: boolean;
}

export interface GapCandidate {
  startX: number;
  endX: number;
}

/** Snap a value to the nearest grid multiple. */
export function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

/** Snap a position to the pallet's edge threshold boundary lines. */
export function snapToPalletThreshold(
  box: Rect2D,
  pallet: { length_mm: number; width_mm: number },
  thresholds: { length_mm: number; width_mm: number },
  tolerance = 25,
): { x: number; y: number } {
  let { x, y } = box;
  const tl = thresholds.length_mm;
  const tw = thresholds.width_mm;
  const maxX = pallet.length_mm - tl - box.l;
  const maxY = pallet.width_mm - tw - box.w;

  // Snap left edge → threshold
  if (Math.abs(x - tl) < tolerance) x = tl;
  // Snap right edge → threshold boundary
  if (Math.abs(x - maxX) < tolerance) x = maxX;
  // Snap front edge → threshold
  if (Math.abs(y - tw) < tolerance) y = tw;
  // Snap back edge → threshold boundary
  if (Math.abs(y - maxY) < tolerance) y = maxY;

  return { x, y };
}

/**
 * Snap a moving box to the edges of neighbouring boxes on the XY plane.
 * Only snaps if within `tolerance` mm.
 */
export function snapBoxToNearbyBoxEdges(
  moving: Rect2D,
  others: Rect2D[],
  tolerance = 25,
): { x: number; y: number } {
  let bestX = moving.x;
  let bestY = moving.y;
  let minDx = tolerance + 1;
  let minDy = tolerance + 1;

  for (const o of others) {
    // Moving box left face ↔ other right face
    const dx1 = Math.abs(moving.x - (o.x + o.l));
    if (dx1 < minDx) { minDx = dx1; bestX = o.x + o.l; }

    // Moving box right face ↔ other left face
    const dx2 = Math.abs(moving.x + moving.l - o.x);
    if (dx2 < minDx) { minDx = dx2; bestX = o.x - moving.l; }

    // Moving box front face ↔ other back face
    const dy1 = Math.abs(moving.y - (o.y + o.w));
    if (dy1 < minDy) { minDy = dy1; bestY = o.y + o.w; }

    // Moving box back face ↔ other front face
    const dy2 = Math.abs(moving.y + moving.w - o.y);
    if (dy2 < minDy) { minDy = dy2; bestY = o.y - moving.w; }
  }

  return {
    x: minDx <= tolerance ? bestX : moving.x,
    y: minDy <= tolerance ? bestY : moving.y,
  };
}

/**
 * Apply all enabled snaps in priority order:
 * 1. Snap to pallet threshold
 * 2. Snap to nearby box edges
 * 3. Snap to grid
 */
export function applySnapping(
  candidate: { x: number; y: number },
  box: Rect2D,
  others: Rect2D[],
  pallet: { length_mm: number; width_mm: number },
  thresholds: { length_mm: number; width_mm: number },
  options: {
    snapGrid: number;
    snapToBoxEdges: boolean;
    snapToThreshold: boolean;
  },
): { x: number; y: number } {
  return applySnappingDetailed(candidate, box, others, pallet, thresholds, options);
}

export function applySnappingDetailed(
  candidate: { x: number; y: number },
  box: Rect2D,
  others: Rect2D[],
  pallet: { length_mm: number; width_mm: number },
  thresholds: { length_mm: number; width_mm: number },
  options: {
    snapGrid: number;
    snapToBoxEdges: boolean;
    snapToThreshold: boolean;
    tolerance?: number;
  },
): SnapResult {
  let { x, y } = candidate;
  const guides: SnapGuide[] = [];
  const tolerance = options.tolerance ?? 25;

  if (options.snapToThreshold) {
    const snapped = snapToPalletThreshold(
      { ...box, x, y },
      pallet,
      thresholds,
      tolerance,
    );
    if (snapped.x !== x) guides.push({ axis: "x", value: snapped.x, source: "threshold" });
    if (snapped.y !== y) guides.push({ axis: "y", value: snapped.y, source: "threshold" });
    x = snapped.x;
    y = snapped.y;
  }

  if (options.snapToBoxEdges) {
    const snapped = snapBoxToNearbyBoxEdges({ ...box, x, y }, others, tolerance);
    if (snapped.x !== x) guides.push({ axis: "x", value: snapped.x, source: "box" });
    if (snapped.y !== y) guides.push({ axis: "y", value: snapped.y, source: "box" });
    x = snapped.x;
    y = snapped.y;
  }

  if (options.snapGrid > 0) {
    const gx = snapToGrid(x, options.snapGrid);
    const gy = snapToGrid(y, options.snapGrid);
    if (Math.abs(gx - x) <= tolerance && gx !== x) {
      guides.push({ axis: "x", value: gx, source: "grid" });
      x = gx;
    }
    if (Math.abs(gy - y) <= tolerance && gy !== y) {
      guides.push({ axis: "y", value: gy, source: "grid" });
      y = gy;
    }
  }

  return { x, y, guides };
}

function yRangesNearOrOverlap(a: Rect2D, b: Rect2D, tolerance: number): boolean {
  return a.y < b.y + b.w + tolerance && a.y + a.w > b.y - tolerance;
}

export function findHorizontalGaps(
  moving: Rect2D,
  boxes: Rect2D[],
  pallet: { length_mm: number; width_mm: number },
  thresholds: { length_mm: number; width_mm: number },
  rowTolerance = 40,
): GapCandidate[] {
  const minX = thresholds.length_mm;
  const maxX = pallet.length_mm - thresholds.length_mm;
  const rowBoxes = boxes
    .filter((box) => yRangesNearOrOverlap(moving, box, rowTolerance))
    .sort((a, b) => a.x - b.x);
  const gaps: GapCandidate[] = [];
  let cursor = minX;

  for (const box of rowBoxes) {
    const gapStart = cursor;
    const gapEnd = box.x;
    if (gapEnd - gapStart >= moving.l) gaps.push({ startX: gapStart, endX: gapEnd });
    cursor = Math.max(cursor, box.x + box.l);
  }

  if (maxX - cursor >= moving.l) gaps.push({ startX: cursor, endX: maxX });
  return gaps;
}

export function snapToHorizontalGap(
  candidate: { x: number; y: number },
  moving: Rect2D,
  boxes: Rect2D[],
  pallet: { length_mm: number; width_mm: number },
  thresholds: { length_mm: number; width_mm: number },
  tolerance = 40,
): SnapResult {
  const gaps = findHorizontalGaps({ ...moving, ...candidate }, boxes, pallet, thresholds, tolerance);
  let best: GapCandidate | null = null;
  let bestDistance = tolerance + 1;

  for (const gap of gaps) {
    const distance = Math.min(
      Math.abs(candidate.x - gap.startX),
      Math.abs(candidate.x + moving.l - gap.endX),
      Math.abs(candidate.x + moving.l / 2 - (gap.startX + gap.endX) / 2),
    );
    if (distance < bestDistance) {
      best = gap;
      bestDistance = distance;
    }
  }

  if (!best || bestDistance > tolerance) {
    return { ...candidate, guides: [] };
  }

  return {
    x: best.startX,
    y: candidate.y,
    snappedToGap: true,
    guides: [
      { axis: "x", value: best.startX, source: "gap" },
      { axis: "x", value: best.endX, source: "gap" },
    ],
  };
}

// ── Magnetic Snap ─────────────────────────────────────────────────────────────

export interface MagneticSnapSettings {
  magneticSnapEnabled: boolean;
  /** Radius within which the box starts to feel the pull (default 60mm). */
  magneticSnapRadiusMm: number;
  /** Attraction strength 0–1 at closest edge of magnetic zone (default 0.65). */
  magneticSnapStrength: number;
  /** Within this distance the snap is hard/exact (default 8mm). */
  hardSnapRadiusMm: number;
}

/**
 * Apply smooth magnetic attraction toward the nearest snap target.
 *
 * Snap priority (closest within same priority wins):
 *   1. Box faces
 *   2. Pallet threshold edges
 *   3. Grid lines
 *
 * Guide lines are emitted for active targets so the caller can render them.
 * Hard snap (exact) fires when distance ≤ hardSnapRadiusMm.
 * Soft snap (partial pull) fires when distance is in (hardSnapRadiusMm, magneticSnapRadiusMm].
 *
 * When magneticSnapEnabled is false the function is a no-op (returns candidate as-is).
 */
export function applyMagneticSnap(
  candidate: { x: number; y: number },
  movingBox: Rect2D,
  otherBoxes: Rect2D[],
  pallet: { length_mm: number; width_mm: number },
  options: MagneticSnapSettings & {
    snapGrid: number;
    snapToBoxEdges: boolean;
    snapToThreshold: boolean;
    thresholds: { length_mm: number; width_mm: number };
  },
): SnapResult {
  if (!options.magneticSnapEnabled) {
    return { ...candidate, guides: [] };
  }

  const { hardSnapRadiusMm: hardR, magneticSnapRadiusMm: magR, magneticSnapStrength: strength } = options;
  const { thresholds } = options;

  type Target = { value: number; axis: "x" | "y"; source: SnapGuide["source"]; priority: number };
  const targets: Target[] = [];

  // Priority 1 — Box face snap
  if (options.snapToBoxEdges) {
    for (const o of otherBoxes) {
      targets.push({ value: o.x + o.l, axis: "x", source: "box", priority: 1 });
      targets.push({ value: o.x - movingBox.l, axis: "x", source: "box", priority: 1 });
      targets.push({ value: o.y + o.w, axis: "y", source: "box", priority: 1 });
      targets.push({ value: o.y - movingBox.w, axis: "y", source: "box", priority: 1 });
    }
  }

  // Priority 2 — Threshold edges
  if (options.snapToThreshold) {
    const tl = thresholds.length_mm;
    const tw = thresholds.width_mm;
    targets.push({ value: tl, axis: "x", source: "threshold", priority: 2 });
    targets.push({ value: pallet.length_mm - tl - movingBox.l, axis: "x", source: "threshold", priority: 2 });
    targets.push({ value: tw, axis: "y", source: "threshold", priority: 2 });
    targets.push({ value: pallet.width_mm - tw - movingBox.w, axis: "y", source: "threshold", priority: 2 });
  }

  // Priority 3 — Grid
  if (options.snapGrid > 0) {
    const gx = Math.round(candidate.x / options.snapGrid) * options.snapGrid;
    const gy = Math.round(candidate.y / options.snapGrid) * options.snapGrid;
    targets.push({ value: gx, axis: "x", source: "grid", priority: 3 });
    targets.push({ value: gy, axis: "y", source: "grid", priority: 3 });
  }

  let bestX = candidate.x;
  let bestY = candidate.y;
  const guides: SnapGuide[] = [];
  let bestXPri = 99, bestXDist = magR + 1;
  let bestYPri = 99, bestYDist = magR + 1;
  let bestXTarget: Target | null = null;
  let bestYTarget: Target | null = null;

  for (const t of targets) {
    const dist = t.axis === "x"
      ? Math.abs(candidate.x - t.value)
      : Math.abs(candidate.y - t.value);
    if (dist > magR) continue;

    if (t.axis === "x") {
      const better = t.priority < bestXPri || (t.priority === bestXPri && dist < bestXDist);
      if (better) { bestXPri = t.priority; bestXDist = dist; bestXTarget = t; }
    } else {
      const better = t.priority < bestYPri || (t.priority === bestYPri && dist < bestYDist);
      if (better) { bestYPri = t.priority; bestYDist = dist; bestYTarget = t; }
    }
  }

  if (bestXTarget) {
    const isMagnetic = bestXDist > hardR;
    if (isMagnetic) {
      const falloff = 1 - bestXDist / magR;
      bestX = candidate.x + (bestXTarget.value - candidate.x) * strength * falloff;
    } else {
      bestX = bestXTarget.value;
    }
    guides.push({ axis: "x", value: bestXTarget.value, source: bestXTarget.source, magnetic: isMagnetic });
  }

  if (bestYTarget) {
    const isMagnetic = bestYDist > hardR;
    if (isMagnetic) {
      const falloff = 1 - bestYDist / magR;
      bestY = candidate.y + (bestYTarget.value - candidate.y) * strength * falloff;
    } else {
      bestY = bestYTarget.value;
    }
    guides.push({ axis: "y", value: bestYTarget.value, source: bestYTarget.source, magnetic: isMagnetic });
  }

  return { x: bestX, y: bestY, guides };
}

/** Clamp a box position inside pallet (respecting threshold). */
export function clampToPane(
  x: number,
  y: number,
  boxL: number,
  boxW: number,
  palletL: number,
  palletW: number,
  threshL: number,
  threshW: number,
): { x: number; y: number } {
  return {
    x: Math.max(threshL, Math.min(x, palletL - threshL - boxL)),
    y: Math.max(threshW, Math.min(y, palletW - threshW - boxW)),
  };
}
