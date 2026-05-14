import { Check } from "lucide-react";
import type { PublicPaymentTimelineStep } from "@/lib/public-payment-copy";
import { cn } from "@/lib/utils";

export function PayStatusExperience({
  headline,
  subline,
  steps,
  depositFraction
}: {
  headline: string;
  subline: string;
  steps: PublicPaymentTimelineStep[];
  depositFraction?: number | null;
}) {
  const pct = depositFraction != null && Number.isFinite(depositFraction) ? Math.round(Math.min(100, Math.max(0, depositFraction * 100))) : null;

  return (
    <section className="q-surface p-4 sm:p-5" aria-labelledby="pay-status-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p id="pay-status-heading" className="q-section-label">
            Payment status
          </p>
          <h2 className="mt-1 text-lg font-bold text-ink sm:text-xl">{headline}</h2>
          <p className="mt-1 max-w-prose text-sm text-slate-600">{subline}</p>
        </div>
      </div>

      {pct != null ? (
        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-sky-950">
            <span>Deposit progress on record</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
            <div className="h-full rounded-full bg-sky-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold",
                  step.done
                    ? "bg-emerald-600 text-white shadow-sm motion-safe:animate-q-success-pop"
                    : step.current
                      ? "bg-cedar text-white shadow-sm ring-4 ring-cedar/10"
                      : "border border-slate-200 bg-white text-slate-500"
                )}
                aria-current={step.current ? "step" : undefined}
              >
                {step.done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>
              {index < steps.length - 1 ? <span className="mt-1 min-h-[12px] w-px flex-1 bg-slate-200" aria-hidden /> : null}
            </div>
            <div className="min-w-0 pb-1 pt-0.5">
              <p className={cn("text-sm font-semibold", step.done ? "text-emerald-900" : step.current ? "text-ink" : "text-slate-700")}>{step.label}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
