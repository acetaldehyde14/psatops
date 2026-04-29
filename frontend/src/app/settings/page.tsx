"use client";
import { useState } from "react";
import type { PalletSpec } from "@/lib/types";

const PRESETS: { name: string; spec: PalletSpec }[] = [
  { name: "Euro Pallet (1200×1000)", spec: { length_mm: 1200, width_mm: 1000, max_height_mm: 1150, max_weight_kg: 1500 } },
  { name: "Half Pallet (600×1000)", spec: { length_mm: 600, width_mm: 1000, max_height_mm: 1150, max_weight_kg: 750 } },
  { name: "AU Pallet (1165×1165)", spec: { length_mm: 1165, width_mm: 1165, max_height_mm: 1150, max_weight_kg: 2000 } },
  { name: "US Pallet (1219×1016)", spec: { length_mm: 1219, width_mm: 1016, max_height_mm: 1200, max_weight_kg: 1800 } },
];

export default function SettingsPage() {
  const [active, setActive] = useState(0);
  const spec = PRESETS[active].spec;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-gray-500 text-sm mb-6">Pallet presets and algorithm defaults. These are for reference — settings on the Optimise page override these.</p>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Pallet Presets</h2>
        <div className="flex gap-2 flex-wrap mb-5">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${
                active === i ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {Object.entries(spec).map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 font-medium uppercase">{k.replace(/_/g, " ")}</div>
              <div className="text-lg font-bold text-gray-900">{v}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Algorithm Notes</h2>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="p-3 bg-gray-50 rounded">
            <strong>FIRST_FIT</strong> — First Fit Decreasing. Fast baseline. Sorts by volume, places each box in the first pallet that fits.
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <strong>BEST_FIT</strong> — Like FFD but picks the pallet with the least residual space. Slightly better utilisation.
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <strong>EXTREME_POINT</strong> — 3D Extreme Point packing. Best single-pass algorithm for 3D placement. Recommended default.
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <strong>GENETIC</strong> — Genetic algorithm scaffold. Evolves box order over 5 generations. Slower but can find better solutions for complex orders.
          </div>
          <div className="p-3 bg-gray-50 rounded">
            <strong>AUTO</strong> — Runs EXTREME_POINT and GENETIC, returns the better result by score.
          </div>
        </div>
      </section>
    </div>
  );
}
