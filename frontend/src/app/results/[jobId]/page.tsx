"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getJob, exportCsvUrl, exportJsonData, patchLayout } from "@/lib/api";
import type {
  PalletiseResponse, PalletResult, BoxResult,
  AdjustmentValidation,
} from "@/lib/types";
import ResultSummaryCards from "@/components/ResultSummaryCards";
import OrderTable from "@/components/OrderTable";
import EditPanel from "@/components/EditPanel";
import dynamic from "next/dynamic";
import clsx from "clsx";

const PalletViewer3D = dynamic(() => import("@/components/PalletViewer3D"), { ssr: false });

// ── Deep-clone a pallet array ─────────────────────────────────────────────────
function clonePallets(pallets: PalletResult[]): PalletResult[] {
  return JSON.parse(JSON.stringify(pallets));
}

// ── Rotate a box 90° around Z (swap length/width) ────────────────────────────
function rotateBox(box: BoxResult): BoxResult {
  return {
    ...box,
    length_mm: box.width_mm,
    width_mm: box.length_mm,
    rotation: box.rotation === "LWH" ? "WLH" : "LWH",
  };
}

// ── Extract box_ids mentioned in validation errors ────────────────────────────
function invalidBoxIds(validation: AdjustmentValidation | null): Set<string> {
  if (!validation) return new Set();
  const ids = new Set<string>();
  [...validation.errors, ...validation.warnings].forEach((msg) => {
    const m = msg.match(/'([^']+)'/);
    if (m) ids.add(m[1]);
  });
  return ids;
}

// ── Client-side quick validation (boundary + overlap) ─────────────────────────
function quickValidate(
  pallets: PalletResult[],
  spec: { length_mm: number; width_mm: number; max_height_mm: number; max_weight_kg: number },
): AdjustmentValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const pallet of pallets) {
    let weight = 0;
    const boxes = pallet.boxes;

    for (const b of boxes) {
      const { box_id: id, x_mm: x, y_mm: y, z_mm: z, length_mm: l, width_mm: w, height_mm: h } = b;
      if (x < -0.5 || y < -0.5 || z < -0.5) errors.push(`Box '${id}': negative coords.`);
      if (x + l > spec.length_mm + 0.5) errors.push(`Box '${id}': exceeds pallet length.`);
      if (y + w > spec.width_mm + 0.5) errors.push(`Box '${id}': exceeds pallet width.`);
      if (z + h > spec.max_height_mm + 0.5) errors.push(`Box '${id}': exceeds max height.`);
      weight += b.weight_kg;
    }

    if (weight > spec.max_weight_kg + 0.001)
      errors.push(`Pallet ${pallet.pallet_no}: weight ${weight.toFixed(1)} kg exceeds max ${spec.max_weight_kg} kg.`);

    // Overlap (simplified)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b2 = boxes[j];
        const EPS = 0.5;
        if (
          a.x_mm < b2.x_mm + b2.length_mm - EPS && a.x_mm + a.length_mm > b2.x_mm + EPS &&
          a.y_mm < b2.y_mm + b2.width_mm - EPS && a.y_mm + a.width_mm > b2.y_mm + EPS &&
          a.z_mm < b2.z_mm + b2.height_mm - EPS && a.z_mm + a.height_mm > b2.z_mm + EPS
        ) {
          errors.push(`Boxes '${a.box_id}' and '${b2.box_id}' overlap.`);
        }
      }
    }

    // Floating
    for (const b of boxes) {
      if (b.z_mm < 0.5) continue;
      const hasSupport = boxes.some((s) => {
        if (s.box_id === b.box_id) return false;
        return (
          Math.abs((s.z_mm + s.height_mm) - b.z_mm) < 1 &&
          s.x_mm < b.x_mm + b.length_mm - 0.5 && s.x_mm + s.length_mm > b.x_mm + 0.5 &&
          s.y_mm < b.y_mm + b.width_mm - 0.5 && s.y_mm + s.width_mm > b.y_mm + 0.5
        );
      });
      if (!hasSupport) warnings.push(`Box '${b.box_id}' is floating.`);
    }
  }

  return { is_valid: errors.length === 0, errors, warnings };
}

export default function ResultsPage() {
  const params = useParams();
  const jobId = params?.jobId as string;

  const [result, setResult] = useState<PalletiseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPallet, setSelectedPallet] = useState(0);
  const [layerFilter, setLayerFilter] = useState<number | null>(null);
  const [tab, setTab] = useState<"3d" | "table">("3d");

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editedPallets, setEditedPallets] = useState<PalletResult[]>([]);
  const [originalPallets, setOriginalPallets] = useState<PalletResult[]>([]);
  const [history, setHistory] = useState<PalletResult[][]>([]);
  const [future, setFuture] = useState<PalletResult[][]>([]);
  const [selectedBox, setSelectedBox] = useState<BoxResult | null>(null);
  const [snapGrid, setSnapGrid] = useState(10);
  const [validation, setValidation] = useState<AdjustmentValidation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [isManuallyAdjusted, setIsManuallyAdjusted] = useState(false);

  const palletSpec = { length_mm: 1200, width_mm: 1100, max_height_mm: 1150, max_weight_kg: 1500 };

  useEffect(() => {
    if (!jobId) return;
    getJob(jobId)
      .then((r) => {
        setResult(r);
        setEditedPallets(clonePallets(r.pallets));
        setOriginalPallets(clonePallets(r.pallets));
        setIsManuallyAdjusted(!!(r as any).manually_adjusted);
      })
      .catch(() => setError("Could not load job " + jobId));
  }, [jobId]);

  // Re-run quick validation whenever editedPallets changes in edit mode
  useEffect(() => {
    if (editMode && editedPallets.length > 0) {
      setValidation(quickValidate(editedPallets, palletSpec));
    }
  }, [editedPallets, editMode]);

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const pushHistory = useCallback((current: PalletResult[]) => {
    setHistory((h) => [...h.slice(-49), clonePallets(current)]);
    setFuture([]);
  }, []);

  const mutatePallets = useCallback((fn: (draft: PalletResult[]) => void) => {
    setEditedPallets((prev) => {
      pushHistory(prev);
      const next = clonePallets(prev);
      fn(next);
      return next;
    });
  }, [pushHistory]);

  // ── Edit operations ───────────────────────────────────────────────────────
  const handleBoxMove = useCallback((boxId: string, palletIdx: number, x: number, y: number, z: number) => {
    mutatePallets((draft) => {
      const box = draft[palletIdx]?.boxes.find((b) => b.box_id === boxId);
      if (!box) return;
      box.x_mm = Math.max(0, Math.round(x / snapGrid) * snapGrid);
      box.y_mm = Math.max(0, Math.round(y / snapGrid) * snapGrid);
      box.z_mm = Math.max(0, Math.round(z / snapGrid) * snapGrid);
      box.layer = Math.floor(box.z_mm / 250) + 1;
    });
    // Keep selected box in sync
    setSelectedBox((prev) => prev?.box_id === boxId
      ? { ...prev, x_mm: x, y_mm: y, z_mm: z }
      : prev);
  }, [mutatePallets, snapGrid]);

  const handleBoxMoveFromViewer = useCallback((boxId: string, x: number, y: number, z: number) => {
    handleBoxMove(boxId, selectedPallet, x, y, z);
  }, [handleBoxMove, selectedPallet]);

  const handleRotate = useCallback((boxId: string, palletIdx: number) => {
    mutatePallets((draft) => {
      const box = draft[palletIdx]?.boxes.find((b) => b.box_id === boxId);
      if (!box) return;
      const rotated = rotateBox(box);
      Object.assign(box, rotated);
    });
    setSelectedBox((prev) => prev?.box_id === boxId ? rotateBox(prev) : prev);
  }, [mutatePallets]);

  const handleDelete = useCallback((boxId: string, palletIdx: number) => {
    mutatePallets((draft) => {
      draft[palletIdx].boxes = draft[palletIdx].boxes.filter((b) => b.box_id !== boxId);
      draft[palletIdx].box_count = draft[palletIdx].boxes.length;
    });
    setSelectedBox((prev) => prev?.box_id === boxId ? null : prev);
  }, [mutatePallets]);

  const handleMoveToPallet = useCallback((boxId: string, fromIdx: number, toIdx: number) => {
    mutatePallets((draft) => {
      const box = draft[fromIdx]?.boxes.find((b) => b.box_id === boxId);
      if (!box) return;
      draft[fromIdx].boxes = draft[fromIdx].boxes.filter((b) => b.box_id !== boxId);
      draft[fromIdx].box_count = draft[fromIdx].boxes.length;
      draft[toIdx].boxes.push({ ...box, x_mm: 0, y_mm: 0, z_mm: 0, layer: 1 });
      draft[toIdx].box_count = draft[toIdx].boxes.length;
    });
    setSelectedPallet(toIdx);
    setSelectedBox(null);
  }, [mutatePallets]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [clonePallets(editedPallets), ...f.slice(0, 49)]);
    setHistory((h) => h.slice(0, -1));
    setEditedPallets(prev);
    setSelectedBox(null);
  }, [history, editedPallets]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, clonePallets(editedPallets)]);
    setFuture((f) => f.slice(1));
    setEditedPallets(next);
    setSelectedBox(null);
  }, [future, editedPallets]);

  const handleReset = useCallback(() => {
    setEditedPallets(clonePallets(originalPallets));
    setHistory([]);
    setFuture([]);
    setSelectedBox(null);
    setValidation(null);
  }, [originalPallets]);

  const handleSave = useCallback(async () => {
    if (!result) return;
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await patchLayout(jobId, {
        pallets: editedPallets.map((p) => ({
          pallet_no: p.pallet_no,
          boxes: p.boxes.map((b) => ({
            box_id: b.box_id,
            x_mm: b.x_mm,
            y_mm: b.y_mm,
            z_mm: b.z_mm,
            length_mm: b.length_mm,
            width_mm: b.width_mm,
            height_mm: b.height_mm,
            rotation: b.rotation,
            layer: b.layer,
          })),
        })),
      });
      setValidation(res.validation);
      setIsManuallyAdjusted(true);
      setSaveMsg(res.validation.is_valid ? "Saved successfully ✓" : "Saved with errors — see panel");
    } catch {
      setSaveMsg("Save failed. Is the backend running?");
    } finally {
      setIsSaving(false);
    }
  }, [result, jobId, editedPallets]);

  const enterEditMode = () => {
    setEditedPallets(clonePallets(result?.pallets ?? []));
    setOriginalPallets(clonePallets(result?.pallets ?? []));
    setHistory([]);
    setFuture([]);
    setSelectedBox(null);
    setValidation(null);
    setEditMode(true);
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedBox(null);
    setValidation(null);
    setSaveMsg(null);
  };

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!result) return <div className="p-8 text-gray-500">Loading…</div>;

  const activePallets = editMode ? editedPallets : result.pallets;
  const pallet = activePallets[selectedPallet];
  const maxLayer = pallet ? Math.max(...pallet.boxes.map((b) => b.layer), 1) : 1;
  const badIds = invalidBoxIds(validation);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Results — {result.order_id}</h1>
          <p className="text-gray-400 text-xs">
            <code className="font-mono bg-gray-100 px-1 rounded">{result.job_id}</code>
            {" · "}{result.algorithm_used}
            {isManuallyAdjusted && (
              <span className="ml-2 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-medium">
                Manually Adjusted
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editMode ? (
            <button
              onClick={enterEditMode}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              ✏ Manual Adjust
            </button>
          ) : (
            <button onClick={exitEditMode}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium px-4 py-2 rounded-lg text-sm">
              Exit Edit Mode
            </button>
          )}
          <a href={exportCsvUrl(result.job_id)}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-50">
            CSV
          </a>
          <button onClick={() => exportJsonData(result)}
            className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-50">
            JSON
          </button>
          <button disabled className="bg-gray-100 text-gray-400 px-3 py-2 rounded text-sm cursor-not-allowed">
            PDF
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={clsx("px-6 py-2 text-sm font-medium",
          saveMsg.includes("✓") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
          {saveMsg}
        </div>
      )}

      {/* Summary cards */}
      <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
        <ResultSummaryCards summary={result.summary} />
      </div>

      {result.summary.warnings.length > 0 && (
        <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-yellow-700 flex-shrink-0">
          {result.summary.warnings.slice(0, 3).map((w, i) => <span key={i} className="mr-4">{w}</span>)}
          {result.summary.warnings.length > 3 && <span>+{result.summary.warnings.length - 3} more</span>}
        </div>
      )}

      {/* Pallet selector */}
      <div className="flex gap-2 px-6 py-2 flex-shrink-0 flex-wrap border-b border-gray-100">
        {activePallets.map((p, i) => (
          <button key={i} onClick={() => { setSelectedPallet(i); setLayerFilter(null); }}
            className={clsx("px-3 py-1.5 rounded text-sm font-medium border transition-colors",
              selectedPallet === i
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:border-blue-400")}>
            Pallet {p.pallet_no} ({p.box_count})
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: viewer + table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-2 border-b border-gray-200 flex-shrink-0">
            {(["3d", "table"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={clsx("px-4 py-1.5 text-sm font-medium border-b-2 transition-colors",
                  tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>
                {t === "3d" ? "3D View" : "Box Table"}
              </button>
            ))}
          </div>

          {tab === "3d" && pallet && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-50 border-b border-gray-100 flex-wrap flex-shrink-0">
                <span className="text-xs text-gray-500">Layer:</span>
                <button onClick={() => setLayerFilter(null)}
                  className={clsx("px-2 py-0.5 rounded text-xs", layerFilter === null ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600")}>
                  All
                </button>
                {Array.from({ length: maxLayer }, (_, i) => i + 1).map((l) => (
                  <button key={l} onClick={() => setLayerFilter(l)}
                    className={clsx("px-2 py-0.5 rounded text-xs", layerFilter === l ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600")}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex-1 relative">
                <PalletViewer3D
                  pallet={pallet}
                  palletSpec={palletSpec}
                  layerFilter={layerFilter}
                  editMode={editMode}
                  invalidBoxIds={badIds}
                  selectedBoxId={selectedBox?.box_id ?? null}
                  snapGrid={snapGrid}
                  onBoxSelect={(box) => setSelectedBox(box)}
                  onBoxMove={handleBoxMoveFromViewer}
                />
              </div>
            </div>
          )}

          {tab === "table" && (
            <div className="flex-1 overflow-auto p-4">
              <OrderTable pallets={activePallets} />
            </div>
          )}
        </div>

        {/* Right: edit panel */}
        {editMode && (
          <EditPanel
            selectedBox={selectedBox}
            selectedPalletIdx={selectedPallet}
            pallets={editedPallets}
            palletSpec={palletSpec}
            snapGrid={snapGrid}
            validation={validation}
            canUndo={history.length > 0}
            canRedo={future.length > 0}
            isSaving={isSaving}
            onMove={handleBoxMove}
            onRotate={handleRotate}
            onDelete={handleDelete}
            onMoveToPallet={handleMoveToPallet}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSave={handleSave}
            onReset={handleReset}
            onSnapChange={setSnapGrid}
            onClose={exitEditMode}
          />
        )}
      </div>
    </div>
  );
}
