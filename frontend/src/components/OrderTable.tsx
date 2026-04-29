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
                    {["#", "Box ID", "SKU", "Lot", "x mm", "y mm", "z mm", "L mm", "W mm", "H mm", "kg", "Rot", "Layer", "Seq", "Location"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {p.boxes.map((b) => (
                    <tr key={b.box_id} className="hover:bg-blue-50">
                      <td className="px-3 py-1.5">{b.pick_sequence}</td>
                      <td className="px-3 py-1.5 font-mono">{b.box_id}</td>
                      <td className="px-3 py-1.5 font-medium">{b.sku}</td>
                      <td className="px-3 py-1.5">{b.lot_no ?? "—"}</td>
                      <td className="px-3 py-1.5">{b.x_mm}</td>
                      <td className="px-3 py-1.5">{b.y_mm}</td>
                      <td className="px-3 py-1.5">{b.z_mm}</td>
                      <td className="px-3 py-1.5">{b.length_mm}</td>
                      <td className="px-3 py-1.5">{b.width_mm}</td>
                      <td className="px-3 py-1.5">{b.height_mm}</td>
                      <td className="px-3 py-1.5">{b.weight_kg}</td>
                      <td className="px-3 py-1.5">{b.rotation}</td>
                      <td className="px-3 py-1.5">{b.layer}</td>
                      <td className="px-3 py-1.5">{b.pick_sequence}</td>
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
