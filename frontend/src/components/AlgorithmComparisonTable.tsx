import type { AlgorithmCompareEntry } from "@/lib/types";

interface Props {
  results: AlgorithmCompareEntry[];
}

export default function AlgorithmComparisonTable({ results }: Props) {
  const best = results.reduce(
    (b, r) => (!b || r.pallets_used < b.pallets_used ? r : b),
    results[0]
  );

  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {["Algorithm", "Pallets", "Vol. Util %", "Area Util %", "Weight kg", "Floating", "Unstable", "Warnings"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-gray-600 font-semibold text-xs uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {results.map((r) => (
            <tr key={r.algorithm} className={r.algorithm === best.algorithm ? "bg-blue-50 font-semibold" : "hover:bg-gray-50"}>
              <td className="px-4 py-3 flex items-center gap-2">
                {r.algorithm}
                {r.algorithm === best.algorithm && (
                  <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">Best</span>
                )}
              </td>
              <td className="px-4 py-3">{r.pallets_used}</td>
              <td className="px-4 py-3">{r.average_volume_utilisation_pct.toFixed(1)}</td>
              <td className="px-4 py-3">{r.average_area_utilisation_pct.toFixed(1)}</td>
              <td className="px-4 py-3">{r.total_weight_kg.toFixed(2)}</td>
              <td className="px-4 py-3">{r.floating_boxes}</td>
              <td className="px-4 py-3">{r.unstable_boxes}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{r.warnings.length > 0 ? r.warnings[0] : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
