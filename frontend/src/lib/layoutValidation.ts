/**
 * Client-side layout validation — mirrors backend checks for instant feedback.
 * All dimensions in mm.
 */
import type { BoxResult, PalletResult, ManualAdjustmentSettings, LayoutValidationResult } from "./types";

const SUPPORT_THRESHOLD = 0.70;
const EPS = 0.5;

function xyOverlapArea(
  ax: number, ay: number, al: number, aw: number,
  bx: number, by: number, bl: number, bw: number,
): number {
  const ox = Math.min(ax + al, bx + bl) - Math.max(ax, bx);
  const oy = Math.min(ay + aw, by + bw) - Math.max(ay, by);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

function boxesOverlap(a: BoxResult, b: BoxResult, eps = EPS): boolean {
  return (
    a.x_mm < b.x_mm + b.length_mm - eps && a.x_mm + a.length_mm > b.x_mm + eps &&
    a.y_mm < b.y_mm + b.width_mm - eps && a.y_mm + a.width_mm > b.y_mm + eps &&
    a.z_mm < b.z_mm + b.height_mm - eps && a.z_mm + a.height_mm > b.z_mm + eps
  );
}

export function validateBoxesLightweight(
  movingBoxes: BoxResult[],
  otherBoxes: BoxResult[],
  palletSpec: { length_mm: number; width_mm: number; max_height_mm: number },
  settings: ManualAdjustmentSettings,
  options: { overlapToleranceMm?: number } = {},
): LayoutValidationResult {
  const errors: string[] = [];
  const invalidBoxIds: string[] = [];
  const tl = settings.edge_threshold_length_mm;
  const tw = settings.edge_threshold_width_mm;

  for (const box of movingBoxes) {
    let invalid = false;
    if (box.x_mm < tl - EPS || box.x_mm + box.length_mm > palletSpec.length_mm - tl + EPS) {
      errors.push(`Box '${box.box_id}' is outside the usable pallet length.`);
      invalid = true;
    }
    if (box.y_mm < tw - EPS || box.y_mm + box.width_mm > palletSpec.width_mm - tw + EPS) {
      errors.push(`Box '${box.box_id}' is outside the usable pallet width.`);
      invalid = true;
    }
    if (box.z_mm < -EPS || box.z_mm + box.height_mm > palletSpec.max_height_mm + EPS) {
      errors.push(`Box '${box.box_id}' is outside the pallet height.`);
      invalid = true;
    }

    const nearby = otherBoxes.filter((other) => (
      Math.abs(other.z_mm - box.z_mm) < Math.max(other.height_mm, box.height_mm) + EPS &&
      other.x_mm < box.x_mm + box.length_mm + 100 &&
      other.x_mm + other.length_mm > box.x_mm - 100 &&
      other.y_mm < box.y_mm + box.width_mm + 100 &&
      other.y_mm + other.width_mm > box.y_mm - 100
    ));

    for (const other of nearby) {
      if (boxesOverlap(box, other, options.overlapToleranceMm ?? EPS)) {
        errors.push(`Box '${box.box_id}' overlaps '${other.box_id}'.`);
        invalid = true;
        if (!invalidBoxIds.includes(other.box_id)) invalidBoxIds.push(other.box_id);
      }
    }

    if (invalid && !invalidBoxIds.includes(box.box_id)) invalidBoxIds.push(box.box_id);
  }

  return {
    isValid: errors.length === 0,
    invalidBoxIds,
    errors,
    warnings: [],
  };
}

function supportFraction(box: BoxResult, others: BoxResult[]): number {
  const base = box.length_mm * box.width_mm;
  if (base === 0) return 1;
  let supported = 0;
  for (const o of others) {
    if (o.box_id === box.box_id) continue;
    if (Math.abs((o.z_mm + o.height_mm) - box.z_mm) < 1) {
      supported += xyOverlapArea(
        box.x_mm, box.y_mm, box.length_mm, box.width_mm,
        o.x_mm, o.y_mm, o.length_mm, o.width_mm,
      );
    }
  }
  return Math.min(supported / base, 1);
}

export function validateLayout(
  pallets: PalletResult[],
  palletSpec: { length_mm: number; width_mm: number; max_height_mm: number; max_weight_kg: number },
  settings: ManualAdjustmentSettings,
): LayoutValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const invalidBoxIds: string[] = [];

  const tl = settings.edge_threshold_length_mm;
  const tw = settings.edge_threshold_width_mm;

  for (const pallet of pallets) {
    const boxes = pallet.boxes;
    let palletWeight = 0;

    for (const b of boxes) {
      const id = b.box_id;
      let boxInvalid = false;

      // Boundary + threshold
      if (b.x_mm < tl - EPS) {
        errors.push(`Box '${id}': x=${b.x_mm} violates length threshold (${tl}mm).`);
        boxInvalid = true;
      }
      if (b.y_mm < tw - EPS) {
        errors.push(`Box '${id}': y=${b.y_mm} violates width threshold (${tw}mm).`);
        boxInvalid = true;
      }
      if (b.x_mm + b.length_mm > palletSpec.length_mm - tl + EPS) {
        errors.push(`Box '${id}': right edge exceeds pallet (threshold ${tl}mm).`);
        boxInvalid = true;
      }
      if (b.y_mm + b.width_mm > palletSpec.width_mm - tw + EPS) {
        errors.push(`Box '${id}': front edge exceeds pallet (threshold ${tw}mm).`);
        boxInvalid = true;
      }
      if (b.z_mm + b.height_mm > palletSpec.max_height_mm + EPS) {
        errors.push(`Box '${id}': exceeds max height.`);
        boxInvalid = true;
      }

      if (boxInvalid) invalidBoxIds.push(id);
      palletWeight += b.weight_kg;
    }

    // Weight
    if (palletWeight > palletSpec.max_weight_kg + 0.001) {
      errors.push(`Pallet ${pallet.pallet_no}: weight ${palletWeight.toFixed(1)} kg > max.`);
    }

    // Overlaps
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (boxesOverlap(boxes[i], boxes[j])) {
          errors.push(`Boxes '${boxes[i].box_id}' and '${boxes[j].box_id}' overlap.`);
          if (!invalidBoxIds.includes(boxes[i].box_id)) invalidBoxIds.push(boxes[i].box_id);
          if (!invalidBoxIds.includes(boxes[j].box_id)) invalidBoxIds.push(boxes[j].box_id);
        }
      }
    }

    // Floating / support
    for (const b of boxes) {
      if (b.z_mm < EPS) continue;
      const frac = supportFraction(b, boxes);
      if (frac === 0) {
        errors.push(`Box '${b.box_id}' is floating.`);
        if (!invalidBoxIds.includes(b.box_id)) invalidBoxIds.push(b.box_id);
      } else if (frac < SUPPORT_THRESHOLD) {
        warnings.push(`Box '${b.box_id}' has only ${(frac * 100).toFixed(0)}% support.`);
      }
    }

    // No load on top
    for (const b of boxes) {
      if (!b.no_load_on_top) continue;
      const topZ = b.z_mm + b.height_mm;
      for (const other of boxes) {
        if (other.box_id === b.box_id) continue;
        if (Math.abs(other.z_mm - topZ) < 1) {
          const overlap = xyOverlapArea(
            b.x_mm, b.y_mm, b.length_mm, b.width_mm,
            other.x_mm, other.y_mm, other.length_mm, other.width_mm,
          );
          if (overlap > 1) {
            errors.push(`Box '${other.box_id}' is on top of '${b.box_id}' (no_load_on_top).`);
            if (!invalidBoxIds.includes(other.box_id)) invalidBoxIds.push(other.box_id);
            if (!invalidBoxIds.includes(b.box_id)) invalidBoxIds.push(b.box_id);
          }
        }
      }
    }

    // Stand upright only
    for (const b of boxes) {
      if (!b.stand_upright_only) continue;
      const origH = b.original_height_mm ?? b.height_mm;
      if (Math.abs(b.height_mm - origH) > EPS) {
        errors.push(`Box '${b.box_id}' has stand_upright_only but height changed.`);
        if (!invalidBoxIds.includes(b.box_id)) invalidBoxIds.push(b.box_id);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    invalidBoxIds: Array.from(new Set(invalidBoxIds)),
    errors,
    warnings,
  };
}
