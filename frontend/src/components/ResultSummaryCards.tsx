import type { SummaryResult } from "@/lib/types";
import clsx from "clsx";

interface Props {
  summary: SummaryResult;
}

function Card({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string | number;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={clsx(
        "bg-white rounded-xl border p-5 flex flex-col gap-1 shadow-sm",
        warn ? "border-red-300" : "border-gray-200"
      )}
    >
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {label}
      </span>
      <span
        className={clsx(
          "text-3xl font-bold",
          warn ? "text-red-600" : "text-gray-900"
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

export default function ResultSummaryCards({ summary }: Props) {
  const hasWarnings =
    summary.floating_boxes > 0 || summary.unstable_boxes > 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      <Card label="Pallets Used" value={summary.pallets_used} />
      <Card
        label="Vol. Utilisation"
        value={`${summary.average_volume_utilisation_pct.toFixed(1)}%`}
        sub={`Area: ${summary.average_area_utilisation_pct.toFixed(1)}%`}
      />
      <Card label="Total Boxes" value={summary.total_boxes} />
      <Card
        label="Total Weight"
        value={`${summary.total_weight_kg.toFixed(1)} kg`}
      />
      <Card
        label="Stability"
        value={hasWarnings ? `${summary.floating_boxes + summary.unstable_boxes} issues` : "OK"}
        sub={hasWarnings ? `${summary.floating_boxes} floating, ${summary.unstable_boxes} unstable` : "No warnings"}
        warn={hasWarnings}
      />
    </div>
  );
}
