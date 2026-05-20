import type { SummaryResult } from "@/lib/types";
import clsx from "clsx";

interface Props {
  summary: SummaryResult;
  onStabilityClick?: () => void;
}

function Card({
  label,
  value,
  sub,
  warn,
  clickable,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  warn?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={(event) => {
        if (!clickable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className={clsx(
        "min-h-[92px] min-w-0 overflow-hidden rounded-xl border bg-white px-4 py-3 shadow-sm transition-colors",
        warn ? "border-red-300" : "border-slate-200",
        clickable && "cursor-pointer hover:border-red-400 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
      )}
    >
      <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={clsx(
          "mt-2 whitespace-nowrap text-2xl font-bold leading-none",
          warn ? "text-red-600" : "text-slate-900"
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 truncate text-xs leading-tight text-slate-400">{sub}</div>}
    </div>
  );
}

export default function ResultSummaryCards({ summary, onStabilityClick }: Props) {
  const hasBoxWarnings = summary.floating_boxes > 0 || summary.unstable_boxes > 0;
  const cgIssues = (summary.stability_issues ?? []).filter((i) => i.type === "cg_offset");
  const cgErrors   = cgIssues.filter((i) => i.severity === "error").length;
  const cgWarnings = cgIssues.filter((i) => i.severity === "warning").length;
  const hasCgIssues = cgIssues.length > 0;
  const hasWarnings = hasBoxWarnings || hasCgIssues;
  const centerCount = Object.keys(summary.center_totals ?? {}).length;

  let stabilityValue: string;
  let stabilitySub: string;
  if (!hasWarnings) {
    stabilityValue = "OK";
    stabilitySub = "No warnings";
  } else {
    const parts: string[] = [];
    if (summary.floating_boxes > 0) parts.push(`${summary.floating_boxes} floating`);
    if (summary.unstable_boxes > 0) parts.push(`${summary.unstable_boxes} unstable`);
    if (cgErrors > 0) parts.push(`${cgErrors} CG error${cgErrors > 1 ? "s" : ""}`);
    else if (cgWarnings > 0) parts.push(`${cgWarnings} CG warn`);
    stabilityValue = `${summary.floating_boxes + summary.unstable_boxes + cgIssues.length} issues`;
    stabilitySub = parts.join(", ");
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Card label="Pallets" value={summary.pallets_used} sub="used" />
      <Card
        label="Volume"
        value={`${summary.average_volume_utilisation_pct.toFixed(1)}%`}
        sub={`Area: ${summary.average_area_utilisation_pct.toFixed(1)}%`}
      />
      <Card label="Boxes" value={summary.total_boxes} sub="total" />
      <Card
        label="Centers"
        value={centerCount}
        sub={`${Object.values(summary.center_totals ?? {}).reduce((sum, center) => sum + center.expanded_cartons, 0)} cartons`}
      />
      <Card
        label="Weight"
        value={`${summary.total_weight_kg.toFixed(1)} kg`}
        sub="kg total"
      />
      <Card
        label="Stability"
        value={stabilityValue}
        sub={stabilitySub}
        warn={hasWarnings}
        clickable={hasWarnings}
        onClick={onStabilityClick}
      />
    </div>
  );
}
