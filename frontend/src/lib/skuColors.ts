export const SKU_COLORS: Record<string, string> = {};

const PALETTE = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
];

export function getSkuColor(sku: string): string {
  if (!SKU_COLORS[sku]) {
    const idx = Object.keys(SKU_COLORS).length % PALETTE.length;
    SKU_COLORS[sku] = PALETTE[idx];
  }
  return SKU_COLORS[sku];
}
