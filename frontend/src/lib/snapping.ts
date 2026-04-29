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
  | { axis: "x"; value: number; source: "grid" | "threshold" | "box" }
  | { axis: "y"; value: number; source: "grid" | "threshold" | "box" };

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapGuide[];
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
