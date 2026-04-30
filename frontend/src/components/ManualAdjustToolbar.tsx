"use client";
import clsx from "clsx";
import type { ManualAdjustmentSettings } from "@/lib/types";

export type SelectionMode = "single" | "sku";

interface Props {
  settings: ManualAdjustmentSettings;
  selectionMode: SelectionMode;
  snapToBoxEdges: boolean;
  snapToThreshold: boolean;
  unlockedMode: boolean;
  autoFitOnRelease: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  isOrbitActive: boolean;
  // Compact
  canCompactRow: boolean;
  canCompactLayer: boolean;
  onCompactRow: () => void;
  onCompactLayer: () => void;
  onCompactPallet: () => void;
  // Magnetic snap
  magneticSnapEnabled: boolean;
  magneticSnapStrength: number;
  onToggleMagneticSnap: () => void;
  onSetMagneticSnapStrength: (v: number) => void;
  // Existing callbacks
  onSettingsChange: (s: ManualAdjustmentSettings) => void;
  onSelectionModeChange: (m: SelectionMode) => void;
  onSnapToBoxEdgesChange: (v: boolean) => void;
  onSnapToThresholdChange: (v: boolean) => void;
  onUnlockedModeChange: (v: boolean) => void;
  onAutoFitOnReleaseChange: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSave: () => void;
  onExit: () => void;
}

function Btn({
  active, disabled, onClick, children, color = "default", title,
}: {
  active?: boolean; disabled?: boolean; onClick?: () => void;
  children: React.ReactNode; color?: "default" | "blue" | "red" | "green" | "purple";
  title?: string;
}) {
  const base = "px-3 py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-40";
  const variants = {
    default: active ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
    blue: active ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100",
    red: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100",
    green: "bg-green-600 text-white border-green-600 hover:bg-green-700",
    purple: active ? "bg-purple-600 text-white border-purple-600" : "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100",
  };
  return (
    <button title={title} className={clsx(base, variants[color])} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

const SNAP_STRENGTH_OPTIONS = [
  { label: "Gentle", value: 0.35 },
  { label: "Normal", value: 0.65 },
  { label: "Strong", value: 0.9 },
] as const;

export default function ManualAdjustToolbar({
  settings, selectionMode, snapToBoxEdges, snapToThreshold, unlockedMode, autoFitOnRelease,
  canUndo, canRedo, isSaving, isOrbitActive,
  canCompactRow, canCompactLayer,
  magneticSnapEnabled, magneticSnapStrength,
  onSettingsChange, onSelectionModeChange, onSnapToBoxEdgesChange, onSnapToThresholdChange, onUnlockedModeChange, onAutoFitOnReleaseChange,
  onCompactRow, onCompactLayer, onCompactPallet,
  onToggleMagneticSnap, onSetMagneticSnapStrength,
  onUndo, onRedo, onReset, onSave, onExit,
}: Props) {
  const upd = (k: keyof ManualAdjustmentSettings, v: number) =>
    onSettingsChange({ ...settings, [k]: v });

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-950 flex-wrap">
      {/* Mode badge */}
      <span className={clsx(
        "text-xs font-bold px-2 py-1 rounded",
        isOrbitActive ? "bg-amber-400 text-amber-900" : "bg-indigo-400 text-white",
      )}>
        {isOrbitActive ? "ORBIT (Space)" : "2D ADJUST"}
      </span>

      <div className="w-px h-5 bg-indigo-700" />

      {/* Selection mode */}
      <Btn active={selectionMode === "single"} color="blue" onClick={() => onSelectionModeChange("single")}>
        Select Single
      </Btn>
      <Btn active={selectionMode === "sku"} color="blue" onClick={() => onSelectionModeChange("sku")}>
        Select Same SKU
      </Btn>

      <div className="w-px h-5 bg-indigo-700" />

      <Btn active={!unlockedMode} onClick={() => onUnlockedModeChange(false)}>
        Locked
      </Btn>
      <Btn active={unlockedMode} onClick={() => onUnlockedModeChange(true)}>
        Unlocked
      </Btn>
      <Btn
        active={autoFitOnRelease}
        onClick={() => onAutoFitOnReleaseChange(!autoFitOnRelease)}
        title="On release, slot the selection into a nearby valid gap when possible"
      >
        Auto Fit {autoFitOnRelease ? "ON" : "OFF"}
      </Btn>

      <div className="w-px h-5 bg-indigo-700" />

      {/* Snap grid */}
      <span className="text-xs text-indigo-300">Grid:</span>
      {([10, 50, 100] as const).map((g) => (
        <Btn key={g} active={settings.snap_grid_mm === g}
          disabled={unlockedMode}
          onClick={() => upd("snap_grid_mm", g)}>
          {g}mm
        </Btn>
      ))}

      {/* Snap toggles */}
      <Btn active={snapToBoxEdges} disabled={unlockedMode} onClick={() => onSnapToBoxEdgesChange(!snapToBoxEdges)}>
        Snap→Box
      </Btn>
      <Btn active={snapToThreshold} disabled={unlockedMode} onClick={() => onSnapToThresholdChange(!snapToThreshold)}>
        Snap→Edge
      </Btn>

      <div className="w-px h-5 bg-indigo-700" />

      {/* Edge thresholds */}
      <span className="text-xs text-indigo-300">Threshold L:</span>
      <input
        type="number" min={0} max={200} step={10}
        value={settings.edge_threshold_length_mm}
        onChange={(e) => upd("edge_threshold_length_mm", Number(e.target.value))}
        className="w-14 text-xs px-1.5 py-1 rounded border border-indigo-700 bg-indigo-900 text-white text-center"
      />
      <span className="text-xs text-indigo-300">W:</span>
      <input
        type="number" min={0} max={200} step={10}
        value={settings.edge_threshold_width_mm}
        onChange={(e) => upd("edge_threshold_width_mm", Number(e.target.value))}
        className="w-14 text-xs px-1.5 py-1 rounded border border-indigo-700 bg-indigo-900 text-white text-center"
      />

      <div className="w-px h-5 bg-indigo-700" />

      {/* Auto Compact */}
      <span className="text-xs text-indigo-300">Compact:</span>
      <Btn
        disabled={!canCompactRow}
        onClick={onCompactRow}
        title="Repack the selected row flush along X"
      >
        Row
      </Btn>
      <Btn
        disabled={!canCompactLayer}
        onClick={onCompactLayer}
        title="Repack all rows on the active layer"
      >
        Layer
      </Btn>
      <Btn onClick={onCompactPallet} title="Compact every layer on this pallet">
        Pallet
      </Btn>

      <div className="w-px h-5 bg-indigo-700" />

      {/* Magnetic snap */}
      <Btn
        active={magneticSnapEnabled}
        color="purple"
        disabled={unlockedMode}
        onClick={onToggleMagneticSnap}
        title="Replace hard grid snap with smooth magnetic attraction"
      >
        ⊕ Mag.Snap
      </Btn>
      {magneticSnapEnabled && !unlockedMode && SNAP_STRENGTH_OPTIONS.map((opt) => (
        <Btn
          key={opt.value}
          active={magneticSnapStrength === opt.value}
          color="purple"
          onClick={() => onSetMagneticSnapStrength(opt.value)}
        >
          {opt.label}
        </Btn>
      ))}

      <div className="w-px h-5 bg-indigo-700" />

      {/* History */}
      <Btn disabled={!canUndo} onClick={onUndo}>↩ Undo</Btn>
      <Btn disabled={!canRedo} onClick={onRedo}>↪ Redo</Btn>

      <div className="w-px h-5 bg-indigo-700" />

      <Btn color="red" onClick={onReset}>Reset</Btn>
      <Btn color="green" disabled={isSaving} onClick={onSave}>
        {isSaving ? "Saving…" : "Save Layout"}
      </Btn>
      <Btn onClick={onExit}>Exit Edit</Btn>

      <span className="text-xs text-indigo-400 ml-auto hidden lg:block">
        Hold Alt = temp unlocked • Hold Space = orbit
      </span>
    </div>
  );
}
