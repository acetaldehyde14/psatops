"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { getJob, exportCsvUrl, exportJsonData, patchLayout } from "@/lib/api";
import type {
  PalletiseResponse, PalletResult, BoxResult,
  ManualAdjustmentSettings, LayoutValidationResult, StabilityIssue, WarningItem,
} from "@/lib/types";
import ResultSummaryCards from "@/components/ResultSummaryCards";
import OrderTable from "@/components/OrderTable";
import EditPanel from "@/components/EditPanel";
import StabilityIssuesPanel from "@/components/StabilityIssuesPanel";
import ManualAdjustToolbar from "@/components/ManualAdjustToolbar";
import type { SelectionMode } from "@/components/ManualAdjustToolbar";
import SkuLegend from "@/components/SkuLegend";
import CollapsibleDiagnosticsPanel from "@/components/CollapsibleDiagnosticsPanel";
import WarningsPanel from "@/components/WarningsPanel";
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
import { getSkuColor } from "@/lib/skuColors";
import { layFlatLargestBase, rotateBox90, standUpright } from "@/lib/boxTransforms";
import type { RotationAxis } from "@/lib/types";
import dynamic from "next/dynamic";
import clsx from "clsx";

const PalletViewer3D = dynamic(() => import("@/components/PalletViewer3D"), { ssr: false });

// ── Helpers ───────────────────────────────────────────────────────────────────
function clonePallets(pallets: PalletResult[]): PalletResult[] {
  return JSON.parse(JSON.stringify(pallets));
}

function totalsMatch(a?: Record<string, number>, b?: Record<string, number>): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of Array.from(keys)) {
    if ((left[key] ?? 0) !== (right[key] ?? 0)) return false;
  }
  return true;
}

function warningMessage(warning: string | WarningItem): string {
  return typeof warning === "string" ? warning : warning.message;
}

function getLayerTopZ(pallet: PalletResult, targetLayer: number, movingBoxIds: Set<string>): number | null {
  if (targetLayer === 0) return 0;
  const stationaryBoxes = pallet.boxes.filter((box) => !movingBoxIds.has(box.box_id));
  const explicitLayerBoxes = stationaryBoxes.filter((box) => box.layer === targetLayer);
  if (explicitLayerBoxes.length > 0) {
    return Math.max(...explicitLayerBoxes.map((box) => box.z_mm + box.height_mm));
  }

  const zLevels = Array.from(new Set(stationaryBoxes.map((box) => Math.round(box.z_mm * 1000) / 1000))).sort((a, b) => a - b);
  const targetZ = zLevels[targetLayer - 1];
  if (targetZ === undefined) return null;
  const derivedLayerBoxes = stationaryBoxes.filter((box) => Math.abs(box.z_mm - targetZ) < 0.5);
  if (derivedLayerBoxes.length === 0) return null;
  return Math.max(...derivedLayerBoxes.map((box) => box.z_mm + box.height_mm));
}

function fallbackStabilityIssues(result: PalletiseResponse | null): StabilityIssue[] {
  if (!result) return [];
  const structured = result.stability?.issues?.length ? result.stability.issues : result.summary.stability_issues ?? [];
  if (structured.length > 0) {
    return structured.map((issue, index) => ({
      ...issue,
      id: issue.id ?? `${issue.type}-${issue.box_id ?? "layout"}-${issue.pallet_no ?? "p"}-${index}`,
    }));
  }

  const boxToPallet = new Map<string, { pallet_no: number; sku?: string }>();
  for (const pallet of result.pallets) {
    for (const box of pallet.boxes) boxToPallet.set(box.box_id, { pallet_no: pallet.pallet_no, sku: box.sku });
  }

  return result.summary.warnings
    .flatMap((warning, index) => {
      const message = warningMessage(warning);
      const box_id = message.match(/Box ['"]?([A-Za-z0-9_-]+)['"]?/i)?.[1];
      if (!box_id) return [];
      const meta = boxToPallet.get(box_id);
      const type = message.toLowerCase().includes("support") ? "unstable" : "floating";
      const severity = type === "floating" ? "error" : "warning";
      return [{
        id: `${type}-${box_id}-${index}`,
        type,
        severity,
        box_id,
        pallet_no: meta?.pallet_no,
        sku: meta?.sku,
        message,
      } satisfies StabilityIssue];
    });
}

const DEFAULT_SETTINGS: ManualAdjustmentSettings = {
  edge_threshold_length_mm: 0,
  edge_threshold_width_mm: 0,
  snap_grid_mm: 50,
  drag_sensitivity: 0.35,
  autoFitSearchRadiusMm: 150,
  do_not_allow_stability_issues: true,
  prefer_larger_base: false,
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
  const [viewMode, setViewMode] = useState<"normal" | "xray" | "solid">("normal");
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
  const [autoFitOnRelease, setAutoFitOnRelease] = useState(true);
  const [magneticSnapEnabled, setMagneticSnapEnabled] = useState(false);
  const [magneticSnapStrength, setMagneticSnapStrength] = useState(0.65);
  const [lockedRows, setLockedRows] = useState<LockedRow[]>([]);
  const [compactWarnings, setCompactWarnings] = useState<string[]>([]);
  const [validation, setValidation] = useState<LayoutValidationResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [legendSku, setLegendSku] = useState<string | undefined>();
  const [legendHoverSku, setLegendHoverSku] = useState<string | undefined>();
  const [legendScope, setLegendScope] = useState<"current" | "all">("current");
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [highlightedIssueBoxIds, setHighlightedIssueBoxIds] = useState<Set<string>>(new Set());
  const [activeIssue, setActiveIssue] = useState<StabilityIssue | null>(null);
  const [showInspectorPanel, setShowInspectorPanel] = useState(false);
  const [inspectorMode, setInspectorMode] = useState<"readonly" | "edit">("readonly");
  const [showStabilityIssuesPanel, setShowStabilityIssuesPanel] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

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
      setValidation(validateLayout(
        editedPallets,
        PALLET_SPEC,
        settings,
        unlockedMode
          ? { mode: "soft", allowOutOfBounds: true, allowOverlap: true, allowFloating: true }
          : { mode: "strict" },
      ));
    }
  }, [editedPallets, editMode, settings, unlockedMode]);

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

  const commitValidatedPallets = useCallback((
    fn: (draft: PalletResult[]) => string | void,
    failureMessage: string,
  ) => {
    setEditedPallets((prev) => {
      const next = clonePallets(prev);
      const message = fn(next);
      if (message) {
        setSaveMsg(message);
        return prev;
      }
      const check = validateLayout(
        next,
        PALLET_SPEC,
        settings,
        unlockedMode
          ? { mode: "soft", allowOutOfBounds: true, allowOverlap: true, allowFloating: true }
          : { mode: "strict" },
      );
      setValidation(check);
      if (unlockedMode) {
        pushHistory(prev);
        setFuture([]);
        setSaveMsg(check.errors.length > 0 || check.warnings.length > 0
          ? "Transform applied in Unlocked Mode. Move boxes back into a valid position before saving."
          : null);
        return next;
      }
      if (!check.isValid) {
        setSaveMsg(`${failureMessage} ${check.errors[0] ?? ""}`.trim());
        return prev;
      }
      pushHistory(prev);
      setFuture([]);
      setSaveMsg(null);
      return next;
    });
  }, [pushHistory, settings, unlockedMode]);

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
    setSelectedBoxId(box.box_id);
    setShowInspectorPanel(true);
    setInspectorMode(editMode ? "edit" : "readonly");
  }, [editMode, editedPallets, selectedPallet, selectionMode]);

  const handleViewerBoxClick = useCallback((box: BoxResult, multi: boolean) => {
    if (editMode) {
      handleBoxClick(box, multi);
      return;
    }
    setSelectedBoxIds(new Set([box.box_id]));
    setSelectedBoxId(box.box_id);
    setShowInspectorPanel(true);
    setInspectorMode("readonly");
  }, [editMode, handleBoxClick]);

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

  // ── Rotation ──────────────────────────────────────────────────────────────
  const handleRotate = useCallback((boxIds: string[], palletIdx: number, axis: RotationAxis) => {
    commitValidatedPallets((draft) => {
      const p = draft[palletIdx];
      if (!p) return "Pallet not found.";
      if ((axis === "x" || axis === "y") && p.boxes.some((box) => boxIds.includes(box.box_id) && box.stand_upright_only)) {
        return "This SKU is stand-upright-only. X/Y rotation is not allowed.";
      }
      for (const id of boxIds) {
        const box = p.boxes.find((b) => b.box_id === id);
        if (box) Object.assign(box, rotateBox90(box, axis));
      }
    }, "Rotation would create an invalid layout. Switch to Unlocked Mode to force it.");
  }, [commitValidatedPallets]);

  const handleLayFlat = useCallback((boxIds: string[], palletIdx: number) => {
    commitValidatedPallets((draft) => {
      const p = draft[palletIdx];
      if (!p) return "Pallet not found.";
      for (const id of boxIds) {
        const box = p.boxes.find((b) => b.box_id === id);
        if (box) Object.assign(box, layFlatLargestBase(box));
      }
    }, "Lay flat would create an invalid layout. Switch to Unlocked Mode to force it.");
  }, [commitValidatedPallets]);

  const handlePutOnLayer = useCallback((boxIds: string[], palletIdx: number) => {
    const input = window.prompt("Put selected box on top of which layer? Use 0 for floor.", "1");
    if (input === null) return;
    const targetLayer = Number(input);
    if (!Number.isInteger(targetLayer) || targetLayer < 0) {
      setSaveMsg("Layer must be an integer greater than or equal to 0.");
      return;
    }

    commitValidatedPallets((draft) => {
      const p = draft[palletIdx];
      if (!p) return "Pallet not found.";
      const movingIds = new Set(boxIds);
      const movingBoxes = p.boxes.filter((box) => movingIds.has(box.box_id));
      if (movingBoxes.length === 0) return "No selected boxes found.";
      const targetZ = getLayerTopZ(p, targetLayer, movingIds);
      if (targetZ === null) return `Layer ${targetLayer} does not exist.`;
      const minZ = Math.min(...movingBoxes.map((box) => box.z_mm));
      const deltaZ = targetZ - minZ;
      for (const box of movingBoxes) {
        box.z_mm = Math.max(0, box.z_mm + deltaZ);
        box.layer = targetLayer === 0 ? 1 : targetLayer + 1;
      }
    }, `Cannot put box on layer ${targetLayer} at current X/Y because it overlaps or is unsupported. Switch to Unlocked Mode to force it.`);
  }, [commitValidatedPallets]);

  // ── Stand Upright ─────────────────────────────────────────────────────────
  const handleStandUpright = useCallback((boxId: string, palletIdx: number) => {
    commitValidatedPallets((draft) => {
      const box = draft[palletIdx]?.boxes.find((b) => b.box_id === boxId);
      if (!box) return "Box not found.";
      Object.assign(box, standUpright(box));
    }, "Cannot stand upright because the adjusted layout is invalid.");
  }, [commitValidatedPallets]);

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
      setIsManuallyAdjusted(res.manually_adjusted);
      setSaveMsg(res.validation.is_valid
        ? "Saved successfully ✓"
        : res.status === "rejected"
        ? "Save blocked — resolve stability issues or disable strict stability"
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
    setSelectedBoxId(null);
    setHighlightedIssueBoxIds(new Set());
    setActiveIssue(null);
    setShowStabilityIssuesPanel(false);
    setShowInspectorPanel(true);
    setInspectorMode("edit");
    setValidation(null);
    setSaveMsg(null);
    setEditMode(true);
  };

  const exitEditMode = () => {
    setEditMode(false);
    setSelectedBoxIds(new Set());
    setSelectedBoxId(null);
    setShowInspectorPanel(false);
    setInspectorMode("readonly");
    setValidation(null);
    setSaveMsg(null);
  };

  const activePallets = editMode ? editedPallets : result?.pallets ?? [];
  const pallet = activePallets[selectedPallet];
  const stabilityIssues = useMemo(() => fallbackStabilityIssues(result), [result]);
  const issueBoxIds = useMemo(
    () => new Set(stabilityIssues.map((issue) => issue.box_id).filter((id): id is string => Boolean(id))),
    [stabilityIssues],
  );
  const allBoxes = useMemo(() => activePallets.flatMap((p) => p.boxes), [activePallets]);
  const legendBoxes = legendScope === "all" ? allBoxes : pallet?.boxes ?? [];
  const maxLayer = pallet ? Math.max(...pallet.boxes.map((b) => b.layer), 1) : 1;
  const invalidIds = new Set<string>(validation?.invalidBoxIds ?? []);
  const selectedBoxIdsArr = Array.from(selectedBoxIds);
  const selectedIssueMessages = useMemo(() => {
    const id = selectedBoxId ?? selectedBoxIdsArr[0];
    if (!id) return [];
    const issueMessages = stabilityIssues
      .filter((issue) => issue.box_id === id)
      .map((issue) => issue.message);
    const validationMessages = validation?.issues
      .filter((issue) => issue.box_id === id)
      .map((issue) => issue.message) ?? [];
    return Array.from(new Set([...issueMessages, ...validationMessages]));
  }, [selectedBoxId, selectedBoxIdsArr, stabilityIssues, validation]);
  const selectIssue = useCallback((issue: StabilityIssue) => {
    setTab("3d");
    setShowStabilityIssuesPanel(true);
    setShowInspectorPanel(true);
    setInspectorMode("readonly");
    setActiveIssue(issue);
    if (issue.box_id) {
      setSelectedBoxId(issue.box_id);
      setSelectedBoxIds(new Set([issue.box_id]));
    }
    if (issue.pallet_no !== undefined) {
      const palletIndex = activePallets.findIndex((p) => p.pallet_no === issue.pallet_no);
      if (palletIndex >= 0) {
        setSelectedPallet(palletIndex);
        setLayerFilter(null);
      }
    }
  }, [activePallets]);
  const openStabilityIssues = useCallback(() => {
    if (stabilityIssues.length === 0) return;
    setHighlightedIssueBoxIds(issueBoxIds);
    const first = stabilityIssues.find((issue) => issue.box_id) ?? stabilityIssues[0];
    selectIssue(first);
  }, [issueBoxIds, selectIssue, stabilityIssues]);
  const colorBySku = useMemo(() => {
    const colors: Record<string, string> = {};
    for (const box of allBoxes) colors[box.sku] = getSkuColor(box.sku);
    return colors;
  }, [allBoxes]);
  const highlightedSku = legendHoverSku ?? legendSku;
  const responseSkuTotals = result?.summary.sku_totals ?? {};
  const requestSkuTotals = result?.summary.request_sku_totals ?? {};
  const responseTotalBoxes = result?.summary.total_boxes ?? 0;
  const requestTotalBoxes = result?.summary.request_total_boxes ?? responseTotalBoxes;
  const boxCountMismatch = requestTotalBoxes !== responseTotalBoxes;
  const skuTotalsMismatch = !totalsMatch(requestSkuTotals, responseSkuTotals);
  const debugMismatch = boxCountMismatch || skuTotalsMismatch;
  const diagnosticIssueCount = (boxCountMismatch ? 1 : 0) + (skuTotalsMismatch ? 1 : 0);

  useEffect(() => {
    if (debugMismatch) setDiagnosticsOpen(true);
  }, [debugMismatch]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!result) return <div className="p-8 text-gray-500">Loading…</div>;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {result.order_id ? `Results - ${result.order_id}` : "Results"}
          </h1>
          <p className="text-gray-400 text-xs">
            <code className="font-mono bg-gray-100 px-1 rounded">{result.job_id}</code>
            {" · "}{result.algorithm_used}
            {isManuallyAdjusted && (
              <span className="ml-2 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-medium">
                Manually Adjusted
              </span>
            )}
            <span className="ml-2 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs font-medium">
              Stability Strict: {result.constraints_used?.do_not_allow_stability_issues ?? true ? "ON" : "OFF"}
            </span>
            <span className="ml-2 bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs font-medium">
              Larger Base Preference: {result.constraints_used?.prefer_larger_base ? "ON" : "OFF"}
            </span>
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
          autoFitOnRelease={autoFitOnRelease}
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
          onAutoFitOnReleaseChange={setAutoFitOnRelease}
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
      <div className="px-6 py-2 border-b border-gray-100 flex-shrink-0">
        <ResultSummaryCards summary={result.summary} onStabilityClick={openStabilityIssues} />
      </div>

      <WarningsPanel
        warnings={result.summary.warnings}
        jobId={result.job_id}
        storageKey={`palletisation:dismissedWarnings:${result.job_id}`}
      />

      {(result.unplaced_boxes?.length ?? 0) > 0 && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700 flex-shrink-0">
          <span className="font-semibold mr-3">Unplaced boxes:</span>
          {result.unplaced_boxes?.slice(0, 5).map((box) => (
            <span key={box.box_id} className="mr-4">{box.box_id} ({box.sku}): {box.reason}</span>
          ))}
          {(result.unplaced_boxes?.length ?? 0) > 5 && <span>+{(result.unplaced_boxes?.length ?? 0) - 5} more</span>}
        </div>
      )}

      <CollapsibleDiagnosticsPanel
        open={diagnosticsOpen}
        onOpenChange={setDiagnosticsOpen}
        mismatchCount={diagnosticIssueCount}
        diagnostics={
          <div className={clsx("space-y-2", debugMismatch ? "text-red-700" : "text-slate-600")}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>Request boxes: {requestTotalBoxes} | Response boxes: {responseTotalBoxes}</div>
              <div>Request SKUs: {JSON.stringify(requestSkuTotals)} | Response SKUs: {JSON.stringify(responseSkuTotals)}</div>
            </div>
            {Object.keys(result.summary.center_totals ?? {}).length > 0 && (
              <div className="overflow-x-auto">
                <div className="font-semibold mb-1">Centers</div>
                <table className="min-w-full text-left">
                  <thead className="text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="pr-4 py-1">Center</th>
                      <th className="pr-4 py-1">Lines</th>
                      <th className="pr-4 py-1">Expected</th>
                      <th className="pr-4 py-1">Expanded</th>
                      <th className="pr-4 py-1">Raw Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.summary.center_totals ?? {}).map(([label, center]) => (
                      <tr key={label} className="border-t border-slate-200">
                        <td className="pr-4 py-1 whitespace-nowrap">{label}</td>
                        <td className="pr-4 py-1">{center.input_lines}</td>
                        <td className="pr-4 py-1">{center.expected_cartons ?? "—"}</td>
                        <td className="pr-4 py-1">{center.expanded_cartons}</td>
                        <td className="pr-4 py-1">{center.quantity_sum_raw}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.summary.warnings.length > 0 && (
              <div>Warnings in response: {result.summary.warnings.length}</div>
            )}
          </div>
        }
      />

      {/* Pallet tabs */}
      <div className="flex gap-2 px-6 py-1.5 flex-shrink-0 flex-wrap border-b border-gray-100">
        {activePallets.map((p, i) => {
          const cgSev = p.cg_severity;
          const cgDot = cgSev === "error"
            ? <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="CG error" />
            : cgSev === "warning"
            ? <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="CG warning" />
            : null;
          return (
            <button key={i}
              onClick={() => { setSelectedPallet(i); setLayerFilter(null); setSelectedBoxIds(new Set()); setSelectedBoxId(null); setActiveIssue(null); }}
              className={clsx("flex items-center px-3 py-1.5 rounded text-sm font-medium border transition-colors",
                selectedPallet === i
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400")}>
              Pallet {p.pallet_no} ({p.box_count}){cgDot}
            </button>
          );
        })}
      </div>

      {/* Per-pallet CG strip */}
      {pallet && (() => {
        const sev = pallet.cg_severity;
        if (!sev) return null;
        const ox = pallet.cg_offset_xmm ?? 0;
        const oy = pallet.cg_offset_ymm ?? 0;
        const fx = ((pallet.cg_offset_fraction_x ?? 0) * 100).toFixed(1);
        const fy = ((pallet.cg_offset_fraction_y ?? 0) * 100).toFixed(1);
        const cgx = (pallet.cg_xmm ?? 0).toFixed(1);
        const cgy = (pallet.cg_ymm ?? 0).toFixed(1);
        const colors = sev === "error"
          ? { bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500", text: "text-red-700", badge: "bg-red-100 text-red-700 border-red-200" }
          : sev === "warning"
          ? { bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", text: "text-amber-700", badge: "bg-amber-100 text-amber-700 border-amber-200" }
          : { bg: "bg-green-50", border: "border-green-200", dot: "bg-green-500", text: "text-green-700", badge: "bg-green-100 text-green-700 border-green-200" };
        return (
          <div className={clsx("flex items-center gap-4 px-6 py-2 border-b flex-shrink-0 text-xs flex-wrap", colors.bg, colors.border)}>
            <div className="flex items-center gap-1.5 font-semibold">
              <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", colors.dot)} />
              <span className={colors.text}>Center of Gravity — Pallet {pallet.pallet_no}</span>
              <span className={clsx("ml-1 px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase", colors.badge)}>{sev}</span>
            </div>
            <div className="flex gap-4 text-gray-600">
              <span>Position: <span className="font-medium text-gray-900">X {cgx} mm, Y {cgy} mm</span></span>
              <span>Offset X: <span className={clsx("font-medium", sev !== "ok" && colors.text)}>{ox >= 0 ? "+" : ""}{ox.toFixed(1)} mm ({fx}%)</span></span>
              <span>Offset Y: <span className={clsx("font-medium", sev !== "ok" && colors.text)}>{oy >= 0 ? "+" : ""}{oy.toFixed(1)} mm ({fy}%)</span></span>
              <span className="text-gray-400">Thresholds: ok &lt;15% · warning &lt;30% · error ≥30%</span>
            </div>
          </div>
        );
      })()}

      {/* Main content */}
      <div className="flex flex-1 min-h-[640px] overflow-hidden">
        {showStabilityIssuesPanel && (
          <StabilityIssuesPanel
            issues={stabilityIssues}
            selectedIssueId={activeIssue?.id}
            onIssueClick={selectIssue}
          />
        )}
        <div className="flex-1 flex min-h-[640px] flex-col overflow-hidden">
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
            <div className="flex-1 flex min-h-[640px] flex-col overflow-hidden">
              {/* Render mode tabs */}
              <div className="flex items-center gap-1 px-4 py-1.5 bg-white border-b border-gray-100 flex-shrink-0">
                {(["normal", "xray", "solid"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={clsx(
                      "px-3 py-1 rounded-md text-xs font-medium border transition-colors",
                      viewMode === mode
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600",
                    )}
                  >
                    {mode === "normal" ? "Normal View" : mode === "xray" ? "X-Ray View" : "Solid View"}
                  </button>
                ))}
              </div>
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
              <div className="flex-1 flex min-h-[560px]">
                <div className="flex-1 relative min-w-0 min-h-[560px]">
                  <PalletViewer3D
                    pallet={pallet}
                    palletSpec={PALLET_SPEC}
                    viewMode={viewMode}
                    layerFilter={layerFilter}
                    editMode={editMode}
                    settings={settings}
                    invalidBoxIds={invalidIds}
                    selectedBoxIds={selectedBoxIds}
                    issueBoxIds={highlightedIssueBoxIds}
                    highlightedSku={highlightedSku}
                    colorBySku={colorBySku}
                    snapToBoxEdges={snapToBoxEdges}
                    snapToThreshold={snapToThreshold}
                    unlockedMode={unlockedMode}
                    autoFitOnRelease={autoFitOnRelease}
                    magneticSnapEnabled={magneticSnapEnabled && !unlockedMode}
                    magneticSnapStrength={magneticSnapStrength}
                    lockedRows={lockedRows}
                    onBoxClick={handleViewerBoxClick}
                    onBoxDragEnd={editMode ? handleBoxDragEnd : undefined}
                    onManualAdjustMessage={setSaveMsg}
                  />
                </div>
                <SkuLegend
                  boxes={legendBoxes}
                  colorBySku={colorBySku}
                  scope={legendScope}
                  selectedSku={legendSku}
                  onScopeChange={setLegendScope}
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

        {/* Inspector / edit panel */}
        {(editMode || showInspectorPanel) && (
          <EditPanel
            mode={editMode && inspectorMode === "edit" ? "edit" : "readonly"}
            title={editMode && inspectorMode === "edit" ? "Selected" : activeIssue ? "Stability Issue Details" : "Box Details"}
            selectedBoxIds={selectedBoxIdsArr}
            selectedPalletIdx={selectedPallet}
            pallets={activePallets}
            palletSpec={PALLET_SPEC}
            settings={settings}
            unlockedMode={unlockedMode}
            onSettingsChange={setSettings}
            validation={validation}
            issueMessages={selectedIssueMessages}
            isSaving={isSaving}
            lockedRows={lockedRows}
            onLockRow={handleLockRow}
            onUnlockRow={handleUnlockRow}
            compactWarnings={compactWarnings}
            onClearCompactWarnings={() => setCompactWarnings([])}
            onMove={handleMove}
            onRotate={handleRotate}
            onLayFlat={handleLayFlat}
            onPutOnLayer={handlePutOnLayer}
            onStandUpright={handleStandUpright}
            onDelete={handleDelete}
            onMoveToPallet={handleMoveToPallet}
            onSave={handleSave}
            onClose={() => {
              if (editMode) exitEditMode();
              else {
                setShowInspectorPanel(false);
                setSelectedBoxIds(new Set());
                setSelectedBoxId(null);
                setActiveIssue(null);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
