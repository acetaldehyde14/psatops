import type { BoxResult, ManualAdjustmentSettings } from "./types";
import { validateLayout } from "./layoutValidation";

export type Layout = BoxResult[];

export interface PalletConfig {
  length_mm: number;
  width_mm: number;
  max_height_mm: number;
  max_weight_kg?: number;
}

export type AutoFitResult = {
  fitted: boolean;
  layout: Layout;
  target?: {
    xMm: number;
    yMm: number;
    reason: "gap" | "row-gap" | "edge-gap";
  };
  message?: string;
};

interface Rect {
  x: number;
  y: number;
  l: number;
  w: number;
}

interface Candidate {
  x: number;
  y: number;
  reason: "gap" | "row-gap" | "edge-gap";
  exactGap: boolean;
  rowAligned: boolean;
  leftover: number;
}

function overlap1D(a1: number, a2: number, b1: number, b2: number, tolerance = 0): boolean {
  return a1 < b2 + tolerance && a2 > b1 - tolerance;
}

function centerDistance(a: Rect, b: Rect): number {
  const ax = a.x + a.l / 2;
  const ay = a.y + a.w / 2;
  const bx = b.x + b.l / 2;
  const by = b.y + b.w / 2;
  return Math.hypot(ax - bx, ay - by);
}

function boundsFor(boxes: BoxResult[]): Rect {
  const x = Math.min(...boxes.map((box) => box.x_mm));
  const y = Math.min(...boxes.map((box) => box.y_mm));
  const maxX = Math.max(...boxes.map((box) => box.x_mm + box.length_mm));
  const maxY = Math.max(...boxes.map((box) => box.y_mm + box.width_mm));
  return { x, y, l: maxX - x, w: maxY - y };
}

function applyCandidate(layout: Layout, moving: BoxResult[], candidate: { x: number; y: number }): Layout {
  const bounds = boundsFor(moving);
  const dx = candidate.x - bounds.x;
  const dy = candidate.y - bounds.y;
  const movingIds = new Set(moving.map((box) => box.box_id));
  return layout.map((box) => (
    movingIds.has(box.box_id)
      ? { ...box, x_mm: box.x_mm + dx, y_mm: box.y_mm + dy }
      : box
  ));
}

function isValidLayout(
  layout: Layout,
  pallet: PalletConfig,
  settings: ManualAdjustmentSettings,
): boolean {
  return validateLayout(
    [{
      pallet_no: 1,
      boxes: layout,
      box_count: layout.length,
      weight_kg: layout.reduce((sum, box) => sum + box.weight_kg, 0),
      volume_utilisation_pct: 0,
      area_utilisation_pct: 0,
    }],
    {
      length_mm: pallet.length_mm,
      width_mm: pallet.width_mm,
      max_height_mm: pallet.max_height_mm,
      max_weight_kg: pallet.max_weight_kg ?? Number.POSITIVE_INFINITY,
    },
    settings,
  ).isValid;
}

function makeRows(boxes: BoxResult[], axis: "x" | "y"): BoxResult[][] {
  const sorted = [...boxes].sort((a, b) => axis === "x" ? a.y_mm - b.y_mm : a.x_mm - b.x_mm);
  const rows: BoxResult[][] = [];
  for (const box of sorted) {
    const match = rows.find((row) => {
      const min = Math.min(...row.map((item) => axis === "x" ? item.y_mm : item.x_mm));
      const max = Math.max(...row.map((item) => axis === "x" ? item.y_mm + item.width_mm : item.x_mm + item.length_mm));
      const b1 = axis === "x" ? box.y_mm : box.x_mm;
      const b2 = axis === "x" ? box.y_mm + box.width_mm : box.x_mm + box.length_mm;
      return overlap1D(min, max, b1, b2, 20);
    });
    if (match) match.push(box);
    else rows.push([box]);
  }
  return rows;
}

function pushHorizontalGapCandidates(
  candidates: Candidate[],
  release: Rect,
  moving: Rect,
  boxes: BoxResult[],
  pallet: PalletConfig,
  settings: ManualAdjustmentSettings,
): void {
  const left = settings.edge_threshold_length_mm;
  const right = pallet.length_mm - settings.edge_threshold_length_mm;
  const rows = makeRows(boxes, "x");

  for (const row of rows) {
    const minY = Math.min(...row.map((box) => box.y_mm));
    const maxY = Math.max(...row.map((box) => box.y_mm + box.width_mm));
    if (maxY - minY + 20 < moving.w) continue;
    const y = minY;
    const sorted = [...row].sort((a, b) => a.x_mm - b.x_mm);
    let cursor = left;

    for (const box of [...sorted, null] as Array<BoxResult | null>) {
      const gapStart = cursor;
      const gapEnd = box ? box.x_mm : right;
      const gapWidth = gapEnd - gapStart;
      if (gapWidth >= moving.l) {
        const exactGap = overlap1D(release.x + release.l / 2, release.x + release.l / 2, gapStart, gapEnd);
        candidates.push({
          x: gapStart,
          y,
          reason: box && gapStart !== left ? "row-gap" : "edge-gap",
          exactGap,
          rowAligned: Math.abs(release.y - y) <= 5,
          leftover: gapWidth - moving.l,
        });
      }
      if (box) cursor = Math.max(cursor, box.x_mm + box.length_mm);
    }
  }
}

function pushVerticalGapCandidates(
  candidates: Candidate[],
  release: Rect,
  moving: Rect,
  boxes: BoxResult[],
  pallet: PalletConfig,
  settings: ManualAdjustmentSettings,
): void {
  const top = settings.edge_threshold_width_mm;
  const bottom = pallet.width_mm - settings.edge_threshold_width_mm;
  const columns = makeRows(boxes, "y");

  for (const column of columns) {
    const minX = Math.min(...column.map((box) => box.x_mm));
    const maxX = Math.max(...column.map((box) => box.x_mm + box.length_mm));
    if (maxX - minX + 20 < moving.l) continue;
    const x = minX;
    const sorted = [...column].sort((a, b) => a.y_mm - b.y_mm);
    let cursor = top;

    for (const box of [...sorted, null] as Array<BoxResult | null>) {
      const gapStart = cursor;
      const gapEnd = box ? box.y_mm : bottom;
      const gapHeight = gapEnd - gapStart;
      if (gapHeight >= moving.w) {
        const exactGap = overlap1D(release.y + release.w / 2, release.y + release.w / 2, gapStart, gapEnd);
        candidates.push({
          x,
          y: gapStart,
          reason: box && gapStart !== top ? "row-gap" : "edge-gap",
          exactGap,
          rowAligned: Math.abs(release.x - x) <= 5,
          leftover: gapHeight - moving.w,
        });
      }
      if (box) cursor = Math.max(cursor, box.y_mm + box.width_mm);
    }
  }
}

function pushFaceCandidates(candidates: Candidate[], release: Rect, moving: Rect, boxes: BoxResult[]): void {
  for (const box of boxes) {
    if (overlap1D(release.y, release.y + release.w, box.y_mm, box.y_mm + box.width_mm, 40)) {
      candidates.push({ x: box.x_mm + box.length_mm, y: box.y_mm, reason: "gap", exactGap: false, rowAligned: true, leftover: 0 });
      candidates.push({ x: box.x_mm - moving.l, y: box.y_mm, reason: "gap", exactGap: false, rowAligned: true, leftover: 0 });
    }
    if (overlap1D(release.x, release.x + release.l, box.x_mm, box.x_mm + box.length_mm, 40)) {
      candidates.push({ x: box.x_mm, y: box.y_mm + box.width_mm, reason: "gap", exactGap: false, rowAligned: true, leftover: 0 });
      candidates.push({ x: box.x_mm, y: box.y_mm - moving.w, reason: "gap", exactGap: false, rowAligned: true, leftover: 0 });
    }
  }
}

export function autoFitOnRelease({
  layout,
  movingBoxIds,
  pallet,
  settings,
  lastValidLayout,
}: {
  layout: Layout;
  movingBoxIds: string[];
  pallet: PalletConfig;
  settings: ManualAdjustmentSettings;
  lastValidLayout: Layout;
}): AutoFitResult {
  const moving = layout.filter((box) => movingBoxIds.includes(box.box_id));
  if (moving.length === 0) return { fitted: false, layout: lastValidLayout, message: "No moving boxes" };

  const movingIdSet = new Set(movingBoxIds);
  const releaseBounds = boundsFor(moving);
  const sameLayer = layout.filter((box) => (
    !movingIdSet.has(box.box_id) &&
    Math.abs(box.z_mm - moving[0].z_mm) < 1
  ));
  const candidates: Candidate[] = [];
  const fine = 5;

  candidates.push({
    x: Math.round(releaseBounds.x / fine) * fine,
    y: Math.round(releaseBounds.y / fine) * fine,
    reason: "gap",
    exactGap: false,
    rowAligned: true,
    leftover: 0,
  });
  pushHorizontalGapCandidates(candidates, releaseBounds, releaseBounds, sameLayer, pallet, settings);
  pushVerticalGapCandidates(candidates, releaseBounds, releaseBounds, sameLayer, pallet, settings);
  pushFaceCandidates(candidates, releaseBounds, releaseBounds, sameLayer);

  const searchRadius = settings.autoFitSearchRadiusMm ?? 150;
  let best: { candidate: Candidate; layout: Layout; score: number } | null = null;

  for (const candidate of candidates) {
    const candidateBounds = { ...releaseBounds, x: candidate.x, y: candidate.y };
    const distance = centerDistance(releaseBounds, candidateBounds);
    if (!candidate.exactGap && distance > searchRadius) continue;
    const candidateLayout = applyCandidate(layout, moving, candidate);
    if (!isValidLayout(candidateLayout, pallet, settings)) continue;

    const rowPenalty = candidate.rowAligned ? 0 : 50;
    const edgePenalty = candidate.reason === "edge-gap" ? 5 : 0;
    const score = distance + rowPenalty + candidate.leftover * 0.1 + edgePenalty;
    if (!best || score < best.score) best = { candidate, layout: candidateLayout, score };
  }

  if (!best) {
    return { fitted: false, layout: lastValidLayout, message: "No valid gap found" };
  }

  return {
    fitted: true,
    layout: best.layout,
    target: {
      xMm: best.candidate.x,
      yMm: best.candidate.y,
      reason: best.candidate.reason,
    },
    message: "Auto-fitted into nearby gap",
  };
}
