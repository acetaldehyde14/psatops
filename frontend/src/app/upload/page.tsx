"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadDropzone from "@/components/UploadDropzone";
import type { UploadResponse } from "@/lib/types";
import { ArrowRight } from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  function handleGoToOptimise() {
    if (!result) return;
    localStorage.setItem("uploaded_items", JSON.stringify(result.items));
    router.push("/optimise");
  }

  function handleParseJson() {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        throw new Error("JSON must be an array of item rows.");
      }
      const rows = parsed.filter((row) => row && typeof row === "object" && !Array.isArray(row));
      if (rows.length === 0) {
        throw new Error("No item rows found.");
      }
      setResult({
        filename: "pasted-json-array",
        rows_parsed: rows.length,
        items: rows,
        warnings: rows.length !== parsed.length ? [`Skipped ${parsed.length - rows.length} non-object row(s).`] : [],
      });
    } catch (error: any) {
      setJsonError(error?.message ?? "Invalid JSON.");
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Upload Order</h1>
      <p className="text-gray-500 text-sm mb-6">
        Import CSV, Excel, or raw JSON array rows. Required fields: sku or nia_item_code, quantity, length_mm, width_mm, height_mm.
      </p>

      <UploadDropzone onUploaded={setResult} />

      <div className="mt-5 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Paste JSON Array</label>
        <textarea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          rows={7}
          className="mt-2 w-full font-mono text-xs border border-gray-300 rounded p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-y"
          placeholder='[{"sku":"...","quantity":2.5,"length_mm":21.67,"width_mm":430,"height_mm":250}]'
          spellCheck={false}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleParseJson}
            className="bg-gray-900 hover:bg-gray-800 text-white font-semibold px-4 py-2 rounded-lg text-sm"
          >
            Preview JSON
          </button>
          {jsonError && <span className="text-sm text-red-600">{jsonError}</span>}
        </div>
      </div>

      {result && (
        <div className="mt-6">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded text-sm font-medium">
              {result.rows_parsed} rows parsed from {result.filename}
            </div>
            {result.warnings.length > 0 && (
              <div className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded text-sm">
                {result.warnings.length} warning(s)
              </div>
            )}
            <button
              onClick={handleGoToOptimise}
              className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg text-sm transition-colors"
            >
              Go to Optimise
              <ArrowRight size={16} />
            </button>
          </div>

          {result.warnings.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 space-y-1">
              {result.warnings.map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}

          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {Object.keys(result.items[0] ?? {}).map((k) => (
                    <th key={k} className="px-3 py-2 text-left text-gray-500 font-medium">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.items.slice(0, 100).map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-3 py-1.5 whitespace-nowrap">{String(v ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
