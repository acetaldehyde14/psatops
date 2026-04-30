"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { getJob, exportCsvUrl, exportJsonData, patchLayout } from "@/lib/api";
import type {
  PalletiseResponse, PalletResult, BoxResult,
  ManualAdjustmentSettings, LayoutValidationResult,
} from "@/lib/types";
import ResultSummaryCards from "@/components/ResultSummaryCards";
import OrderTable from "@/components/OrderTable";
import EditPanel from "@/components/EditPanel";
import ManualAdjustToolbar from "@/components/ManualAdjustToolbar";
import type { SelectionMode } from "@/components/ManualAdjustToolbar";
import SkuLegend from "@/components/SkuLegend";
import { validateLayout } from "@/lib/layoutValidation";
import {
  compactRow as compactRowLayout,
  compactLayer as compactLayerLayout,
  compactPallet as compactPalletLayout,
} from "@/lib/compactLayout";
import {
  createLockedRow,
  unlockRow as unlockRowFn,
  type LockedRow,
} from "@/lib/rowLocking";
import { getSkuColor } from "@/lib/mockData";
import dynamic from "next/dynamic";
import clsx from "clsx";

const PalletViewer3D = dynamic(() => import("@/components/PalletViewer3D"), { ssr: false });

// ── Helpers ───────────────────────────────────────────────────────────────────
function clonePallets(pallets: PalletResult[]): PalletResult[] {
  return JSON.parse(JSON.stringify(pallets));
}

function rotateBox(box: BoxResult): BoxResult {
  return {
    ...box,
    length_mm: box.width_mm,
    width_mm: box.length_mm,
    rotation: box.rotation === "LWH" ? "WLH" : "LWH",
  };
}

const DEFAULT_SETTINGS: ManualAdjustmentSettings = {
  edge_threshold_length_mm: 0,
  edge_threshold_width_mm: 0,
  snap_grid_mm: 50,
  drag_sensitivity: 0.35,
};

const PALLET_SPEC = { length_mm: 1200, width_mm: 1100, max_height_mm: 1150, max_weight_kg: 1500 };

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const params = useParams();
  const jobId = params?.jobId as string;

  const [result, setResult] = useState<PalletiseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPallet, setSelectedPallet] = useState(0);
  const [layerFilter, setLayerFilter] = useState<number | null>(null);
  const [tab, setTab] = useState<"3d" | "table">("3d");
  const [isManuallyAdjusted, setIsManuallyAdjusted] = useState(false);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editedPallets, setEditedPallets] = useState<PalletResult[]>([]);
  const [originalPallets, setOriginalPallets] = useState<PalletResult[]>([]);
  const [history, setHistory] = useState<PalletResult[][]>([]);
  const [future, setFuture] = useState<PalletResult[][]>([]);
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("single");
  const [settings, setSettings] = useState<ManualAdjustmentSettings>(DEFAULT_SETTINGS);
  const [snapToBoxEdges, setSnapToBoxEdges] = useState(false);
  const [snapToThreshold, setSnapToThreshold] = useState(true);
  const [unlockedMode, setUnlockedMode] = useState(false);
  const [magneticSnapEnabled, setMagneticSnapEnabled] = useState(false);
  const [magneticSnapStrength, setMagneticSnapStrength] = useState(0.65);
  const [lockedRows, setLockedRows] = useState<LockedRow[]>([]);
  const [compactWarnings, setCompactWarnings] = useState<string[]>([]);
  const [validation, setValidation] = useState<LayoutValidationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [legendSku, setLegendSku] = useState<string | undefined>();
  const [legendHoverSku, setLegendHoverSku] = useState<string | undefined>();

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

  // Live validation while in edit mode
  useEffect(() => {
    if (editMode && editedPallets.length > 0) {
      setValidation(validateLayout(editedPallets, PALLET_SPEC, settings));
    }
  }, [editedPallets, editMode, settings]);

  // ── History helpers ───────────────────────────────────────────────────────
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

  // ── Box click / selection ─────────────────────────────────────────────────
  const handleBoxClick = useCallback((box: BoxResult, multi: boolean) => {
    const currentPallet = editedPallets[selectedPallet];
    if (!currentPallet) return;

    if (selectionMode === "sku") {
      const skuIds = new Set(
        currentPallet.boxes.filter((b) => b.sku === box.sku).map((b) => b.box_id),
      );
      setSelectedBoxIds(skuIds);
    } else if (multi) {
      setSelectedBoxIds((prev) => {
        const next = new Set(prev);
        if (next.has(box.box_id)) next.delete(box.box_id);
        else next.add(box.box_id);
        return next;
      });
    } else {
      setSelectedBoxIds(new Set([box.box_id]));
    }
  }, [editedPallets, selectedPallet, selectionMode]);

  // ── Drag end from viewer ──────────────────────────────────────────────────
  const handleBoxDragEnd = useCallback((moves: Array<{ box_id: string; x: number; y: number }>) => {
    mutatePallets((draft) => {
      const p = draft[selectedPallet];
      if (!p) return;
      for (const { box_id, x, y } of moves) {
        const box = p.boxes.find((b) => b.box_id === box_id);
        if (box) { box.x_mm = Math.round(x); box.y_mm = Math.round(y); }
      }
    });
  }, [mutatePallets, selectedPallet]);

  // ── Arrow-step moves from EditPanel (dx/dy/dz are deltas) ────────────────
  const handleMove = useCallback((
    boxIds: string[], palletIdx: number, dx: number, dy: number, dz: number,
  ) => {
    mutatePallets((draft) => {
      const p = draft[palletIdx];
      if (!p) return;
      for (const id of boxIds) {
        const box = p.boxes.find((b) => b.box_id === id);
        if (!box) continue;
        box.x_mm = Math.max(0, box.x_mm + dx);
        box.y_mm = Math.max(0, box.y_mm + dy);
        box.z_mm = Math.max(0, box.z_mm + dz);
        box.layer = Math.floor(box.z_mm / 250) + 1;
      }
    });
  }, [mutatePallets]);

  // ── Rotate 90° ────────────────────────────────────────────────────────────
  const handleRotate = useCallback((boxIds: string[], palletIdx: number) => {
    mutatePallets((draft) => {
      const p = draft[palletIdx];
      if (!p) return;
      for (const id of boxIds) {
        const box = p.boxes.find((b) => b.box_id === id);
        if (box) Object.assign(box, rotateBox(box));
      }
    });
  }, [mutatePallets]);

  // ── Stand Upright ─────────────────────────────────────────────────────────
  const handleStandUpright = useCallback((boxId: string, palletIdx: number) => {
    mutatePallets((draft) => {
      const box = draft[palletIdx]?.boxes.find((b) => b.box_id === boxId);
      if (!box) return;
      const origH = box.original_height_mm ?? box.height_mm;
      box.height_mm = origH;
      const dims = [box.length_mm, box.width_mm].sort((a, b) => a - b);
      box.length_mm = dims[1];
      box.width_mm = dims[0];
      box.rotation = "LWH";
    });
  }, [mutatePallets]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((boxIds: string[], palletIdx: number) => {
    mutatePallets((draft) => {
      const p = draft[palletIdx];
      if (!p) return;
      p.boxes = p.boxes.filter((b) => !boxIds.includes(b.box_id));
      p.box_count = p.boxes.length;
    });
    setSelectedBoxIds(new Set());
  }, [mutatePallets]);

  // ── Move to other pallet ──────────────────────────────────────────────────
  const handleMoveToPallet = useCallback((
    boxIds: string[], fromIdx: number, toIdx: number,
  ) => {
    mutatePallets((draft) => {
      const from = draft[fromIdx];
      const to = draft[toIdx];
      if (!from || !to) return;
      const moving = from.boxes.filter((b) => boxIds.includes(b.box_id));
      from.boxes = from.boxes.filter((b) => !boxIds.includes(b.box_id));
      from.box_count = from.boxes.length;
      for (const box of moving) {
        to.boxes.push({ ...box, x_mm: 0, y_mm: 0, z_mm: 0, layer: 1 });
      }
      to.box_count = to.boxes.length;
    });
    setSelectedPallet(toIdx);
    setSelectedBoxIds(new Set());
  }, [mutatePallets]);

  // ── Undo / Redo / Reset ───────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [clonePallets(editedPallets), ...f.slice(0, 49)]);
    setHistory((h) => h.slice(0, -1));
    setEditedPallets(prev);
    setSelectedBoxIds(new Set());
  }, [history, editedPallets]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((h) => [...h, clonePallets(editedPallets)]);
    setFuture((f) => f.slice(1));
    setEditedPallets(next);
    setSelectedBoxIds(new Set());
  }, [future, editedPallets]);

  const handleReset = useCallback(() => {
    setEditedPallets(clonePallets(originalPallets));
    setHistory([]);
    setFuture([]);
    setSelectedBoxIds(new Set());
    setValidation(null);
  }, [originalPallets]);

  // ── Auto compact ─────────────────────────────────────────────────────────────
  const handleCompactRow = useCallback(() => {
    if (selectedBoxIds.size === 0) return;
    const firstBoxId = Array.from(selectedBoxIds)[0];
    const result = compactRowLayout(editedPallets, firstBoxId, settings, PALLET_SPEC, lockedRows);
    if (result.warnings.length > 0 && result.changedBoxIds.length === 0) {
      setCompactWarnings(result.warnings);
      return;
    }
    const check = validateLayout(result.layout, PALLET_SPEC, settings);
    if (!check.isValid) {
      setCompactWarnings(["Compact Row produced an invalid layout — not applied."]);
      return;
    }
    pushHistory(editedPallets);
    setEditedPallets(result.layout);
    setCompactWarnings(result.warnings);
  }, [selectedBoxIds, editedPallets, settings, lockedRows, pushHistory]);

  const handleCompactLayer = useCallback(() => {
    if (layerFilter === null) {
      setCompactWarnings(["Select a layer first to use Compact Layer."]);
      return;
    }
    const pallet = editedPallets[selectedPallet];
    if (!pallet) return;
    const result = compactLayerLayout(editedPallets, pallet.pallet_no, layerFilter, settings, PALLET_SPEC, lockedRows);
    const check = validateLayout(result.layout, PALLET_SPEC, settings);
    if (!check.isValid) {
      setCompactWarnings(["Compact Layer produced an invalid layout — not applied."]);
      return;
    }
    pushHistory(editedPallets);
    setEditedPallets(result.layout);
    setCompactWarnings(result.warnings);
  }, [layerFilter, editedPallets, selectedPallet, settings, lockedRows, pushHistory]);

  const handleCompactPallet = useCallback(() => {
    const pallet = editedPallets[selectedPallet];
    if (!pallet) return;
    const result = compactPalletLayout(editedPallets, pallet.pallet_no, settings, PALLET_SPEC, lockedRows);
    const check = validateLayout(result.layout, PALLET_SPEC, settings);
    if (!check.isValid) {
      setCompactWarnings(["Compact Pallet produced an invalid layout — not applied."]);
      return;
    }
    pushHistory(editedPallets);
    setEditedPallets(result.layout);
    setCompactWarnings(result.warnings);
  }, [editedPallets, selectedPallet, settings, lockedRows, pushHistory]);

  // ── Row locking ────────────────────────────────────────────────────────────
  const handleLockRow = useCallback(() => {
    if (selectedBoxIds.size === 0) return;
    const firstBoxId = Array.from(selectedBoxIds)[0];
    const newRow = createLockedRow(editedPallets, firstBoxId);
    if (newRow) setLockedRows((prev) => [...prev, newRow]);
  }, [selectedBoxIds, editedPallets]);

  const handleUnlockRow = useCallback((rowId: string) => {
    setLockedRows((prev) => unlockRowFn(rowId, prev));
  }, []);

  // ── Magnetic snap ──────────────────────────────────────────────────────────
  const handleToggleMagneticSnap = useCallback(() => {
    setMagneticSnapEnabled((v) => !v);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
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
            stand_upright_only: b.stand_upright_only,
            no_load_on_top: b.no_load_on_top,
          })),
        })),
        settings,
      });
      setIsManuallyAdjusted(true);
      setSaveMsg(res.validation.is_valid
        ? "Saved successfully ✓"
        : "Saved with errors — review highlighted boxes");
    } catch {
      setSaveMsg("Save failed. Is the backend running?");
    } finally {
      setIsSaving(false);
    }
  }, [result, jobId, editedPallets, settings]);

  // ── Enter / exit edit mode ────────────────────────────────────────────────
  const enterEditMode = () => {
    setEditedPallets(clonePallets(result?.pallets ?? []));
    setOriginalPallets(clonePallets(result?.pallets ?? []));
    setHistory([]);
    setFuture([]);
    setSelectedBoxIds(new Set());
    setValidation(null);
    setSaveMsg(null);
    setEditMode(true);
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedBoxIds(new Set());
    setValidation(null);
    setSaveMsg(null);
  };

  const activePallets = editMode ? editedPallets : result?.pallets ?? [];
  const pallet = activePallets[selectedPallet];
  const maxLayer = pallet ? Math.max(...pallet.boxes.map((b) => b.layer), 1) : 1;
  const invalidIds = new Set<string>(validation?.invalidBoxIds ?? []);
  const selectedBoxIdsArr = Array.from(selectedBoxIds);
  const colorBySku = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const box of pallet?.boxes ?? []) colors[box.sku] = getSkuColor(box.sku);
    return colors;
  }, [pallet?.boxes]);
  const highlightedSku = legendHoverSku ?? legendSku;

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!result) return <div className="p-8 text-gray-500">Loading…</div>;

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
          {!editMode && (
            <button
              onClick={enterEditMode}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              ✏ Manual Adjust
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

      {/* Edit toolbar */}
      {editMode && (
        <ManualAdjustToolbar
          settings={settings}
          selectionMode={selectionMode}
          snapToBoxEdges={snapToBoxEdges}
          snapToThreshold={snapToThreshold}
          unlockedMode={unlockedMode}
          canUndo={history.length > 0}
          canRedo={future.length > 0}
          isSaving={isSaving}
          isOrbitActive={false}
          canCompactRow={selectedBoxIds.size > 0}
          canCompactLayer={layerFilter !== null}
          magneticSnapEnabled={magneticSnapEnabled}
          magneticSnapStrength={magneticSnapStrength}
          onSettingsChange={setSettings}
          onSelectionModeChange={setSelectionMode}
          onSnapToBoxEdgesChange={setSnapToBoxEdges}
          onSnapToThresholdChange={setSnapToThreshold}
          onUnlockedModeChange={setUnlockedMode}
          onCompactRow={handleCompactRow}
          onCompactLayer={handleCompactLayer}
          onCompactPallet={handleCompactPallet}
          onToggleMagneticSnap={handleToggleMagneticSnap}
          onSetMagneticSnapStrength={setMagneticSnapStrength}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleReset}
          onSave={handleSave}
          onExit={exitEditMode}
        />
      )}

      {saveMsg && (
        <div className={clsx("px-6 py-2 text-sm font-medium flex-shrink-0",
          saveMsg.includes("✓") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
          {saveMsg}
        </div>
      )}

      {/* Summary */}
      <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
        <ResultSummaryCards summary={result.summary} />
      </div>

      {result.summary.warnings.length > 0 && (
        <div className="px-6 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-yellow-700 flex-shrink-0">
          {result.summary.warnings.slice(0, 3).map((w, i) => <span key={i} className="mr-4">{w}</span>)}
          {result.summary.warnings.length > 3 && <span>+{result.summary.warnings.length - 3} more</span>}
        </div>
      )}

      {/* Pallet tabs */}
      <div className="flex gap-2 px-6 py-2 flex-shrink-0 flex-wrap border-b border-gray-100">
        {activePallets.map((p, i) => (
          <button key={i}
            onClick={() => { setSelectedPallet(i); setLayerFilter(null); setSelectedBoxIds(new Set()); }}
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
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View tabs */}
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
              {/* Layer filter */}
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
              <div className="flex-1 flex min-h-0">
                <div className="flex-1 relative min-w-0">
                  <PalletViewer3D
                    pallet={pallet}
                    palletSpec={PALLET_SPEC}
                    layerFilter={layerFilter}
                    editMode={editMode}
                    settings={settings}
                    invalidBoxIds={invalidIds}
                    selectedBoxIds={selectedBoxIds}
                    highlightedSku={highlightedSku}
                    colorBySku={colorBySku}
                    snapToBoxEdges={snapToBoxEdges}
                    snapToThreshold={snapToThreshold}
                    unlockedMode={unlockedMode}
                    magneticSnapEnabled={magneticSnapEnabled && !unlockedMode}
                    magneticSnapStrength={magneticSnapStrength}
                    lockedRows={lockedRows}
                    onBoxClick={editMode ? handleBoxClick : undefined}
                    onBoxDragEnd={editMode ? handleBoxDragEnd : undefined}
                  />
                </div>
                <SkuLegend
                  boxes={pallet.boxes}
                  colorBySku={colorBySku}
                  selectedSku={legendSku}
                  onSkuClick={(sku) => setLegendSku((prev) => prev === sku ? undefined : sku)}
                  onSkuHover={setLegendHoverSku}
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

        {/* Edit panel */}
        {editMode && (
          <EditPanel
            selectedBoxIds={selectedBoxIdsArr}
            selectedPalletIdx={selectedPallet}
            pallets={editedPallets}
            palletSpec={PALLET_SPEC}
            settings={settings}
            onSettingsChange={setSettings}
            validation={validation}
            isSaving={isSaving}
            lockedRows={lockedRows}
            onLockRow={handleLockRow}
            onUnlockRow={handleUnlockRow}
            compactWarnings={compactWarnings}
            onClearCompactWarnings={() => setCompactWarnings([])}
            onMove={handleMove}
            onRotate={handleRotate}
            onStandUpright={handleStandUpright}
            onDelete={handleDelete}
            onMoveToPallet={handleMoveToPallet}
            onSave={handleSave}
            onClose={exitEditMode}
          />
        )}
      </div>
    </div>
  );
}
