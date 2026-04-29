"use client";
import type { Constraints, PalletSpec, AlgorithmType } from "@/lib/types";

interface Props {
  pallet: PalletSpec;
  constraints: Constraints;
  algorithm: AlgorithmType;
  onPalletChange: (p: PalletSpec) => void;
  onConstraintsChange: (c: Constraints) => void;
  onAlgorithmChange: (a: AlgorithmType) => void;
}

const ALGORITHMS: AlgorithmType[] = ["FIRST_FIT", "BEST_FIT", "EXTREME_POINT", "GENETIC", "AUTO"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-blue-600" />
      {label}
    </label>
  );
}

export default function ConstraintForm({
  pallet, constraints, algorithm,
  onPalletChange, onConstraintsChange, onAlgorithmChange,
}: Props) {
  const upP = (k: keyof PalletSpec, v: number) => onPalletChange({ ...pallet, [k]: v });
  const upC = (k: keyof Constraints, v: boolean | string) => onConstraintsChange({ ...constraints, [k]: v });

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold text-sm text-gray-700 mb-3">Pallet Dimensions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Length (mm)"><NumInput value={pallet.length_mm} onChange={(v) => upP("length_mm", v)} /></Field>
          <Field label="Width (mm)"><NumInput value={pallet.width_mm} onChange={(v) => upP("width_mm", v)} /></Field>
          <Field label="Max Height (mm)"><NumInput value={pallet.max_height_mm} onChange={(v) => upP("max_height_mm", v)} /></Field>
          <Field label="Max Weight (kg)"><NumInput value={pallet.max_weight_kg} onChange={(v) => upP("max_weight_kg", v)} /></Field>
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-sm text-gray-700 mb-3">Algorithm</h3>
        <select
          value={algorithm}
          onChange={(e) => onAlgorithmChange(e.target.value as AlgorithmType)}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          {ALGORITHMS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </section>

      <section>
        <h3 className="font-semibold text-sm text-gray-700 mb-3">Constraints</h3>
        <div className="space-y-2">
          <Toggle checked={constraints.allow_rotation} onChange={(v) => upC("allow_rotation", v)} label="Allow rotation" />
          <Toggle checked={constraints.mix_products} onChange={(v) => upC("mix_products", v)} label="Mix products on pallet" />
          <Toggle checked={constraints.respect_fefo} onChange={(v) => upC("respect_fefo", v)} label="Respect FEFO (expiry date)" />
          <Toggle checked={constraints.respect_delivery_date} onChange={(v) => upC("respect_delivery_date", v)} label="Group by delivery date" />
          <Toggle checked={constraints.prefer_partial_pallets} onChange={(v) => upC("prefer_partial_pallets", v)} label="Prefer partial pallets first" />
          <Toggle checked={constraints.prefer_location_cluster} onChange={(v) => upC("prefer_location_cluster", v)} label="Prefer location cluster" />
        </div>
      </section>
    </div>
  );
}
