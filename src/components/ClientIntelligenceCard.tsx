import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import { safeDays } from "@/lib/safe-metrics";
import type { ClientIntelligence } from "@/lib/intelligence-layer";

export function ClientIntelligenceCard({ intel }: { intel: ClientIntelligence }) {
  const Trend =
    intel.reliabilityTrend === "improving"
      ? TrendingUp
      : intel.reliabilityTrend === "worsening"
        ? TrendingDown
        : Minus;

  return (
    <section className="panel border-sky-100 bg-gradient-to-br from-sky-50/80 to-white">
      <h2 className="text-lg font-bold text-ink">Client intelligence</h2>
      <p className="mt-1 text-xs text-slate-600">Computed from this client&apos;s invoices and proofs only.</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-500">Lifetime billed</dt>
          <dd className="mt-1 text-lg font-bold text-ink">{money(intel.lifetimeBilledPrimary, intel.primaryCurrency)}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-500">Lifetime paid (accepted)</dt>
          <dd className="mt-1 text-lg font-bold text-ink">{money(intel.lifetimePaidPrimary, intel.primaryCurrency)}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-500">Avg payment speed vs due</dt>
          <dd className="mt-1 font-semibold text-ink">
            {safeDays(intel.averagePaymentSpeedDays, 1)}
          </dd>
          <p className="mt-1 text-[10px] text-slate-500">Negative = before due date</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-500">Overdue invoices now</dt>
          <dd className="mt-1 text-lg font-bold text-ink">{intel.overdueInvoiceCount}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-500">Preferred method</dt>
          <dd className="mt-1 font-semibold text-ink">{intel.preferredMethod ?? "—"}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <dt className="text-[10px] font-bold uppercase text-slate-500">Last interaction</dt>
          <dd className="mt-1 font-semibold text-ink">
            {intel.lastInteractionAt ? shortDate(intel.lastInteractionAt) : "—"}
          </dd>
          {intel.lastInteractionLabel ? (
            <p className="mt-1 text-[10px] text-slate-500">{intel.lastInteractionLabel}</p>
          ) : null}
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/80 p-3">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-500">Reliability score</p>
          <p className="text-2xl font-black text-ink">{intel.reliabilityScore}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Trend className="h-4 w-4" aria-hidden />
          <span className="capitalize">{intel.reliabilityTrend}</span>
        </div>
        <p className="min-w-[200px] flex-1 text-[11px] text-slate-600">
          Simple index from on-time paid share vs late payments and current overdue count — not a prediction.
        </p>
      </div>
    </section>
  );
}
