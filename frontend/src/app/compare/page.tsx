"use client";
import { useState } from "react";
import { compare } from "@/lib/api";
import type { AlgorithmType, CompareResponse, PalletSpec, Constraints, ItemRequest } from "@/lib/types";
import AlgorithmComparisonTable from "@/components/AlgorithmComparisonTable";
import ConstraintForm from "@/components/ConstraintForm";
import { defaultPalletiseRequest } from "@/lib/mockData";
import Link from "next/link";

const ALL_ALGOS: AlgorithmType[] = ["FIRST_FIT", "BEST_FIT", "EXTREME_POINT", "GENETIC"];

export default function ComparePage() {
  const [pallet, setPallet] = useState<PalletSpec>(defaultPalletiseRequest.pallet);
  const [constraints, setConstraints] = useState<Constraints>(defaultPalletiseRequest.constraints);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>("EXTREME_POINT");
  const [itemsText, setItemsText] = useState(JSON.stringify(defaultPalletiseRequest.items, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const items: ItemRequest[] = JSON.parse(itemsText);
      const data = await compare({
        order_id: "CMP-001",
        algorithms: ALL_ALGOS,
        pallet,
        constraints,
        items,
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Algorithm Comparison</h1>
      <p className="text-gray-500 text-sm mb-6">Run all algorithms against the same order and compare results.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <ConstraintForm
            pallet={pallet}
            constraints={constraints}
            algorithm={algorithm}
            onPalletChange={setPallet}
            onConstraintsChange={setConstraints}
            onAlgorithmChange={setAlgorithm}
          />
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col gap-3">
          <label className="text-xs font-medium text-gray-600 uppercase">Items (JSON)</label>
          <textarea
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            rows={14}
            className="font-mono text-xs border border-gray-300 rounded p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
          />
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>}

      <button
        onClick={handleRun}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-lg text-sm mb-8 transition-colors"
      >
        {loading ? "Running all algorithms..." : "Compare All Algorithms"}
      </button>

      {result && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-3">Results — {result.order_id}</h2>
          <AlgorithmComparisonTable results={result.results} />
          <div className="mt-4 flex gap-2 flex-wrap">
            {result.results.map((r) => (
              <Link
                key={r.job_id}
                href={`/results/${r.job_id}`}
                className="text-xs text-blue-600 hover:underline bg-blue-50 px-3 py-1 rounded"
              >
                View {r.algorithm} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
