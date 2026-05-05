"use client";
import { memo, useMemo } from "react";
import clsx from "clsx";
import type { BoxResult } from "@/lib/types";

interface Props {
  boxes: BoxResult[];
  colorBySku: Record<string, string>;
  scope: "current" | "all";
  selectedSku?: string;
  onScopeChange?: (scope: "current" | "all") => void;
  onSkuClick?: (sku: string) => void;
  onSkuHover?: (sku: string | undefined) => void;
}

const SkuLegend = memo(function SkuLegend({
  boxes,
  colorBySku,
  scope,
  selectedSku,
  onScopeChange,
  onSkuClick,
  onSkuHover,
}: Props) {
  const rows = useMemo(() => {
    const bySku = new Map<string, { sku: string; count: number; weightKg: number; centers: Set<string>; stores: Set<string> }>();
    for (const box of boxes) {
      const existing = bySku.get(box.sku) ?? { sku: box.sku, count: 0, weightKg: 0, centers: new Set<string>(), stores: new Set<string>() };
      existing.count += 1;
      existing.weightKg += box.weight_kg;
      if (box.center_label) existing.centers.add(box.center_label);
      if (box.store_no) existing.stores.add(box.store_no);
      bySku.set(box.sku, existing);
    }
    return Array.from(bySku.values()).sort((a, b) => a.sku.localeCompare(b.sku));
  }, [boxes]);

  return (
    <aside className="w-56 border-l border-gray-200 bg-white flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-800">SKU Legend</h2>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {(["current", "all"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onScopeChange?.(mode)}
              className={clsx(
                "px-2 py-1 rounded text-[11px] font-medium border",
                scope === mode
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400",
              )}
            >
              {mode === "current" ? "Current Pallet" : "All Pallets"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {rows.map((row) => {
          const selected = row.sku === selectedSku;
          return (
            <button
              key={row.sku}
              type="button"
              onClick={() => onSkuClick?.(row.sku)}
              onMouseEnter={() => onSkuHover?.(row.sku)}
              onMouseLeave={() => onSkuHover?.(undefined)}
              className={clsx(
                "w-full px-3 py-2 text-left border-l-2 transition-colors",
                selected ? "bg-blue-50 border-blue-500" : "border-transparent hover:bg-amber-50",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-3 w-3 rounded-sm border border-black/10 flex-shrink-0"
                  style={{ backgroundColor: colorBySku[row.sku] ?? "#94a3b8" }}
                />
                <span className="text-xs font-medium text-gray-800 truncate">{row.sku}</span>
              </div>
              <div className="mt-0.5 pl-5 text-[11px] text-gray-500">
                {row.count} boxes · {row.weightKg.toFixed(2)} kg
                {row.stores.size > 0 && ` · ${Array.from(row.stores).join(", ")}`}
                {row.centers.size > 0 && ` · ${row.centers.size} center${row.centers.size === 1 ? "" : "s"}`}
              </div>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-400">No boxes</div>
        )}
      </div>
    </aside>
  );
});

export default SkuLegend;
