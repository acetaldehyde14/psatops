/**
 * Auto compact layout tools for manual pallet adjustment.
 * Repacks boxes flush along X without running a full re-optimisation.
 * All dimensions in mm.
 */
import type { BoxResult, PalletResult, ManualAdjustmentSettings } from "./types";
import type { LockedRow } from "./rowLocking";

export interface CompactResult {
  layout: PalletResult[];
  changedBoxIds: string[];
  warnings: string[];
}

// ── Row detection / grouping ──────────────────────────────────────────────────

/**
 * Detect all boxes in the same row as the selected box.
 * Same row = same pallet, same z (within tolerance), overlapping or near Y range.
 */
export function detectRow(
  boxes: BoxResult[],
  selectedBox: BoxResult,
  toleranceMm = 20,
): BoxResult[] {
  return boxes.filter((b) => {
    if (Math.abs(b.z_mm - selectedBox.z_mm) > toleranceMm) return false;
    const aY1 = selectedBox.y_mm;
    const aY2 = selectedBox.y_mm + selectedBox.width_mm;
    const bY1 = b.y_mm;
    const bY2 = b.y_mm + b.width_mm;
    return aY1 < bY2 + toleranceMm && aY2 > bY1 - toleranceMm;
  });
}

/**
 * Group a set of boxes into rows by similar Y position.
 * Returns rows sorted by ascending Y.
 */
export function groupRows(
  boxes: BoxResult[],
  toleranceMm = 20,
): BoxResult[][] {
  const sorted = [...boxes].sort((a, b) => a.y_mm - b.y_mm);
  const rows: BoxResult[][] = [];

  for (const box of sorted) {
    let placed = false;
    for (const row of rows) {
      const refY2 = row[0].y_mm + row[0].width_mm;
      const bY1 = box.y_mm;
      const bY2 = box.y_mm + box.width_mm;
      if (bY1 < refY2 + toleranceMm && bY2 > row[0].y_mm - toleranceMm) {
        row.push(box);
        placed = true;
        break;
      }
    }
    if (!placed) rows.push([box]);
  }

  return rows;
}

// ── Core repack ───────────────────────────────────────────────────────────────

function repackRowAlongX(
  rowBoxes: BoxResult[],
  startX: number,
  palletLength: number,
  threshL: number,
): { packed: BoxResult[]; warning?: string } {
  const sorted = [...rowBoxes].sort((a, b) => a.x_mm - b.x_mm);
  let cursor = startX;
  const packed: BoxResult[] = [];

  for (const box of sorted) {
    if (cursor + box.length_mm > palletLength - threshL + 0.5) {
      return {
        packed,
        warning: `Box '${box.box_id}' would exceed pallet length — compacting stopped.`,
      };
    }
    packed.push({ ...box, x_mm: cursor });
    cursor += box.length_mm;
  }

  return { packed };
}

function hasLockedBox(boxes: BoxResult[], lockedRows: LockedRow[]): boolean {
  return boxes.some((b) => lockedRows.some((lr) => lr.boxIds.includes(b.box_id)));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compact the row containing the selected box flush along X.
 * Preserves z_mm, y_mm, rotation, and SKU.
 * Skips (and warns) if the row contains locked boxes.
 */
export function compactRow(
  layout: PalletResult[],
  selectedBoxId: string,
  settings: ManualAdjustmentSettings,
  palletSpec: { length_mm: number; width_mm: number },
  lockedRows: LockedRow[] = [],
): CompactResult {
  const warnings: string[] = [];
  const changedBoxIds: string[] = [];
  const newLayout: PalletResult[] = JSON.parse(JSON.stringify(layout));

  for (const pallet of newLayout) {
    const selectedBox = pallet.boxes.find((b) => b.box_id === selectedBoxId);
    if (!selectedBox) continue;

    const rowBoxes = detectRow(pallet.boxes, selectedBox);

    if (hasLockedBox(rowBoxes, lockedRows)) {
      warnings.push("Row contains locked boxes — unlock the row first.");
      break;
    }

    const startX = settings.edge_threshold_length_mm;
    const { packed, warning } = repackRowAlongX(
      rowBoxes,
      startX,
      palletSpec.length_mm,
      settings.edge_threshold_length_mm,
    );
    if (warning) warnings.push(warning);

    for (const packedBox of packed) {
      const orig = pallet.boxes.find((b) => b.box_id === packedBox.box_id);
      if (orig && Math.round(orig.x_mm) !== Math.round(packedBox.x_mm)) {
        orig.x_mm = Math.round(packedBox.x_mm);
        changedBoxIds.push(orig.box_id);
      }
    }
    break;
  }

  return { layout: newLayout, changedBoxIds, warnings };
}

/**
 * Compact all rows on a given layer, repacking X and re-stacking rows along Y.
 * Locked rows are skipped (warning emitted).
 */
export function compactLayer(
  layout: PalletResult[],
  palletNo: number,
  layer: number,
  settings: ManualAdjustmentSettings,
  palletSpec: { length_mm: number; width_mm: number },
  lockedRows: LockedRow[] = [],
): CompactResult {
  const warnings: string[] = [];
  const changedBoxIds: string[] = [];
  const newLayout: PalletResult[] = JSON.parse(JSON.stringify(layout));

  const pallet = newLayout.find((p) => p.pallet_no === palletNo);
  if (!pallet) {
    return { layout: newLayout, changedBoxIds, warnings: ["Pallet not found."] };
  }

  const layerBoxes = pallet.boxes.filter((b) => b.layer === layer);
  const rows = groupRows(layerBoxes);

  let rowYCursor = settings.edge_threshold_width_mm;

  for (const row of rows) {
    const rowMaxWidth = Math.max(...row.map((b) => b.width_mm));

    if (hasLockedBox(row, lockedRows)) {
      warnings.push(`Layer ${layer}: row at y≈${Math.round(row[0].y_mm)}mm is locked — skipped.`);
      rowYCursor += rowMaxWidth;
      continue;
    }

    const { packed, warning } = repackRowAlongX(
      row,
      settings.edge_threshold_length_mm,
      palletSpec.length_mm,
      settings.edge_threshold_length_mm,
    );
    if (warning) warnings.push(`Layer ${layer}: ${warning}`);

    for (const packedBox of packed) {
      const orig = pallet.boxes.find((b) => b.box_id === packedBox.box_id);
      if (!orig) continue;
      let changed = false;
      if (Math.round(orig.x_mm) !== Math.round(packedBox.x_mm)) {
        orig.x_mm = Math.round(packedBox.x_mm);
        changed = true;
      }
      if (Math.round(orig.y_mm) !== Math.round(rowYCursor)) {
        orig.y_mm = Math.round(rowYCursor);
        changed = true;
      }
      if (changed && !changedBoxIds.includes(orig.box_id)) {
        changedBoxIds.push(orig.box_id);
      }
    }

    rowYCursor += rowMaxWidth;
  }

  return { layout: newLayout, changedBoxIds, warnings };
}

/**
 * Compact every layer on the pallet independently.
 * Locked rows are skipped in each layer (warnings emitted).
 * Does NOT run a full re-optimisation — this is a manual cleanup tool.
 */
export function compactPallet(
  layout: PalletResult[],
  palletNo: number,
  settings: ManualAdjustmentSettings,
  palletSpec: { length_mm: number; width_mm: number },
  lockedRows: LockedRow[] = [],
): CompactResult {
  const pallet = layout.find((p) => p.pallet_no === palletNo);
  if (!pallet) {
    return { layout, changedBoxIds: [], warnings: ["Pallet not found."] };
  }

  const layers = Array.from(new Set(pallet.boxes.map((b) => b.layer))).sort((a, b) => a - b);
  let currentLayout = layout;
  const allChangedIds: string[] = [];
  const allWarnings: string[] = [];

  for (const layer of layers) {
    const result = compactLayer(currentLayout, palletNo, layer, settings, palletSpec, lockedRows);
    currentLayout = result.layout;
    allChangedIds.push(...result.changedBoxIds);
    allWarnings.push(...result.warnings);
  }

  if (lockedRows.length > 0) {
    const lockedCount = lockedRows.filter((lr) => lr.palletNo === palletNo).length;
    if (lockedCount > 0) {
      allWarnings.unshift(`${lockedCount} locked row(s) were skipped. Unlock to include them.`);
    }
  }

  return { layout: currentLayout, changedBoxIds: allChangedIds, warnings: allWarnings };
}
