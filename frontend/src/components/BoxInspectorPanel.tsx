import type { BoxResult } from "@/lib/types";

interface Props {
  box: BoxResult | null;
  onClose: () => void;
}

export default function BoxInspectorPanel({ box, onClose }: Props) {
  if (!box) return null;
  const rows: [string, string | number | undefined][] = [
    ["Box ID", box.box_id],
    ["SKU", box.sku],
    ["Lot No.", box.lot_no],
    ["Position (x,y,z)", `${box.x_mm}, ${box.y_mm}, ${box.z_mm} mm`],
    ["Dimensions (L×W×H)", `${box.length_mm}×${box.width_mm}×${box.height_mm} mm`],
    ["Weight", `${box.weight_kg} kg`],
    ["Rotation", box.rotation],
    ["Layer", box.layer],
    ["Pick Seq.", box.pick_sequence],
    ["Location", box.location],
    ["Expiry", box.expiry_date],
  ];
  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 bg-white border-l border-gray-200 shadow-xl z-10 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-sm">Box Details</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg font-bold">
          ×
        </button>
      </div>
      <div className="p-4 space-y-2">
        {rows.map(([label, val]) =>
          val !== undefined && val !== null && val !== "" ? (
            <div key={label}>
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-sm font-medium text-gray-900">{String(val)}</div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
