"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { animate } from "framer-motion";
import {
  AlertTriangle,
  Banknote,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Gauge,
  Link2,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Timer,
  Users,
  Zap
} from "lucide-react";
import { duplicateInvoiceAction, regenerateInvoicePublicTokenAction } from "@/app/actions";
import { money, shortDate } from "@/lib/format";
import { finiteN } from "@/lib/safe-metrics";
import type { AlertBucket, OperationsCenterModel, OpsAlert } from "@/lib/operations-center";

function waHref(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  let n = d;
  if (n.startsWith("961")) return `https://wa.me/${n}`;
  if (n.startsWith("0")) n = `961${n.slice(1)}`;
  else if (!n.startsWith("961")) n = `961${n}`;
  return `https://wa.me/${n}`;
}

function priorityRing(p: OpsAlert["priority"]) {
  switch (p) {
    case "critical":
      return "border-red-300 bg-gradient-to-br from-red-50 to-white shadow-red-100/50";
    case "high":
      return "border-amber-300 bg-gradient-to-br from-amber-50 to-white shadow-amber-100/50";
    case "medium":
      return "border-sky-200 bg-gradient-to-br from-sky-50/80 to-white shadow-sky-100/40";
    default:
      return "border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-slate-100/40";
  }
}

function priorityDot(p: OpsAlert["priority"]) {
  switch (p) {
    case "critical":
      return "bg-red-500";
    case "high":
      return "bg-amber-500";
    case "medium":
      return "bg-sky-500";
    default:
      return "bg-slate-400";
  }
}

function BucketIcon({ bucket }: { bucket: AlertBucket }) {
  switch (bucket) {
    case "payments":
      return <Banknote className="h-4 w-4" aria-hidden />;
    case "clients":
      return <Users className="h-4 w-4" aria-hidden />;
    case "proofs":
      return <ClipboardList className="h-4 w-4" aria-hidden />;
    default:
      return <Building2 className="h-4 w-4" aria-hidden />;
  }
}

function AnimatedMoney({ value, currency }: { value: number; currency: "USD" | "LBP" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const safe = finiteN(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = animate(0, safe, {
      duration: 0.75,
      ease: "circOut",
      onUpdate: (v) => {
        el.textContent = money(finiteN(v), currency);
      }
    });
    return () => c.stop();
  }, [safe, currency]);
  return <span ref={ref}>{money(0, currency)}</span>;
}

function AnimatedScore({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const safe = finiteN(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = animate(0, safe, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = `${Math.round(finiteN(v))}`;
      }
    });
    return () => c.stop();
  }, [safe]);
  return <span ref={ref}>0</span>;
}

function CollapsibleGroup({
  title,
  count,
  defaultOpen,
  children
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-soft">
      <button
        type="button"
        className="flex w-full touch-manipulation items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50/80 sm:px-5 sm:py-4"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
          <span className="truncate font-bold text-ink">{title}</span>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{count}</span>
        </div>
      </button>
      {open ? <div className="border-t border-slate-100 px-3 pb-4 pt-1 sm:px-4">{children}</div> : null}
    </div>
  );
}

const BUCKET_ORDER: AlertBucket[] = ["payments", "proofs", "invoices", "clients"];
const BUCKET_LABEL: Record<AlertBucket, string> = {
  payments: "Payments",
  proofs: "Proofs",
  invoices: "Invoices",
  clients: "Clients"
};

export function OperationsCenterView({
  model,
  clientPhones
}: {
  model: OperationsCenterModel;
  clientPhones: Record<string, string | undefined>;
}) {
  let workflowInvoiceId: string | null = null;
  for (const a of model.alerts) {
    if (
      a.invoiceId &&
      (a.alertType === "overdue_invoice" || a.alertType === "expiring_link" || a.alertType === "unpaid_deposit")
    ) {
      workflowInvoiceId = a.invoiceId;
      break;
    }
  }

  let workflowClientPhone: { href: string; label: string } | null = null;
  for (const a of model.alerts) {
    if (!a.clientId) continue;
    const ph = clientPhones[a.clientId];
    const href = waHref(ph);
    if (href) {
      workflowClientPhone = { href, label: a.title };
      break;
    }
  }

  const hasAlerts = model.alerts.length > 0;

  return (
    <section className="mb-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cedar">Operations center</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Command view</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Live signals from your invoices, proofs, and timeline — no fabricated analytics, only what your workspace data supports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 shadow-inner">
          <Gauge className="h-8 w-8 text-cedar" aria-hidden />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Workspace health</p>
            <p className="text-2xl font-black leading-none text-ink">
              <AnimatedScore value={model.health.score} />
              <span className="text-sm font-semibold text-slate-500">/100</span>
            </p>
            <p className="text-xs font-semibold text-slate-700">{model.health.label}</p>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-30 -mx-1 mb-1 rounded-2xl border border-slate-200/80 bg-white/90 px-2 py-3 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/75 sm:px-3">
        <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-primary touch-manipulation px-3 py-2 text-xs" href="/invoices/new">
            New invoice
          </Link>
          <Link className="btn btn-secondary touch-manipulation px-3 py-2 text-xs" href="/proofs">
            Review proofs
          </Link>
          <Link className="btn btn-secondary touch-manipulation px-3 py-2 text-xs" href="/invoices">
            All invoices
          </Link>
          <Link className="btn btn-secondary touch-manipulation px-3 py-2 text-xs" href="/settings/payment-methods">
            Payment methods
          </Link>
          {workflowInvoiceId ? (
            <Link className="btn btn-secondary touch-manipulation px-3 py-2 text-xs" href={`/invoices/${workflowInvoiceId}#follow-up`}>
              Send reminder
            </Link>
          ) : null}
          {workflowClientPhone ? (
            <a
              className="btn btn-secondary inline-flex touch-manipulation items-center gap-1.5 px-3 py-2 text-xs"
              href={workflowClientPhone.href}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              WhatsApp
            </a>
          ) : null}
          {workflowInvoiceId ? (
            <>
              <form action={duplicateInvoiceAction} className="inline">
                <input name="id" type="hidden" value={workflowInvoiceId} />
                <button className="btn btn-secondary touch-manipulation px-3 py-2 text-xs" type="submit">
                  Duplicate invoice
                </button>
              </form>
              <form action={regenerateInvoicePublicTokenAction} className="inline">
                <input name="invoice_id" type="hidden" value={workflowInvoiceId} />
                <button
                  className="btn touch-manipulation border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100/80"
                  type="submit"
                >
                  <span className="inline-flex items-center gap-1">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Regenerate pay link
                  </span>
                </button>
              </form>
              <Link
                className="btn touch-manipulation border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                href={`/invoices/${workflowInvoiceId}#extend-validity`}
              >
                <span className="inline-flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5" aria-hidden />
                  Extend validity
                </span>
              </Link>
            </>
          ) : null}
        </div>
        <p className="mt-2 px-1 text-[10px] text-slate-500">
          Regenerating the pay link invalidates old /pay/… URLs for that invoice — share the new link from the invoice page after refresh.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" aria-hidden />
            <h3 className="text-lg font-bold text-ink">Needs your attention</h3>
          </div>
          {!hasAlerts ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-5 text-sm text-emerald-900">
              <p className="font-semibold">Queue is clear.</p>
              <p className="mt-1 text-emerald-800/90">No overdue, proof age, expiring link, deposit, or client-pattern flags matched your current data.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {BUCKET_ORDER.map((bucket) => {
                const items = model.alertsByBucket[bucket];
                if (!items.length) return null;
                const criticalHere = items.some((i) => i.priority === "critical");
                return (
                  <CollapsibleGroup
                    key={bucket}
                    title={BUCKET_LABEL[bucket]}
                    count={items.length}
                    defaultOpen={criticalHere || bucket === "proofs" || bucket === "payments"}
                  >
                    <ul className="grid gap-2">
                      {items.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={a.href}
                            className={`flex touch-manipulation gap-3 rounded-xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${priorityRing(a.priority)}`}
                          >
                            <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot(a.priority)}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                                  {a.priority}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  <BucketIcon bucket={bucket} />
                                  {bucket}
                                </span>
                              </div>
                              <p className="mt-1 font-semibold text-ink">{a.title}</p>
                              <p className="mt-0.5 text-xs leading-snug text-slate-600">{a.detail}</p>
                              <p className="mt-2 text-[11px] font-bold text-cedar">Open →</p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleGroup>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-slate-500" aria-hidden />
              <h3 className="text-sm font-bold text-ink">Cash position (USD)</h3>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Due this week (remaining)</dt>
                <dd className="font-bold text-ink">
                  <AnimatedMoney value={model.cashFlow.expectedIncomingWeekUsd} currency="USD" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Overdue recoverable</dt>
                <dd className="font-bold text-red-700">
                  <AnimatedMoney value={model.cashFlow.overdueRecoverableUsd} currency="USD" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Unpaid deposits (est.)</dt>
                <dd className="font-bold text-amber-800">
                  <AnimatedMoney value={model.cashFlow.unpaidDepositsUsd} currency="USD" />
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">{model.cashFlow.velocityLabel}</dt>
                {model.cashFlow.velocityDetail ? (
                  <dd className="mt-1 text-xs text-slate-600">{model.cashFlow.velocityDetail}</dd>
                ) : (
                  <dd className="mt-1 text-xs text-slate-500">Add more accepted payments to compare week-over-week velocity.</dd>
                )}
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-soft sm:p-5">
            <h3 className="text-sm font-bold text-ink">Lebanon-style payment mix</h3>
            <p className="mt-1 text-xs text-slate-500">From accepted proofs with a method label (Whish, OMT, bank, …).</p>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Most frequent method</span>
                <span className="font-semibold text-ink">
                  {model.paymentMethods.preferredByCount
                    ? `${model.paymentMethods.preferredByCount.method} (${Math.round(model.paymentMethods.preferredByCount.share * 100)}%)`
                    : "—"}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Fastest median review time</span>
                <span className="font-semibold text-ink">
                  {model.paymentMethods.fastestSettling
                    ? `${model.paymentMethods.fastestSettling.method} · ${model.paymentMethods.fastestSettling.medianHours < 24 ? `${Math.round(model.paymentMethods.fastestSettling.medianHours)}h` : `${Math.round(model.paymentMethods.fastestSettling.medianHours / 24)}d`}`
                    : "—"}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Most accepted proofs</span>
                <span className="font-semibold text-ink">
                  {model.paymentMethods.highestConfirmed ? `${model.paymentMethods.highestConfirmed.method} (${model.paymentMethods.highestConfirmed.count})` : "—"}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span className="text-slate-600">Shows on most paid invoices</span>
                <span className="font-semibold text-ink">
                  {model.paymentMethods.mostUsedPaidInvoices
                    ? `${model.paymentMethods.mostUsedPaidInvoices.method} (${model.paymentMethods.mostUsedPaidInvoices.count})`
                    : "—"}
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" aria-hidden />
              <h3 className="text-sm font-bold text-ink">Insights</h3>
            </div>
            {model.insights.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">Not enough comparable history yet — keep invoicing; insights appear once patterns are statistically meaningful.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {model.insights.map((ins, i) => (
                  <li key={i} className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2 text-xs text-violet-950">
                    <p>{ins.text}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700/80">Based on {ins.basis}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
            <h3 className="text-sm font-bold text-ink">Health breakdown</h3>
            <ul className="mt-3 space-y-2 text-xs">
              {model.health.breakdown.map((row) => (
                <li key={row.key} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-2">
                  <div className="flex justify-between gap-2 font-semibold text-slate-800">
                    <span>{row.label}</span>
                    <span>
                      {row.points}/{row.max}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{row.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {model.clientRisks.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" aria-hidden />
            <h3 className="text-sm font-bold text-ink">Client risk signals</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">Derived only from invoice status, balances, proof outcomes, and due dates in your workspace.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {model.clientRisks.slice(0, 8).map((c) => (
              <li key={c.clientId}>
                <Link
                  href={c.href}
                  className="block touch-manipulation rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition hover:border-cedar/30 hover:bg-white"
                >
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{c.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-slate-400" aria-hidden />
            <h3 className="text-sm font-bold text-ink">Operational timeline</h3>
          </div>
          <Link className="text-xs font-semibold text-cedar" href="/invoices">
            Open invoices
          </Link>
        </div>
        {model.timeline.length === 0 ? (
          <p className="text-xs text-slate-500">Activity from reminders, proofs, payments, and receipts will build here as clients interact.</p>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1 text-xs sm:max-h-[520px]">
            {model.timeline.map((ev) => (
              <li
                key={ev.id}
                className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
                  ev.tone === "payment"
                    ? "border-emerald-100 bg-emerald-50/50"
                    : ev.tone === "risk"
                      ? "border-red-100 bg-red-50/40"
                      : ev.tone === "reminder"
                        ? "border-amber-100 bg-amber-50/40"
                        : ev.tone === "receipt"
                          ? "border-sky-100 bg-sky-50/40"
                          : "border-slate-100 bg-slate-50/60"
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{ev.message}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {ev.invoiceLabel} · <span className="font-mono text-[10px]">{ev.eventType}</span>
                  </p>
                </div>
                <time className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{shortDate(ev.createdAt)}</time>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
