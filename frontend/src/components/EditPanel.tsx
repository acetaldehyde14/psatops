"use client";
import type { BoxResult, PalletResult, AdjustmentValidation } from "@/lib/types";
import clsx from "clsx";

interface Props {
  selectedBox: BoxResult | null;
  selectedPalletIdx: number;
  pallets: PalletResult[];
  palletSpec: { length_mm: number; width_mm: number; max_height_mm: number; max_weight_kg: number };
  snapGrid: number;
  validation: AdjustmentValidation | null;
  canUndo: boolean;
  canRedo: boolean;
  isSaving: boolean;
  onMove: (boxId: string, palletIdx: number, x: number, y: number, z: number) => void;
  onRotate: (boxId: string, palletIdx: number) => void;
  onDelete: (boxId: string, palletIdx: number) => void;
  onMoveToPallet: (boxId: string, fromIdx: number, toIdx: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onReset: () => void;
  onSnapChange: (v: number) => void;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right max-w-[60%] truncate">{String(value)}</span>
    </div>
  );
}

function NumField({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min?: number; max?: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 w-6">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
      />
    </div>
  );
}

export default function EditPanel({
  selectedBox, selectedPalletIdx, pallets, palletSpec, snapGrid,
  validation, canUndo, canRedo, isSaving,
  onMove, onRotate, onDelete, onMoveToPallet,
  onUndo, onRedo, onSave, onReset, onSnapChange, onClose,
}: Props) {
  const box = selectedBox;

  const handleCoord = (axis: "x" | "y" | "z", raw: number) => {
    if (!box) return;
    const snapped = Math.round(raw / snapGrid) * snapGrid;
    const x = axis === "x" ? snapped : box.x_mm;
    const y = axis === "y" ? snapped : box.y_mm;
    const z = axis === "z" ? snapped : box.z_mm;
    onMove(box.box_id, selectedPalletIdx, x, y, z);
  };

  const handleLayerUp = () => {
    if (!box) return;
    const step = Math.round(box.height_mm / snapGrid) * snapGrid || box.height_mm;
    onMove(box.box_id, selectedPalletIdx, box.x_mm, box.y_mm, box.z_mm + step);
  };

  const handleLayerDown = () => {
    if (!box) return;
    const step = Math.round(box.height_mm / snapGrid) * snapGrid || box.height_mm;
    const newZ = Math.max(0, box.z_mm - step);
    onMove(box.box_id, selectedPalletIdx, box.x_mm, box.y_mm, newZ);
  };

  const errorMap = new Set<string>();
  validation?.errors.forEach((e) => { if (box && e.includes(box.box_id)) errorMap.add(e); });
  const warnMap = new Set<string>();
  validation?.warnings.forEach((w) => { if (box && w.includes(box.box_id)) warnMap.add(w); });

  const hasBoxError = errorMap.size > 0;

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden shadow-xl z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="font-semibold text-sm text-gray-800">Edit Mode</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-lg leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Global validation summary */}
        {validation && (
          <div className="px-4 pt-3">
            {validation.errors.length > 0 && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 space-y-0.5">
                <div className="font-semibold mb-1">Errors ({validation.errors.length})</div>
                {validation.errors.slice(0, 4).map((e, i) => <p key={i}>{e}</p>)}
                {validation.errors.length > 4 && <p>+{validation.errors.length - 4} more</p>}
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 space-y-0.5">
                <div className="font-semibold mb-1">Warnings ({validation.warnings.length})</div>
                {validation.warnings.slice(0, 3).map((w, i) => <p key={i}>{w}</p>)}
                {validation.warnings.length > 3 && <p>+{validation.warnings.length - 3} more</p>}
              </div>
            )}
            {validation.is_valid && validation.errors.length === 0 && (
              <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 font-medium">
                Layout valid ✓
              </div>
            )}
          </div>
        )}

        {/* Selected box */}
        {box ? (
          <div className="px-4 pt-2 pb-3">
            <div className={clsx(
              "rounded-lg border p-3 mb-3",
              hasBoxError ? "border-red-300 bg-red-50" : "border-blue-200 bg-blue-50"
            )}>
              <div className="text-xs font-semibold text-gray-700 mb-2">Selected Box</div>
              <Row label="Box ID" value={box.box_id} />
              <Row label="SKU" value={box.sku} />
              <Row label="Lot No." value={box.lot_no} />
              <Row label="Pallet" value={`Pallet ${pallets[selectedPalletIdx]?.pallet_no}`} />
              <Row label="Rotation" value={box.rotation} />
              <Row label="Layer" value={box.layer} />
              <Row label="Weight" value={`${box.weight_kg} kg`} />
              <Row label="L×W×H" value={`${box.length_mm}×${box.width_mm}×${box.height_mm}`} />
            </div>

            {/* Position inputs */}
            <div className="mb-3">
              <div className="text-xs font-medium text-gray-600 mb-2">Position (mm)</div>
              <div className="space-y-1.5">
                <NumField label="X" value={box.x_mm} min={0} max={palletSpec.length_mm} step={snapGrid}
                  onChange={(v) => handleCoord("x", v)} />
                <NumField label="Y" value={box.y_mm} min={0} max={palletSpec.width_mm} step={snapGrid}
                  onChange={(v) => handleCoord("y", v)} />
                <NumField label="Z" value={box.z_mm} min={0} max={palletSpec.max_height_mm} step={snapGrid}
                  onChange={(v) => handleCoord("z", v)} />
              </div>
            </div>

            {/* Snap grid */}
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">Snap grid</span>
              {[10, 50, 100].map((g) => (
                <button key={g} onClick={() => onSnapChange(g)}
                  className={clsx("px-2 py-0.5 rounded text-xs border", snapGrid === g
                    ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300")}>
                  {g}mm
                </button>
              ))}
            </div>

            {/* Per-box errors/warnings */}
            {hasBoxError && (
              <div className="mb-2 text-xs text-red-600 space-y-0.5">
                {Array.from(errorMap).map((e, i) => <p key={i}>⚠ {e}</p>)}
              </div>
            )}
            {warnMap.size > 0 && (
              <div className="mb-2 text-xs text-yellow-600 space-y-0.5">
                {Array.from(warnMap).map((w, i) => <p key={i}>⚡ {w}</p>)}
              </div>
            )}

            {/* Box action buttons */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              <button onClick={() => onRotate(box.box_id, selectedPalletIdx)}
                className="col-span-2 py-1.5 rounded text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                Rotate 90°
              </button>
              <button onClick={handleLayerUp}
                className="py-1.5 rounded text-xs font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100">
                ↑ Layer Up
              </button>
              <button onClick={handleLayerDown}
                className="py-1.5 rounded text-xs font-medium bg-gray-50 border border-gray-200 hover:bg-gray-100">
                ↓ Layer Down
              </button>
              {pallets.length > 1 && pallets.map((p, idx) => {
                if (idx === selectedPalletIdx) return null;
                return (
                  <button key={idx} onClick={() => onMoveToPallet(box.box_id, selectedPalletIdx, idx)}
                    className="col-span-2 py-1.5 rounded text-xs font-medium bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100">
                    Move to Pallet {p.pallet_no}
                  </button>
                );
              })}
              <button onClick={() => onDelete(box.box_id, selectedPalletIdx)}
                className="col-span-2 py-1.5 rounded text-xs font-medium bg-red-50 border border-red-200 text-red-700 hover:bg-red-100">
                Delete Box
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-xs text-gray-400">
            Click a box in the 3D view to select it.
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-gray-200 p-3 space-y-2">
        <div className="flex gap-1.5">
          <button onClick={onUndo} disabled={!canUndo}
            className="flex-1 py-1.5 rounded text-xs font-medium border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
            ↩ Undo
          </button>
          <button onClick={onRedo} disabled={!canRedo}
            className="flex-1 py-1.5 rounded text-xs font-medium border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
            ↪ Redo
          </button>
        </div>
        <button onClick={onReset}
          className="w-full py-1.5 rounded text-xs font-medium border border-gray-300 hover:bg-gray-50 text-gray-600">
          Reset to Generated
        </button>
        <button onClick={onSave} disabled={isSaving}
          className="w-full py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors">
          {isSaving ? "Saving…" : "Save Adjusted Layout"}
        </button>
      </div>
    </div>
  );
}
