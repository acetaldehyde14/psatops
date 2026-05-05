"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { WarningItem } from "@/lib/types";

interface Props {
  warnings: Array<WarningItem | string>;
  storageKey?: string;
  jobId?: string;
}

function normaliseWarning(warning: WarningItem | string, index: number): WarningItem {
  if (typeof warning !== "string") {
    return {
      ...warning,
      dismissible: warning.dismissible || warning.type === "small_dimension",
    };
  }
  const smallDimension = warning.includes("has very small dimension");
  const sku = warning.match(/^SKU\s+(.+?)\s+has very small dimension/)?.[1];
  return {
    id: smallDimension ? `small_dimension:${sku ?? "unknown"}:${warning}` : `warning:${index}:${warning}`,
    type: smallDimension ? "small_dimension" : undefined,
    sku,
    message: warning,
    dismissible: smallDimension,
  };
}

function isSmallDimensionWarning(warning: WarningItem): boolean {
  const message = warning.message.toLowerCase();
  return warning.type === "small_dimension"
    || message.includes("very small dimension")
    || message.includes("small dimension");
}

function isCriticalWarning(warning: WarningItem): boolean {
  const message = warning.message.toLowerCase();
  return warning.type === "stability"
    || warning.type === "overlap"
    || warning.type === "floating"
    || warning.type === "out_of_bounds"
    || warning.type === "validation_error"
    || message.includes("floating")
    || message.includes("overlap")
    || message.includes("out of bounds")
    || message.includes("outside pallet")
    || message.includes("validation");
}

export default function WarningsPanel({ warnings, storageKey, jobId }: Props) {
  const [dismissedWarningIds, setDismissedWarningIds] = useState<Set<string>>(new Set());
  const [warningsHidden, setWarningsHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hiddenStorageKey = jobId ? `palletisation:warningsHidden:${jobId}` : undefined;

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setDismissedWarningIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {
      setDismissedWarningIds(new Set());
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hiddenStorageKey || typeof window === "undefined") return;
    setWarningsHidden(window.localStorage.getItem(hiddenStorageKey) === "true");
  }, [hiddenStorageKey]);

  const items = useMemo(
    () => warnings.map((warning, index) => normaliseWarning(warning, index)),
    [warnings],
  );
  const visibleWarnings = items.filter((warning) => !dismissedWarningIds.has(warning.id));
  const visibleCritical = visibleWarnings.filter(isCriticalWarning);
  const visibleGeneral = visibleWarnings.filter((warning) => !isCriticalWarning(warning));
  const visibleSmallDimension = visibleGeneral.filter(isSmallDimensionWarning);
  const dismissedCount = items.length - visibleWarnings.length;

  function saveDismissed(next: Set<string>) {
    setDismissedWarningIds(next);
    if (storageKey && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
    }
  }

  function dismiss(id: string) {
    const next = new Set(dismissedWarningIds);
    next.add(id);
    saveDismissed(next);
  }

  function dismissAllSmallDimensions() {
    const next = new Set(dismissedWarningIds);
    for (const warning of visibleSmallDimension) next.add(warning.id);
    saveDismissed(next);
  }

  function resetDismissed() {
    saveDismissed(new Set());
  }

  function setHidden(next: boolean) {
    setWarningsHidden(next);
    if (hiddenStorageKey && typeof window !== "undefined") {
      if (next) window.localStorage.setItem(hiddenStorageKey, "true");
      else window.localStorage.removeItem(hiddenStorageKey);
    }
  }

  if (items.length === 0 || visibleWarnings.length === 0 && dismissedCount === 0) return null;
  const previewWarnings = visibleGeneral.slice(0, 3);
  const expandedWarnings = visibleGeneral;

  if (warningsHidden) {
    return (
      <section className="border-b border-slate-200 bg-slate-50 px-6 py-2 text-xs text-slate-600 flex-shrink-0">
        {visibleCritical.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 text-red-700">
            <span className="font-semibold py-1">Critical issues</span>
            {visibleCritical.slice(0, 4).map((warning) => (
              <span key={warning.id} className="rounded border border-red-200 bg-white px-2 py-1">
                {warning.message}
              </span>
            ))}
            {visibleCritical.length > 4 && <span className="py-1">+{visibleCritical.length - 4} more</span>}
          </div>
        )}
        <span>Warnings hidden</span>
        <button
          type="button"
          onClick={() => setHidden(false)}
          className="ml-2 font-semibold text-slate-900 underline"
        >
          Show
        </button>
      </section>
    );
  }

  return (
    <section className="border-b border-yellow-200 bg-yellow-50 text-xs text-yellow-900 flex-shrink-0">
      {visibleCritical.length > 0 && (
        <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-red-700">
          <div className="flex flex-wrap gap-2">
            <span className="font-semibold py-1">Critical issues</span>
            {visibleCritical.slice(0, 4).map((warning) => (
              <span key={warning.id} className="rounded border border-red-200 bg-white/80 px-2 py-1">
                {warning.message}
              </span>
            ))}
            {visibleCritical.length > 4 && <span className="py-1">+{visibleCritical.length - 4} more</span>}
          </div>
        </div>
      )}
      <div className="px-6 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">Warnings</span>
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold">{visibleGeneral.length}</span>
          {visibleGeneral.length > 0 && (
            <button
              type="button"
              onClick={() => setHidden(true)}
              className="rounded border border-yellow-300 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-yellow-100"
            >
              Hide warnings
            </button>
          )}
          {visibleSmallDimension.length > 0 && (
            <button
              type="button"
              onClick={dismissAllSmallDimensions}
              className="rounded border border-yellow-300 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-yellow-100"
            >
              Dismiss all small-size warnings
            </button>
          )}
          {visibleGeneral.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex items-center gap-1 rounded border border-yellow-300 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-yellow-100"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Hide" : `Show all (+${visibleGeneral.length - 3} more)`}
            </button>
          )}
          {dismissedCount > 0 && (
            <button
              type="button"
              onClick={resetDismissed}
              className="text-[11px] font-semibold underline"
            >
              Reset dismissed warnings
            </button>
          )}
          {visibleGeneral.length === 0 && dismissedCount > 0 && (
            <span>{dismissedCount} warning{dismissedCount === 1 ? "" : "s"} dismissed.</span>
          )}
        </div>

        {visibleGeneral.length > 0 && (
          <div className={expanded ? "mt-2 max-h-40 overflow-y-auto pr-1" : "mt-2"}>
            <div className="flex flex-wrap gap-2">
              {(expanded ? expandedWarnings : previewWarnings).map((warning) => (
                <div key={warning.id} className="flex items-center gap-2 rounded border border-yellow-200 bg-white/70 px-2 py-1">
                  <span>{warning.message}</span>
                  {warning.dismissible && (
                    <button
                      type="button"
                      onClick={() => dismiss(warning.id)}
                      className="rounded p-0.5 text-yellow-700 hover:bg-yellow-100"
                      aria-label="Dismiss warning"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
