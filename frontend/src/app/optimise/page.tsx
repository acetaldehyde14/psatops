"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ConstraintForm from "@/components/ConstraintForm";
import { palletise } from "@/lib/api";
import type { PalletSpec, Constraints, AlgorithmType, ItemRequest } from "@/lib/types";
import { defaultPalletiseRequest } from "@/lib/mockData";
import { DEFAULT_CONSTRAINTS, DEFAULT_PALLET } from "@/lib/defaults";

export default function OptimisePage() {
  const router = useRouter();
  const [pallet, setPallet] = useState<PalletSpec>(DEFAULT_PALLET);
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [algorithm, setAlgorithm] = useState<AlgorithmType>("EXTREME_POINT");
  const [orderId, setOrderId] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [fromUpload, setFromUpload] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("uploaded_items");
    if (saved) {
      try {
        const items = JSON.parse(saved);
        setItemsText(JSON.stringify(items, null, 2));
        setFromUpload(true);
        localStorage.removeItem("uploaded_items");
      } catch {
        // ignore corrupt data
      }
    }
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!itemsText.trim()) {
        throw new Error("No order data loaded");
      }
      const items: ItemRequest[] = JSON.parse(itemsText);
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("No order data loaded");
      }
      const request = {
        order_id: orderId,
        algorithm,
        pallet,
        constraints: {
          ...constraints,
          prefer_larger_base: constraints.prefer_larger_base,
          do_not_allow_stability_issues: constraints.do_not_allow_stability_issues,
        },
        items,
      };
      if (process.env.NODE_ENV === "development") {
        console.log("Palletise request", request);
      }
      const result = await palletise(request);
      router.push(`/results/${result.job_id}`);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemoData = () => {
    setPallet(defaultPalletiseRequest.pallet);
    setConstraints(defaultPalletiseRequest.constraints);
    setItemsText(JSON.stringify(defaultPalletiseRequest.items, null, 2));
    setFromUpload(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Optimise</h1>
      <p className="text-gray-500 text-sm mb-6">Configure your pallet and algorithm, then run the optimiser.</p>

      {!itemsText.trim() && (
        <div className="mb-5 flex items-center justify-between gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
          <span>No order data loaded. Upload a file first or paste item JSON below.</span>
          <button
            type="button"
            onClick={handleLoadDemoData}
            className="shrink-0 bg-white hover:bg-yellow-100 border border-yellow-300 text-yellow-800 font-medium px-3 py-1.5 rounded text-xs"
          >
            Load Demo Data
          </button>
        </div>
      )}

      {fromUpload && (
        <div className="mb-5 flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <span className="font-medium">Items loaded from upload.</span>
          <span className="text-green-500">Review below and click Run Optimisation.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Order ID</label>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <ConstraintForm
            pallet={pallet}
            constraints={constraints}
            algorithm={algorithm}
            onPalletChange={setPallet}
            onConstraintsChange={setConstraints}
            onAlgorithmChange={setAlgorithm}
          />
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
          <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Items (JSON array)</label>
          <textarea
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            rows={18}
            className="font-mono text-xs border border-gray-300 rounded p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
            spellCheck={false}
          />
          <p className="text-xs text-gray-400">
            Paste items JSON directly, or use the <strong>Upload</strong> page and click &ldquo;Go to Optimise&rdquo; to auto-fill.
          </p>
          {itemsText.trim() && (
            <button
              type="button"
              onClick={handleLoadDemoData}
              className="self-start text-xs text-blue-600 hover:underline"
            >
              Load Demo Data
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
      )}

      <div className="mt-6">
        <button
          onClick={handleRun}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-lg text-sm transition-colors"
        >
          {loading ? "Running..." : "Run Optimisation"}
        </button>
      </div>
    </div>
  );
}
