"use client";
import type { BoxResult, PalletResult } from "@/lib/types";
import { useState } from "react";

interface Props {
  pallets: PalletResult[];
}

export default function OrderTable({ pallets }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      {pallets.map((p) => (
        <div key={p.pallet_no} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold bg-gray-50 hover:bg-gray-100"
            onClick={() => setExpanded(expanded === p.pallet_no ? null : p.pallet_no)}
          >
            <span>Pallet {p.pallet_no} — {p.box_count} boxes — {p.weight_kg.toFixed(1)} kg</span>
            <span className="text-gray-400 text-xs">
              Vol: {p.volume_utilisation_pct.toFixed(1)}% | Area: {p.area_utilisation_pct.toFixed(1)}%
              {expanded === p.pallet_no ? " ▲" : " ▼"}
            </span>
          </button>
          {expanded === p.pallet_no && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["box_id", "sku", "nia_item_code", "description", "store", "dc", "center", "partial", "original_qty", "carton", "pallet_no", "x/y/z", "dimensions", "weight", "lot", "line_id", "source_row", "rotation", "layer", "location"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {p.boxes.map((b) => (
                    <tr key={b.box_id} className="hover:bg-blue-50">
                      <td className="px-3 py-1.5 font-mono">{b.box_id}</td>
                      <td className="px-3 py-1.5 font-medium">{b.sku}</td>
                      <td className="px-3 py-1.5">{b.nia_item_code ?? "—"}</td>
                      <td className="px-3 py-1.5 max-w-64 truncate" title={b.description_of_goods ?? ""}>{b.description_of_goods ?? "—"}</td>
                      <td className="px-3 py-1.5">{b.store_no ?? "—"}</td>
                      <td className="px-3 py-1.5">{b.dc_no ?? "—"}</td>
                      <td className="px-3 py-1.5 max-w-56 truncate" title={b.center_label ?? ""}>{b.center_label ?? "—"}</td>
                      <td className="px-3 py-1.5">{b.partial_carton ? "yes" : "—"}</td>
                      <td className="px-3 py-1.5">{b.original_quantity ?? "—"}</td>
                      <td className="px-3 py-1.5">{b.carton_index ?? "—"}</td>
                      <td className="px-3 py-1.5">{p.pallet_no}</td>
                      <td className="px-3 py-1.5">{b.x_mm} / {b.y_mm} / {b.z_mm}</td>
                      <td className="px-3 py-1.5">{b.length_mm} x {b.width_mm} x {b.height_mm}</td>
                      <td className="px-3 py-1.5">{b.weight_kg}</td>
                      <td className="px-3 py-1.5">{b.lot_no ?? "—"}</td>
                      <td className="px-3 py-1.5">{b.line_id ?? "—"}</td>
                      <td className="px-3 py-1.5">{b.source_row ?? "—"}</td>
                      <td className="px-3 py-1.5">{b.rotation}</td>
                      <td className="px-3 py-1.5">{b.layer}</td>
                      <td className="px-3 py-1.5">{b.location ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
