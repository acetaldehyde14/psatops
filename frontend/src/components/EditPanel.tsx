"use client";
import type { BoxResult, PalletResult, LayoutValidationResult, ManualAdjustmentSettings } from "@/lib/types";
import clsx from "clsx";

interface Props {
  selectedBoxIds: string[];
  selectedPalletIdx: number;
  pallets: PalletResult[];
  palletSpec: { length_mm: number; width_mm: number; max_height_mm: number; max_weight_kg: number };
  settings: ManualAdjustmentSettings;
  onSettingsChange: (settings: ManualAdjustmentSettings) => void;
  validation: LayoutValidationResult | null;
  isSaving: boolean;
  onMove: (boxIds: string[], palletIdx: number, dx: number, dy: number, dz: number) => void;
  onRotate: (boxIds: string[], palletIdx: number) => void;
  onStandUpright: (boxId: string, palletIdx: number) => void;
  onDelete: (boxIds: string[], palletIdx: number) => void;
  onMoveToPallet: (boxIds: string[], fromIdx: number, toIdx: number) => void;
  onSave: () => void;
  onClose: () => void;
}

function Badge({ label, color }: { label: string; color: "red" | "amber" | "blue" | "gray" }) {
  const cls = {
    red: "bg-red-100 text-red-700 border-red-200",
    amber: "bg-amber-100 text-amber-700 border-amber-200",
    blue: "bg-blue-100 text-blue-700 border-blue-200",
    gray: "bg-gray-100 text-gray-600 border-gray-200",
  }[color];
  return <span className={clsx("text-[10px] font-semibold px-1.5 py-0.5 rounded border", cls)}>{label}</span>;
}

function Row({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right truncate max-w-[55%]">{String(value)}</span>
    </div>
  );
}

function ActionBtn({ onClick, children, variant = "default", disabled }: {
  onClick: () => void; children: React.ReactNode;
  variant?: "default" | "danger" | "primary"; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={clsx(
        "py-1.5 rounded text-xs font-medium border transition-colors disabled:opacity-40",
        variant === "danger" && "bg-red-50 border-red-200 text-red-700 hover:bg-red-100",
        variant === "primary" && "bg-blue-600 border-blue-600 text-white hover:bg-blue-700",
        variant === "default" && "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100",
      )}
    >
      {children}
    </button>
  );
}

export default function EditPanel({
  selectedBoxIds, selectedPalletIdx, pallets, palletSpec, settings,
  onSettingsChange,
  validation, isSaving,
  onMove, onRotate, onStandUpright, onDelete, onMoveToPallet, onSave, onClose,
}: Props) {
  const currentPallet = pallets[selectedPalletIdx];
  const selectedBoxes = currentPallet?.boxes.filter((b) => selectedBoxIds.includes(b.box_id)) ?? [];
  const firstBox: BoxResult | null = selectedBoxes[0] ?? null;
  const isGroup = selectedBoxes.length > 1;

  const invalidSet = new Set(validation?.invalidBoxIds ?? []);
  const hasErrors = validation && validation.errors.length > 0;

  const step = settings.snap_grid_mm;
  const setSensitivity = (drag_sensitivity: number) => {
    onSettingsChange({ ...settings, drag_sensitivity });
  };

  return (
    <div className="w-68 bg-white border-l border-gray-200 flex flex-col h-full overflow-hidden shadow-xl z-20" style={{ minWidth: 260 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div>
          <span className="font-semibold text-sm text-gray-800">Selected</span>
          {selectedBoxes.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              {isGroup ? `${selectedBoxes.length} boxes` : firstBox?.box_id}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none font-bold">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Validation summary */}
        {validation && (
          <div className="px-4 pt-3 space-y-2">
            {validation.errors.length > 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 space-y-0.5">
                <div className="font-semibold">Errors ({validation.errors.length})</div>
                {validation.errors.slice(0, 4).map((e, i) => <p key={i}>{e}</p>)}
                {validation.errors.length > 4 && <p>+{validation.errors.length - 4} more</p>}
              </div>
            )}
            {validation.warnings.length > 0 && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 space-y-0.5">
                <div className="font-semibold">Warnings ({validation.warnings.length})</div>
                {validation.warnings.slice(0, 3).map((w, i) => <p key={i}>{w}</p>)}
                {validation.warnings.length > 3 && <p>+{validation.warnings.length - 3} more</p>}
              </div>
            )}
            {!hasErrors && validation.errors.length === 0 && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700 font-medium">
                Layout valid ✓
              </div>
            )}
          </div>
        )}

        <div className="px-4 pt-3">
          <div className="text-xs font-medium text-gray-600 mb-2">Drag sensitivity</div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: "Slow", value: 0.2 },
              { label: "Normal", value: 0.35 },
              { label: "Fast", value: 0.7 },
            ].map((option) => (
              <ActionBtn
                key={option.value}
                onClick={() => setSensitivity(option.value)}
                variant={settings.drag_sensitivity === option.value ? "primary" : "default"}
              >
                {option.label}
              </ActionBtn>
            ))}
          </div>
        </div>

        {selectedBoxes.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400">
            Click a box to select it.<br />
            Use &quot;Select Same SKU&quot; in the toolbar for group selection.
          </div>
        ) : (
          <div className="px-4 pt-3 pb-2 space-y-3">
            {/* Box info */}
            <div className={clsx(
              "rounded-lg border p-3",
              selectedBoxes.some(b => invalidSet.has(b.box_id))
                ? "border-red-300 bg-red-50"
                : "border-blue-200 bg-blue-50",
            )}>
              {isGroup ? (
                <div className="text-xs font-medium text-gray-700">
                  Group: {Array.from(new Set(selectedBoxes.map(b => b.sku))).join(", ")}
                  <span className="ml-2 text-gray-400">({selectedBoxes.length} boxes)</span>
                </div>
              ) : firstBox && (
                <div className="space-y-0.5">
                  <Row label="SKU" value={firstBox.sku} />
                  <Row label="Lot No." value={firstBox.lot_no} />
                  <Row label="Pallet" value={`Pallet ${currentPallet?.pallet_no}`} />
                  <Row label="L×W×H" value={`${firstBox.length_mm}×${firstBox.width_mm}×${firstBox.height_mm}`} />
                  <Row label="Weight" value={`${firstBox.weight_kg} kg`} />
                  <Row label="Rotation" value={firstBox.rotation} />
                  <Row label="Layer" value={firstBox.layer} />
                  <Row label="Position" value={`(${firstBox.x_mm}, ${firstBox.y_mm}, ${firstBox.z_mm})`} />
                  <div className="flex gap-1 flex-wrap mt-1">
                    {firstBox.stand_upright_only && <Badge label="UPRIGHT ONLY" color="amber" />}
                    {firstBox.no_load_on_top && <Badge label="NO LOAD ON TOP" color="red" />}
                    {invalidSet.has(firstBox.box_id) && <Badge label="INVALID" color="red" />}
                  </div>
                </div>
              )}
            </div>

            {/* Move controls */}
            <div>
              <div className="text-xs font-medium text-gray-600 mb-2">Move ({step}mm steps)</div>
              <div className="grid grid-cols-3 gap-1">
                <ActionBtn onClick={() => onMove(selectedBoxIds, selectedPalletIdx, -step, 0, 0)}>← X</ActionBtn>
                <ActionBtn onClick={() => onMove(selectedBoxIds, selectedPalletIdx, 0, -step, 0)}>← Y</ActionBtn>
                <ActionBtn onClick={() => onMove(selectedBoxIds, selectedPalletIdx, 0, 0, step)}>↑ Z</ActionBtn>
                <ActionBtn onClick={() => onMove(selectedBoxIds, selectedPalletIdx, step, 0, 0)}>X →</ActionBtn>
                <ActionBtn onClick={() => onMove(selectedBoxIds, selectedPalletIdx, 0, step, 0)}>Y →</ActionBtn>
                <ActionBtn onClick={() => onMove(selectedBoxIds, selectedPalletIdx, 0, 0, -step)}>↓ Z</ActionBtn>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-1">
              <ActionBtn
                onClick={() => onRotate(selectedBoxIds, selectedPalletIdx)}
                disabled={firstBox?.stand_upright_only && selectedBoxes.length === 1 && isGroup === false}
              >
                Rotate 90°
              </ActionBtn>
              {!isGroup && firstBox && (
                <ActionBtn onClick={() => onStandUpright(firstBox.box_id, selectedPalletIdx)}>
                  Stand Upright
                </ActionBtn>
              )}
              {pallets.length > 1 && pallets.map((p, idx) => {
                if (idx === selectedPalletIdx) return null;
                return (
                  <ActionBtn key={idx}
                    onClick={() => onMoveToPallet(selectedBoxIds, selectedPalletIdx, idx)}>
                    → Pallet {p.pallet_no}
                  </ActionBtn>
                );
              })}
              <ActionBtn variant="danger" onClick={() => onDelete(selectedBoxIds, selectedPalletIdx)}>
                {isGroup ? `Delete ${selectedBoxes.length}` : "Delete Box"}
              </ActionBtn>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={onSave} disabled={isSaving}
          className="w-full py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white transition-colors"
        >
          {isSaving ? "Saving…" : "Save Adjusted Layout"}
        </button>
      </div>
    </div>
  );
}
