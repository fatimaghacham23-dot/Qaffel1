"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, PackageCheck } from "lucide-react";

const steps = [
  "Collecting workspace records",
  "Applying filters and date range",
  "Checking export row safety",
  "Preparing downloadable bundle"
];

export function ExportPreparationPanel({ totalRows }: { totalRows: number }) {
  const [isPreparing, setIsPreparing] = useState(false);
  const [active, setActive] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!isPreparing) return;
    const timers = steps.map((_, index) =>
      window.setTimeout(() => {
        setActive(index);
        if (index === steps.length - 1) {
          setComplete(true);
          setIsPreparing(false);
        }
      }, 260 + index * 420)
    );
    return () => timers.forEach(window.clearTimeout);
  }, [isPreparing]);

  return (
    <section className="q-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="q-section-label">Manual preparation</p>
          <h2 className="q-title-sm mt-1">Scheduled export preparation</h2>
          <p className="q-body-muted mt-1 max-w-2xl">
            Prepare the current export bundle on demand. Qaffel does not email, schedule, or send anything automatically.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={() => {
            setComplete(false);
            setActive(0);
            setIsPreparing(true);
          }}
          disabled={isPreparing}
        >
          {isPreparing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <PackageCheck className="h-4 w-4" aria-hidden />}
          Prepare bundle
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
          <span>{totalRows.toLocaleString()} rows available across export datasets</span>
          <span>{complete ? "Ready" : isPreparing ? "Preparing" : "Idle"}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {steps.map((step, index) => {
            const done = complete || (isPreparing && index <= active);
            return (
              <div key={step} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`grid h-5 w-5 place-items-center rounded-full ${done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : index + 1}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-700">{step}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
