/**
 * Row locking utilities for manual pallet adjustment.
 * Locked rows are UI-only editing constraints — not persisted to the backend.
 * All dimensions in mm.
 */
import type { BoxResult, PalletResult } from "./types";

export interface LockedRow {
  id: string;
  palletNo: number;
  layer: number;
  zMm: number;
  yMm: number;
  boxIds: string[];
}

/** Detect boxes in the same row as the reference box (same z, overlapping/near Y range). */
function detectRowBoxes(
  boxes: BoxResult[],
  ref: BoxResult,
  toleranceMm = 20,
): BoxResult[] {
  return boxes.filter((b) => {
    if (Math.abs(b.z_mm - ref.z_mm) > toleranceMm) return false;
    const aY1 = ref.y_mm;
    const aY2 = ref.y_mm + ref.width_mm;
    const bY1 = b.y_mm;
    const bY2 = b.y_mm + b.width_mm;
    return aY1 < bY2 + toleranceMm && aY2 > bY1 - toleranceMm;
  });
}

/**
 * Create a locked row from the selected box.
 * Returns null if the box is not found in any pallet.
 */
export function createLockedRow(
  layout: PalletResult[],
  selectedBoxId: string,
  toleranceMm = 20,
): LockedRow | null {
  for (const pallet of layout) {
    const selectedBox = pallet.boxes.find((b) => b.box_id === selectedBoxId);
    if (!selectedBox) continue;

    const rowBoxes = detectRowBoxes(pallet.boxes, selectedBox, toleranceMm);
    return {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      palletNo: pallet.pallet_no,
      layer: selectedBox.layer,
      zMm: selectedBox.z_mm,
      yMm: selectedBox.y_mm,
      boxIds: rowBoxes.map((b) => b.box_id),
    };
  }
  return null;
}

/** Return true if the given box is inside any locked row. */
export function isBoxInLockedRow(boxId: string, lockedRows: LockedRow[]): boolean {
  return lockedRows.some((lr) => lr.boxIds.includes(boxId));
}

/** Return the locked row containing the box, or null. */
export function getLockedRowForBox(
  boxId: string,
  lockedRows: LockedRow[],
): LockedRow | null {
  return lockedRows.find((lr) => lr.boxIds.includes(boxId)) ?? null;
}

/** Remove a locked row by its ID. */
export function unlockRow(rowId: string, lockedRows: LockedRow[]): LockedRow[] {
  return lockedRows.filter((lr) => lr.id !== rowId);
}

/**
 * Get the effective set of box IDs that should move together.
 * If the primary box is in a locked row, expands selection to the whole row so the
 * row moves as a unit. Returns `isLockedRowMove = true` in that case.
 */
export function getMovableSelection(
  primaryBoxId: string,
  selectedBoxIds: string[],
  lockedRows: LockedRow[],
): { boxIds: string[]; isLockedRowMove: boolean } {
  const lockedRow = getLockedRowForBox(primaryBoxId, lockedRows);
  if (!lockedRow) {
    return { boxIds: selectedBoxIds, isLockedRowMove: false };
  }
  const allIds = Array.from(new Set([...selectedBoxIds, ...lockedRow.boxIds]));
  return { boxIds: allIds, isLockedRowMove: true };
}
