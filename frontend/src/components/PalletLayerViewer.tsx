"use client";
import type { PalletResult } from "@/lib/types";
import { getSkuColor } from "@/lib/skuColors";

interface Props {
  pallet: PalletResult;
  palletSpec: { length_mm: number; width_mm: number };
  layer: number;
}

export default function PalletLayerViewer({ pallet, palletSpec, layer }: Props) {
  const boxes = pallet.boxes.filter((b) => b.layer === layer);
  const scale = 200 / palletSpec.length_mm;

  return (
    <div className="relative bg-gray-100 rounded border border-gray-300 overflow-hidden"
      style={{
        width: palletSpec.length_mm * scale,
        height: palletSpec.width_mm * scale,
        minWidth: 120,
        minHeight: 100,
      }}
    >
      {boxes.map((b) => (
        <div
          key={b.box_id}
          title={`${b.sku} | ${b.box_id}`}
          style={{
            position: "absolute",
            left: b.x_mm * scale,
            top: b.y_mm * scale,
            width: Math.max(b.length_mm * scale, 2),
            height: Math.max(b.width_mm * scale, 2),
            backgroundColor: getSkuColor(b.sku),
            opacity: 0.85,
            border: "1px solid rgba(0,0,0,0.15)",
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
