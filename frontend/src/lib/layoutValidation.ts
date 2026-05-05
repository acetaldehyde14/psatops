/**
 * Client-side layout validation — mirrors backend checks for instant feedback.
 * All dimensions in mm.
 */
import type { BoxResult, PalletResult, ManualAdjustmentSettings, LayoutValidationResult, StabilityIssue } from "./types";

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
  const issues: StabilityIssue[] = [];
  const invalidBoxIds: string[] = [];
  const tl = settings.edge_threshold_length_mm;
  const tw = settings.edge_threshold_width_mm;

  for (const box of movingBoxes) {
    let invalid = false;
    if (box.x_mm < tl - EPS || box.x_mm + box.length_mm > palletSpec.length_mm - tl + EPS) {
      const message = `Box '${box.box_id}' is outside the usable pallet length.`;
      errors.push(message);
      issues.push({ type: "boundary", severity: "error", box_id: box.box_id, message });
      invalid = true;
    }
    if (box.y_mm < tw - EPS || box.y_mm + box.width_mm > palletSpec.width_mm - tw + EPS) {
      const message = `Box '${box.box_id}' is outside the usable pallet width.`;
      errors.push(message);
      issues.push({ type: "boundary", severity: "error", box_id: box.box_id, message });
      invalid = true;
    }
    if (box.z_mm < -EPS || box.z_mm + box.height_mm > palletSpec.max_height_mm + EPS) {
      const message = `Box '${box.box_id}' is outside the pallet height.`;
      errors.push(message);
      issues.push({ type: "height", severity: "error", box_id: box.box_id, message });
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
        const message = `Box '${box.box_id}' overlaps '${other.box_id}'.`;
        errors.push(message);
        issues.push({ type: "overlap", severity: "error", box_id: box.box_id, message });
        issues.push({ type: "overlap", severity: "error", box_id: other.box_id, message });
        invalid = true;
        if (!invalidBoxIds.includes(other.box_id)) invalidBoxIds.push(other.box_id);
      }
    }

    if (invalid && !invalidBoxIds.includes(box.box_id)) invalidBoxIds.push(box.box_id);
  }

  return {
    isValid: errors.length === 0,
    invalidBoxIds,
    issues,
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
  options: {
    mode?: "strict" | "soft";
    allowOutOfBounds?: boolean;
    allowOverlap?: boolean;
    allowFloating?: boolean;
  } = {},
): LayoutValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: StabilityIssue[] = [];
  const invalidBoxIds: string[] = [];
  const softMode = options.mode === "soft";
  const addProblem = (message: string, boxId: string | undefined, issue: StabilityIssue, block: boolean) => {
    issues.push(issue);
    if (block && !softMode) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
    if (boxId && !invalidBoxIds.includes(boxId)) invalidBoxIds.push(boxId);
  };

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
        const message = `Box '${id}': x=${b.x_mm} violates length threshold (${tl}mm).`;
        addProblem(message, id, { type: "boundary", severity: softMode ? "warning" : "error", box_id: id, pallet_no: pallet.pallet_no, sku: b.sku, message }, !options.allowOutOfBounds);
        boxInvalid = true;
      }
      if (b.y_mm < tw - EPS) {
        const message = `Box '${id}': y=${b.y_mm} violates width threshold (${tw}mm).`;
        addProblem(message, id, { type: "boundary", severity: softMode ? "warning" : "error", box_id: id, pallet_no: pallet.pallet_no, sku: b.sku, message }, !options.allowOutOfBounds);
        boxInvalid = true;
      }
      if (b.x_mm + b.length_mm > palletSpec.length_mm - tl + EPS) {
        const message = `Box '${id}': right edge exceeds pallet (threshold ${tl}mm).`;
        addProblem(message, id, { type: "boundary", severity: softMode ? "warning" : "error", box_id: id, pallet_no: pallet.pallet_no, sku: b.sku, message }, !options.allowOutOfBounds);
        boxInvalid = true;
      }
      if (b.y_mm + b.width_mm > palletSpec.width_mm - tw + EPS) {
        const message = `Box '${id}': front edge exceeds pallet (threshold ${tw}mm).`;
        addProblem(message, id, { type: "boundary", severity: softMode ? "warning" : "error", box_id: id, pallet_no: pallet.pallet_no, sku: b.sku, message }, !options.allowOutOfBounds);
        boxInvalid = true;
      }
      if (b.z_mm + b.height_mm > palletSpec.max_height_mm + EPS) {
        const message = `Box '${id}': exceeds max height.`;
        addProblem(message, id, { type: "height", severity: softMode ? "warning" : "error", box_id: id, pallet_no: pallet.pallet_no, sku: b.sku, message }, !options.allowOutOfBounds);
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
          const message = `Boxes '${boxes[i].box_id}' and '${boxes[j].box_id}' overlap.`;
          addProblem(message, boxes[i].box_id, { type: "overlap", severity: softMode ? "warning" : "error", box_id: boxes[i].box_id, pallet_no: pallet.pallet_no, sku: boxes[i].sku, message }, !options.allowOverlap);
          addProblem(message, boxes[j].box_id, { type: "overlap", severity: softMode ? "warning" : "error", box_id: boxes[j].box_id, pallet_no: pallet.pallet_no, sku: boxes[j].sku, message }, !options.allowOverlap);
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
        const message = `Box '${b.box_id}' is floating or has insufficient support`;
        if (settings.do_not_allow_stability_issues && !options.allowFloating) {
          addProblem(message, b.box_id, { type: "floating", severity: softMode ? "warning" : "error", box_id: b.box_id, pallet_no: pallet.pallet_no, sku: b.sku, message }, true);
        } else {
          warnings.push(message);
          issues.push({ type: "floating", severity: "warning", box_id: b.box_id, pallet_no: pallet.pallet_no, sku: b.sku, message });
          if (!invalidBoxIds.includes(b.box_id)) invalidBoxIds.push(b.box_id);
        }
      } else if (frac < SUPPORT_THRESHOLD) {
        const message = `Box '${b.box_id}' has only ${(frac * 100).toFixed(0)}% support.`;
        if (settings.do_not_allow_stability_issues && !options.allowFloating) {
          addProblem(message, b.box_id, { type: "unstable", severity: softMode ? "warning" : "error", box_id: b.box_id, pallet_no: pallet.pallet_no, sku: b.sku, message }, true);
        } else {
          warnings.push(message);
          issues.push({ type: "unstable", severity: "warning", box_id: b.box_id, pallet_no: pallet.pallet_no, sku: b.sku, message });
          if (!invalidBoxIds.includes(b.box_id)) invalidBoxIds.push(b.box_id);
        }
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
            const message = `Box '${other.box_id}' is on top of '${b.box_id}' (no_load_on_top).`;
            if (settings.do_not_allow_stability_issues) {
              errors.push(message);
              issues.push({ type: "no_load_on_top", severity: "error", box_id: other.box_id, pallet_no: pallet.pallet_no, sku: other.sku, message });
              issues.push({ type: "no_load_on_top", severity: "error", box_id: b.box_id, pallet_no: pallet.pallet_no, sku: b.sku, message });
              if (!invalidBoxIds.includes(other.box_id)) invalidBoxIds.push(other.box_id);
              if (!invalidBoxIds.includes(b.box_id)) invalidBoxIds.push(b.box_id);
            } else {
              warnings.push(message);
              issues.push({ type: "no_load_on_top", severity: "warning", box_id: other.box_id, pallet_no: pallet.pallet_no, sku: other.sku, message });
              issues.push({ type: "no_load_on_top", severity: "warning", box_id: b.box_id, pallet_no: pallet.pallet_no, sku: b.sku, message });
            }
          }
        }
      }
    }

    // Stand upright only
    for (const b of boxes) {
      if (!b.stand_upright_only) continue;
      const origH = b.original_height_mm ?? b.height_mm;
      if (Math.abs(b.height_mm - origH) > EPS) {
        const message = `Box '${b.box_id}' has stand_upright_only but height changed.`;
        errors.push(message);
        issues.push({ type: "stand_upright_only", severity: "error", box_id: b.box_id, pallet_no: pallet.pallet_no, sku: b.sku, message });
        if (!invalidBoxIds.includes(b.box_id)) invalidBoxIds.push(b.box_id);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    mode: options.mode ?? "strict",
    invalidBoxIds: Array.from(new Set(invalidBoxIds)),
    issues: issues.map((issue, index) => ({ ...issue, id: issue.id ?? `${issue.type}-${issue.box_id ?? "layout"}-${index}` })),
    errors,
    warnings,
  };
}
