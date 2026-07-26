"use client";

import Link from "next/link";
import { BarChart3, Filter, Lightbulb, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { money } from "@/lib/format";
import type { IntelligenceBundle } from "@/lib/intelligence-layer";
import { finiteN, safeDays, safeDaysFromHours, safeHours, safePercent } from "@/lib/safe-metrics";
import { IntelligenceRevenueTrendChart } from "@/components/IntelligenceRevenueTrendChart";
import { IntelligenceStackedMethodsChart } from "@/components/IntelligenceStackedMethodsChart";

function TrendIcon({ dir }: { dir: IntelligenceBundle["revenue"]["revenueTrend"] }) {
  if (dir === "up") return <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />;
  if (dir === "down") return <TrendingDown className="h-4 w-4 text-red-600" aria-hidden />;
  if (dir === "flat") return <Minus className="h-4 w-4 text-slate-500" aria-hidden />;
  return <BarChart3 className="h-4 w-4 text-slate-400" aria-hidden />;
}

export function DashboardIntelligenceSection({ bundle }: { bundle: IntelligenceBundle }) {
  const { revenue, paymentMethods, invoicePerformance, reminders, momentum, recommendations } = bundle;
  const trustedPick = [...paymentMethods]
    .filter((m) => m.accepted >= 3 && m.trustedRatio !== null)
    .sort((a, b) => (b.trustedRatio || 0) - (a.trustedRatio || 0))[0];
  const fastestPick = [...paymentMethods]
    .filter((m) => m.medianReviewHours !== null && m.accepted >= 3)
    .sort((a, b) => (a.medianReviewHours || 9999) - (b.medianReviewHours || 9999))[0];

  return (
    <section className="mb-6 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cedar">Qaffel intelligence</p>
          <h2 className="text-xl font-bold tracking-tight text-ink">Business intelligence</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Derived from your invoices, proofs, and activity log only — not predictions or AI-generated advice.
          </p>
        </div>
        <Link
          href="/intelligence/deep"
          className="btn btn-secondary inline-flex touch-manipulation items-center gap-2 self-start text-xs"
        >
          <Filter className="h-3.5 w-3.5" aria-hidden />
          Deep filters
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Best earning month</p>
          <p className="mt-2 text-lg font-bold text-ink">{revenue.bestEarningMonthLabel ?? "—"}</p>
          <p className="text-sm font-semibold text-cedar">
            {money(finiteN(revenue.bestEarningMonthUsd), "USD")} collected (approx. USD equivalent)
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Avg invoice (approx. USD)</p>
          <p className="mt-2 text-lg font-bold text-ink">
            {revenue.averageInvoiceUsd !== null ? money(finiteN(revenue.averageInvoiceUsd), "USD") : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Avg payment delay</p>
          <p className="mt-2 text-lg font-bold text-ink">
            {safeDays(revenue.averagePaymentDelayDays, 1)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">First accepted proof vs invoice created</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Revenue trend</p>
            <TrendIcon dir={revenue.revenueTrend} />
          </div>
          <p className="mt-2 text-sm font-semibold capitalize text-ink">{revenue.revenueTrend.replace(/_/g, " ")}</p>
          <p className="mt-1 text-[11px] text-slate-500">Last 3 vs prior 3 months collected (approx. USD equivalent)</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Collected / billed</p>
          <p className="mt-2 text-lg font-bold text-ink">
            {safePercent(revenue.collectedVsBilledRatio)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Accepted proof ÷ billed totals (approx. USD equivalent, all time)</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Deposit → paid rate</p>
          <p className="mt-2 text-lg font-bold text-ink">
            {safePercent(revenue.depositConversionRate)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Share of deposit-enabled invoices marked paid</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IntelligenceRevenueTrendChart revenue={revenue} />
        <IntelligenceStackedMethodsChart data={bundle.paymentMethodCurrencyCharts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <h3 className="text-sm font-bold text-ink">Payment behavior by method</h3>
          <p className="mt-1 text-xs text-slate-500">Trust ratio = accepted ÷ (accepted + rejected + voided) with that method label.</p>
          {trustedPick ? (
            <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] text-slate-800">
              <span className="font-semibold">Most trusted (by acceptance rate):</span> {trustedPick.method} at{" "}
              {safePercent(trustedPick.trustedRatio)} across{" "}
              {trustedPick.accepted + trustedPick.rejected + trustedPick.voided} outcomes.
            </p>
          ) : null}
          {fastestPick && fastestPick.medianReviewHours !== null ? (
            <p className="mt-1 rounded-lg bg-emerald-50/80 px-2 py-1.5 text-[11px] text-emerald-950">
              <span className="font-semibold">Fastest median review:</span> {fastestPick.method} ·{" "}
              {fastestPick.medianReviewHours !== null && fastestPick.medianReviewHours < 48
                ? safeHours(fastestPick.medianReviewHours)
                : safeDaysFromHours(fastestPick.medianReviewHours)}{" "}
              upload → confirm
            </p>
          ) : null}
          <div className="mt-3 max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
                  <th className="py-2 pr-2">Method</th>
                  <th className="py-2 pr-2">Trusted</th>
                  <th className="py-2 pr-2">Median review</th>
                  <th className="py-2">R / V</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.slice(0, 12).map((m) => (
                  <tr key={m.method} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-ink">{m.method}</td>
                    <td className="py-2 text-slate-700">
                      {safePercent(m.trustedRatio)}
                    </td>
                    <td className="py-2 text-slate-600">
                      {m.medianReviewHours !== null
                        ? m.medianReviewHours < 48
                          ? safeHours(m.medianReviewHours)
                          : safeDaysFromHours(m.medianReviewHours)
                        : "—"}
                    </td>
                    <td className="py-2 text-slate-600">
                      {m.rejected}/{m.voided}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <h3 className="text-sm font-bold text-ink">Invoice performance</h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            <li className="flex justify-between gap-2 border-b border-slate-50 pb-2">
              <span>Deposit vs none (paid / total)</span>
              <span className="font-semibold text-ink">
                {invoicePerformance.withDeposit.paid}/{invoicePerformance.withDeposit.total} vs{" "}
                {invoicePerformance.withoutDeposit.paid}/{invoicePerformance.withoutDeposit.total}
              </span>
            </li>
            <li className="flex justify-between gap-2 border-b border-slate-50 pb-2">
              <span>Quotes · Invoices</span>
              <span className="font-semibold">{invoicePerformance.quotes} · {invoicePerformance.invoices}</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-slate-50 pb-2">
              <span>Approval path vs direct</span>
              <span className="font-semibold">
                {invoicePerformance.approvalRequired.paid}/{invoicePerformance.approvalRequired.total} vs{" "}
                {invoicePerformance.directPay.paid}/{invoicePerformance.directPay.total}
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Short vs long validity (paid / total)</span>
              <span className="font-semibold">
                {invoicePerformance.shortValidity.paid}/{invoicePerformance.shortValidity.total} vs{" "}
                {invoicePerformance.longValidity.paid}/{invoicePerformance.longValidity.total}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <h3 className="text-sm font-bold text-ink">Reminder effectiveness</h3>
          <p className="mt-1 text-xs text-slate-500">From timeline events you log when copying reminders.</p>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Reminders logged</dt>
              <dd className="font-bold">{reminders.remindersLogged}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Followed by a payment event</dt>
              <dd className="font-bold">{reminders.remindersBeforePayment}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Median days to payment</dt>
              <dd className="font-bold">
                {reminders.medianDaysReminderToPayment !== null && Number.isFinite(reminders.medianDaysReminderToPayment)
                  ? reminders.medianDaysReminderToPayment.toFixed(1)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">WhatsApp reminders</dt>
              <dd className="font-bold">{reminders.whatsappReminders}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">WhatsApp → paid within 14d</dt>
              <dd className="font-bold">{reminders.whatsappThenPaidWithin14d}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <h3 className="text-sm font-bold text-ink">Momentum</h3>
          <p className="mt-1 text-xs font-semibold text-ink">{momentum.paymentVelocityLabel}</p>
          {momentum.paymentVelocityDetail ? <p className="mt-1 text-xs text-slate-600">{momentum.paymentVelocityDetail}</p> : null}
          <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Collected last 30d (approx. USD)</dt>
              <dd className="font-bold">{money(finiteN(momentum.collectionVelocityUsdLast30), "USD")}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Prior 30d</dt>
              <dd className="font-bold">{money(finiteN(momentum.collectionVelocityUsdPrior30), "USD")}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Outstanding delta (proxy)</dt>
              <dd className="font-bold">{money(finiteN(momentum.outstandingGrowthUsd), "USD")}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Overdue now · due in last 30d</dt>
              <dd className="font-bold">
                {momentum.overdueCountNow} · {momentum.overdueCountPriorMonth}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600">Repeat client rate</dt>
              <dd className="font-bold">
                {safePercent(momentum.repeatClientRate)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-violet-600" aria-hidden />
            <h3 className="text-sm font-bold text-ink">Recommendations</h3>
          </div>
          <ul className="mt-3 space-y-3">
            {recommendations.map((r, i) => (
              <li key={i} className="rounded-xl border border-violet-100 bg-white/80 px-3 py-2 text-xs text-violet-950">
                <p>{r.text}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700/80">Evidence: {r.basis}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bundle.clientSegmentation.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <h3 className="text-sm font-bold text-ink">Client segments (heuristic)</h3>
          <p className="mt-1 text-xs text-slate-500">From balances, overdue counts, and invoice frequency — not credit scoring.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bundle.clientSegmentation.slice(0, 9).map((c) => (
              <li key={c.clientId}>
                <Link
                  href={c.href}
                  className="block touch-manipulation rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs transition hover:border-cedar/30"
                >
                  <span className="font-semibold text-ink">{c.name}</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.segments.map((s) => (
                      <span key={s} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 ring-1 ring-slate-200">
                        {s.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Link className="mt-3 inline-block text-xs font-bold text-cedar" href="/intelligence/deep">
            View operational lists →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link className="btn btn-secondary text-xs touch-manipulation" href="/reports">
          Monthly reports &amp; CSV
        </Link>
      </div>
    </section>
  );
}
