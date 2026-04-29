"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getJob, exportCsvUrl, exportJsonData } from "@/lib/api";
import type { PalletiseResponse } from "@/lib/types";
import ResultSummaryCards from "@/components/ResultSummaryCards";
import OrderTable from "@/components/OrderTable";
import dynamic from "next/dynamic";

// PalletViewer3D uses Three.js — must be client-only
const PalletViewer3D = dynamic(() => import("@/components/PalletViewer3D"), { ssr: false });

export default function ResultsPage() {
  const params = useParams();
  const jobId = params?.jobId as string;

  const [result, setResult] = useState<PalletiseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPallet, setSelectedPallet] = useState(0);
  const [layerFilter, setLayerFilter] = useState<number | null>(null);
  const [tab, setTab] = useState<"3d" | "table">("3d");

  useEffect(() => {
    if (!jobId) return;
    getJob(jobId)
      .then(setResult)
      .catch(() => setError("Could not load job " + jobId));
  }, [jobId]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!result) return <div className="p-8 text-gray-500">Loading...</div>;

  const pallet = result.pallets[selectedPallet];
  const maxLayer = pallet ? Math.max(...pallet.boxes.map((b) => b.layer), 1) : 1;

  const palletSpec = {
    length_mm: pallet?.boxes.length
      ? Math.max(...pallet.boxes.map((b) => b.x_mm + b.length_mm))
      : 1200,
    width_mm: pallet?.boxes.length
      ? Math.max(...pallet.boxes.map((b) => b.y_mm + b.width_mm))
      : 1000,
    max_height_mm: 1150,
  };

  // Use a reasonable pallet spec from result
  const palletSpecFull = { length_mm: 1200, width_mm: 1000, max_height_mm: 1150 };

  return (
    <div className="p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Results — {result.order_id}</h1>
          <p className="text-gray-500 text-sm">
            Job: <code className="font-mono bg-gray-100 px-1 rounded">{result.job_id}</code> |
            Algorithm: <strong>{result.algorithm_used}</strong>
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={exportCsvUrl(result.job_id)}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50"
          >
            Export CSV
          </a>
          <button
            onClick={() => exportJsonData(result)}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-50"
          >
            Export JSON
          </button>
          <button className="bg-gray-200 text-gray-400 px-4 py-2 rounded text-sm font-medium cursor-not-allowed" disabled>
            Export PDF
          </button>
        </div>
      </div>

      <ResultSummaryCards summary={result.summary} />

      {result.summary.warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 space-y-1">
          {result.summary.warnings.slice(0, 5).map((w, i) => <p key={i}>{w}</p>)}
          {result.summary.warnings.length > 5 && <p>+{result.summary.warnings.length - 5} more warnings</p>}
        </div>
      )}

      {/* Pallet selector */}
      <div className="flex gap-2 flex-wrap">
        {result.pallets.map((p, i) => (
          <button
            key={i}
            onClick={() => { setSelectedPallet(i); setLayerFilter(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              selectedPallet === i
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
            }`}
          >
            Pallet {p.pallet_no} ({p.box_count} boxes)
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(["3d", "table"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "3d" ? "3D View" : "Box Table"}
          </button>
        ))}
      </div>

      {tab === "3d" && pallet && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{ height: 520 }}>
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Layer filter:</span>
            <button
              onClick={() => setLayerFilter(null)}
              className={`px-2 py-0.5 rounded text-xs ${layerFilter === null ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}
            >
              All
            </button>
            {Array.from({ length: maxLayer }, (_, i) => i + 1).map((l) => (
              <button
                key={l}
                onClick={() => setLayerFilter(l)}
                className={`px-2 py-0.5 rounded text-xs ${layerFilter === l ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"}`}
              >
                Layer {l}
              </button>
            ))}
          </div>
          <div className="relative" style={{ height: 468 }}>
            <PalletViewer3D
              pallet={pallet}
              palletSpec={palletSpecFull}
              layerFilter={layerFilter}
            />
          </div>
        </div>
      )}

      {tab === "table" && <OrderTable pallets={result.pallets} />}
    </div>
  );
}
