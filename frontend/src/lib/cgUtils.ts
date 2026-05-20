import type { BoxResult } from "./types";

export interface CgPoint {
  x: number;
  y: number;
  z: number;
}

export function computeCgFromBoxes(boxes: BoxResult[]): CgPoint | null {
  if (boxes.length === 0) return null;
  let totalW = boxes.reduce((s, b) => s + b.weight_kg, 0);
  const useGeom = totalW === 0;
  if (useGeom) totalW = boxes.length;
  const w = (b: BoxResult) => (useGeom ? 1 : b.weight_kg);
  return {
    x: boxes.reduce((s, b) => s + (b.x_mm + b.length_mm / 2) * w(b), 0) / totalW,
    y: boxes.reduce((s, b) => s + (b.y_mm + b.width_mm / 2) * w(b), 0) / totalW,
    z: boxes.reduce((s, b) => s + (b.z_mm + b.height_mm / 2) * w(b), 0) / totalW,
  };
}

export interface LevelResult {
  /** Bottom of the interface layer in mm (z of the top surface of supporting boxes) */
  heightMm: number;
  /** Number of boxes above this interface */
  aboveCount: number;
  /** CG x of boxes above (mm from pallet origin) */
  cgX: number;
  /** CG y of boxes above (mm from pallet origin) */
  cgY: number;
  /** Minimum margin to any footprint edge (mm, negative = outside) */
  marginMm: number;
  pass: boolean;
}

/**
 * For each unique z-interface (top surface of each layer of boxes),
 * compute the CG of all boxes whose bottom is at or above that interface,
 * and check whether it falls within the pallet footprint.
 */
export function computeLevelStability(
  boxes: BoxResult[],
  palletLengthMm: number,
  palletWidthMm: number,
): LevelResult[] {
  if (boxes.length === 0) return [];

  // Collect unique top-surface z values (these are the interfaces)
  const interfaces = Array.from(
    new Set(boxes.map((b) => b.z_mm + b.height_mm)),
  ).sort((a, b) => a - b);

  const results: LevelResult[] = [];

  for (const iface of interfaces) {
    const above = boxes.filter((b) => b.z_mm >= iface);
    if (above.length === 0) continue;

    const cg = computeCgFromBoxes(above);
    if (!cg) continue;

    // Margin to pallet edges (positive = inside, negative = outside)
    const marginX = Math.min(cg.x, palletLengthMm - cg.x);
    const marginY = Math.min(cg.y, palletWidthMm - cg.y);
    const marginMm = Math.min(marginX, marginY);

    results.push({
      heightMm: iface,
      aboveCount: above.length,
      cgX: cg.x,
      cgY: cg.y,
      marginMm,
      pass: marginMm >= 0,
    });
  }

  return results;
}
