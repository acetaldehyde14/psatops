"use client";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";

interface Props {
  title?: string;
  diagnostics: ReactNode;
  defaultOpen?: boolean;
  mismatchCount?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CollapsibleDiagnosticsPanel({
  title = "Data Trace / Diagnostics",
  diagnostics,
  defaultOpen = false,
  mismatchCount = 0,
  open,
  onOpenChange,
}: Props) {
  const isOpen = open ?? defaultOpen;
  const hasIssues = mismatchCount > 0;

  return (
    <section className={clsx(
      "border-b text-xs flex-shrink-0",
      hasIssues ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-700",
    )}>
      <button
        type="button"
        onClick={() => onOpenChange?.(!isOpen)}
        className="w-full px-6 h-10 flex items-center gap-2 text-left hover:bg-black/[0.03]"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="font-semibold">{title}</span>
        <span className={clsx(
          "ml-auto rounded px-2 py-0.5 text-[11px] font-semibold",
          hasIssues ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700",
        )}>
          {hasIssues ? `${mismatchCount} issue${mismatchCount === 1 ? "" : "s"}` : "OK"}
        </span>
      </button>
      {isOpen && (
        <div className="px-6 pb-3 max-h-64 overflow-y-auto">
          {diagnostics}
        </div>
      )}
    </section>
  );
}
