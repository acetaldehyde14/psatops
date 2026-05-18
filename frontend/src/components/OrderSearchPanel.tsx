"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { getOptimisationByOrderId } from "@/lib/api";

export default function OrderSearchPanel() {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = orderId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const optimisation = await getOptimisationByOrderId(trimmed);
      router.push(`/results/${optimisation.job_id}`);
    } catch {
      setError(`No completed optimisation found for ${trimmed}.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8 border border-slate-200 bg-white p-5 shadow-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-sm font-medium text-slate-700">Find optimisation by order ID</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              placeholder="ORDER-001"
              className="h-11 w-full border border-slate-300 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white"
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={loading || !orderId.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
        >
          {loading ? "Searching" : "Open"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
