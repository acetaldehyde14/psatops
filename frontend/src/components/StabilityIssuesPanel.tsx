import type { StabilityIssue } from "@/lib/types";
import clsx from "clsx";

interface Props {
  issues: StabilityIssue[];
  selectedIssueId?: string;
  onIssueClick: (issue: StabilityIssue) => void;
}

function issueId(issue: StabilityIssue, index: number): string {
  return issue.id ?? `${issue.type}-${issue.box_id ?? "layout"}-${issue.pallet_no ?? "p"}-${index}`;
}

export default function StabilityIssuesPanel({ issues, selectedIssueId, onIssueClick }: Props) {
  if (issues.length === 0) return null;

  return (
    <div className="w-72 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-orange-50">
        <div className="text-sm font-semibold text-gray-900">Stability Issues</div>
        <div className="text-xs text-orange-700">{issues.length} affected box{issues.length === 1 ? "" : "es"}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {issues.map((issue, index) => {
          const id = issueId(issue, index);
          const selected = selectedIssueId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onIssueClick({ ...issue, id })}
              className={clsx(
                "w-full text-left rounded-lg border p-3 transition-colors",
                selected
                  ? "border-red-300 bg-red-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase text-gray-700">{issue.type}</span>
                <span className={clsx(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase",
                  issue.severity === "error"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : "bg-amber-100 text-amber-700 border-amber-200",
                )}>
                  {issue.severity}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <span className="text-gray-500">Box</span>
                <span className="font-medium text-gray-900 truncate">{issue.box_id ?? "Layout"}</span>
                {issue.sku && (
                  <>
                    <span className="text-gray-500">SKU</span>
                    <span className="font-medium text-gray-900 truncate">{issue.sku}</span>
                  </>
                )}
                {issue.pallet_no !== undefined && (
                  <>
                    <span className="text-gray-500">Pallet</span>
                    <span className="font-medium text-gray-900">Pallet {issue.pallet_no}</span>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-600 leading-snug">{issue.message}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
