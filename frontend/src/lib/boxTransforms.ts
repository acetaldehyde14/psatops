import type { BoxResult, RotationAxis } from "./types";

export function rotateBox90(box: BoxResult, axis: RotationAxis): BoxResult {
  if (axis === "x") {
    return {
      ...box,
      width_mm: box.height_mm,
      height_mm: box.width_mm,
      rotation: "X90",
    };
  }
  if (axis === "y") {
    return {
      ...box,
      length_mm: box.height_mm,
      height_mm: box.length_mm,
      rotation: "Y90",
    };
  }
  return {
    ...box,
    length_mm: box.width_mm,
    width_mm: box.length_mm,
    rotation: "Z90",
  };
}

export function layFlatLargestBase(box: BoxResult): BoxResult {
  const rotations = box.stand_upright_only
    ? [
        { length_mm: box.length_mm, width_mm: box.width_mm, height_mm: box.height_mm, rotation: "LWH" },
        { length_mm: box.width_mm, width_mm: box.length_mm, height_mm: box.height_mm, rotation: "WLH" },
      ]
    : [
        { length_mm: box.length_mm, width_mm: box.width_mm, height_mm: box.height_mm, rotation: "LWH" },
        { length_mm: box.length_mm, width_mm: box.height_mm, height_mm: box.width_mm, rotation: "LHW" },
        { length_mm: box.width_mm, width_mm: box.length_mm, height_mm: box.height_mm, rotation: "WLH" },
        { length_mm: box.width_mm, width_mm: box.height_mm, height_mm: box.length_mm, rotation: "WHL" },
        { length_mm: box.height_mm, width_mm: box.length_mm, height_mm: box.width_mm, rotation: "HLW" },
        { length_mm: box.height_mm, width_mm: box.width_mm, height_mm: box.length_mm, rotation: "HWL" },
      ];
  const best = rotations
    .sort((a, b) => (b.length_mm * b.width_mm) - (a.length_mm * a.width_mm) || a.height_mm - b.height_mm)[0];
  return best ? { ...box, ...best } : box;
}

export function standUpright(box: BoxResult): BoxResult {
  const origH = box.original_height_mm ?? box.height_mm;
  const dims = [box.length_mm, box.width_mm].sort((a, b) => a - b);
  return {
    ...box,
    height_mm: origH,
    length_mm: dims[1],
    width_mm: dims[0],
    rotation: "LWH",
  };
}
