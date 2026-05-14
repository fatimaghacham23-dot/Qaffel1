"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { animate } from "framer-motion";
import {
  AlertTriangle,
  Banknote,
  Ban,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
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
import { humanizeOpsAlert, missionSeverityFromPriority, type MissionSeverity } from "@/lib/dashboard-mission-copy";
import { deriveHealthInsightRows, type HealthInsightSeverity } from "@/lib/health-insights";
import { money, shortDate } from "@/lib/format";
import { finiteN } from "@/lib/safe-metrics";
import {
  bucketForCluster,
  buildOperationsQueueClusters,
  clusterTitle,
  worstClusterPriority,
  type OpsQueueCluster
} from "@/lib/ops-queue-grouping";
import {
  sortOpsAlerts,
  type AlertBucket,
  type OperationsCenterModel,
  type OpsAlert,
  type OpsTimelineItem
} from "@/lib/operations-center";
import { MissionCollapsible } from "@/components/MissionCollapsible";
import { SeverityBadge } from "@/components/SeverityBadge";

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

function resolveAllHref(alerts: OpsAlert[]): string {
  if (alerts.some((a) => a.bucket === "proofs")) return "/proofs";
  if (alerts.some((a) => a.alertType === "missing_payment_methods" || a.alertType === "payment_methods_incomplete")) {
    return "/settings/payment-methods";
  }
  if (alerts.some((a) => a.bucket === "clients")) return "/clients";
  return "/invoices";
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKeyLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function missionAttentionCardClass(sev: MissionSeverity) {
  switch (sev) {
    case "critical":
      return "border-red-200/90 bg-gradient-to-br from-red-50/95 to-white shadow-red-100/30";
    case "urgent":
      return "border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-white shadow-amber-100/25";
    case "warning":
      return "border-sky-200/90 bg-gradient-to-br from-sky-50/70 to-white shadow-sky-100/20";
    case "healthy":
      return "border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white shadow-emerald-100/20";
    default:
      return "border-slate-200/90 bg-gradient-to-br from-slate-50/85 to-white shadow-slate-100/25";
  }
}

function TimelineRowIcon({ eventType }: { eventType: string }) {
  const t = eventType.toLowerCase();
  if (t.includes("void")) return <Ban className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />;
  if (t.includes("receipt_viewed")) return <Eye className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />;
  if (t.includes("reminder")) return <Bell className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />;
  if (t.includes("proof") || t.includes("manual_payment")) return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />;
  if (t.includes("deposit")) return <Banknote className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />;
  return <Timer className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />;
}

function formatDayHeading(key: string, todayKey: string) {
  if (key === "unknown") return "Unknown date";
  if (key === todayKey) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === dayKeyLocal(y.toISOString())) return "Yesterday";
  const [yy, mm, dd] = key.split("-").map((x) => Number(x));
  if (!yy || !mm || !dd) return key;
  return shortDate(new Date(yy, mm - 1, dd).toISOString());
}

function groupTimelineByDay(items: OpsTimelineItem[]) {
  const m = new Map<string, OpsTimelineItem[]>();
  for (const ev of items) {
    const k = dayKeyLocal(ev.createdAt);
    const arr = m.get(k) ?? [];
    arr.push(ev);
    m.set(k, arr);
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
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
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full touch-manipulation items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-slate-50/80 sm:px-4 sm:py-3"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
            aria-hidden
          />
          <span className="truncate text-sm font-bold text-ink">{title}</span>
          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{count}</span>
        </div>
      </button>
      <div
        className={`grid border-t border-slate-100 transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-2.5 pb-3 pt-1 sm:px-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function healthInsightToMissionSev(s: HealthInsightSeverity): MissionSeverity {
  if (s === "critical") return "critical";
  if (s === "high") return "urgent";
  if (s === "medium") return "warning";
  return "info";
}

function OpsAlertCompactRow({ alert: a, bucket }: { alert: OpsAlert; bucket: AlertBucket }) {
  const copy = humanizeOpsAlert(a);
  const sev = missionSeverityFromPriority(a.priority);
  return (
    <Link
      href={a.href}
      className={`flex touch-manipulation gap-2.5 rounded-lg border p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${missionAttentionCardClass(sev)}`}
    >
      <div className="mt-0.5 shrink-0">
        <BucketIcon bucket={bucket} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <SeverityBadge severity={sev} />
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{bucket}</span>
        </div>
        <p className="mt-0.5 text-sm font-semibold leading-snug text-ink">{copy.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{copy.explanation}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-cedar">
          {copy.ctaLabel}
          <ChevronRight className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function OpsClusterCard({ cluster, bucket }: { cluster: OpsQueueCluster; bucket: AlertBucket }) {
  const sortedInner = useMemo(() => [...cluster.alerts].sort(sortOpsAlerts), [cluster.alerts]);
  const [expanded, setExpanded] = useState(sortedInner.length <= 3);
  const [visibleCap, setVisibleCap] = useState(() => (sortedInner.length <= 3 ? sortedInner.length : 3));
  const pr = worstClusterPriority(cluster.alerts);
  const sev = missionSeverityFromPriority(pr);
  const title = clusterTitle(cluster.key, cluster.alerts.length);
  const shown = expanded ? sortedInner.slice(0, Math.min(sortedInner.length, visibleCap)) : [];
  const hasMore = expanded && visibleCap < sortedInner.length;

  const toggle = () => {
    if (expanded) {
      setExpanded(false);
      setVisibleCap(sortedInner.length <= 3 ? sortedInner.length : 3);
    } else {
      setExpanded(true);
      setVisibleCap(sortedInner.length <= 3 ? sortedInner.length : 3);
    }
  };

  return (
    <div className={`overflow-hidden rounded-lg border shadow-sm ${missionAttentionCardClass(sev)}`}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full touch-manipulation items-start gap-2.5 p-2.5 text-left transition hover:bg-white/40"
        aria-expanded={expanded}
      >
        <div className="mt-0.5 shrink-0">
          <BucketIcon bucket={bucket} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <SeverityBadge severity={sev} />
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{bucket}</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-600">Tap to {expanded ? "collapse" : "view"} invoice-level actions and links.</p>
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div className="border-t border-white/30 bg-white/25 px-2 pb-2 pt-1.5">
          <ul className="space-y-1">
            {shown.map((a) => {
              const copy = humanizeOpsAlert(a);
              const rowSev = missionSeverityFromPriority(a.priority);
              return (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className={`flex touch-manipulation flex-col gap-0.5 rounded-md border px-2 py-1.5 text-left transition hover:bg-white/60 ${missionAttentionCardClass(rowSev)}`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SeverityBadge severity={rowSev} className="px-1.5 py-0 text-[9px]" />
                      <span className="text-[10px] font-bold text-cedar">{copy.ctaLabel}</span>
                    </div>
                    <p className="text-[11px] font-semibold leading-snug text-ink">{copy.title}</p>
                    <p className="text-[10px] leading-snug text-slate-600">{copy.explanation}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
          {hasMore ? (
            <button
              type="button"
              className="mt-1.5 w-full touch-manipulation rounded-md border border-slate-200/80 bg-white/70 py-1.5 text-[11px] font-bold text-cedar transition hover:bg-white"
              onClick={() => setVisibleCap((v) => v + 6)}
            >
              Show more ({(sortedInner.length - visibleCap).toLocaleString()} hidden)
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type PaymentConversionSnapshot = {
  awaitingPaymentCount: number;
  viewedNotPaidCount: number;
  remindersSentCount: number;
  proofsAwaitingConfirmation: number;
};

const BUCKET_ORDER: AlertBucket[] = ["payments", "proofs", "invoices", "clients"];
const BUCKET_LABEL: Record<AlertBucket, string> = {
  payments: "Payments",
  proofs: "Proofs",
  invoices: "Invoices",
  clients: "Clients"
};

export function OperationsCenterView({
  model,
  clientPhones,
  paymentConversion
}: {
  model: OperationsCenterModel;
  clientPhones: Record<string, string | undefined>;
  paymentConversion?: PaymentConversionSnapshot | null;
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

  const sortedAlerts = useMemo(() => [...model.alerts].sort(sortOpsAlerts), [model.alerts]);
  const reviewNextHref = sortedAlerts[0]?.href ?? "/invoices";
  const resolveHref = useMemo(() => resolveAllHref(model.alerts), [model.alerts]);

  const { clusters } = useMemo(() => buildOperationsQueueClusters(model.alerts), [model.alerts]);

  const healthIssues = useMemo(() => deriveHealthInsightRows(model.health), [model.health]);
  const healthFast = useMemo(() => healthIssues.slice(0, 3), [healthIssues]);

  const timelineCutoff = useMemo(() => {
    const t = startOfLocalDay(new Date());
    t.setDate(t.getDate() - 6);
    return t;
  }, []);

  const todayKey = dayKeyLocal(new Date().toISOString());

  const { recentTimeline, olderTimeline, olderCount } = useMemo(() => {
    const recent: OpsTimelineItem[] = [];
    const older: OpsTimelineItem[] = [];
    for (const ev of model.timeline) {
      const d = startOfLocalDay(new Date(ev.createdAt));
      if (!Number.isNaN(d.getTime()) && d >= timelineCutoff) recent.push(ev);
      else older.push(ev);
    }
    return {
      recentTimeline: groupTimelineByDay(recent),
      olderTimeline: groupTimelineByDay(older),
      olderCount: older.length
    };
  }, [model.timeline, timelineCutoff]);

  const [olderTimelineOpen, setOlderTimelineOpen] = useState(false);

  return (
    <section className="mb-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cedar">Mission control</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Live operations board</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Real signals from invoices, proofs, and your activity log — nothing here is invented; it reflects your workspace data only.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-700">
            Built to help you get paid faster — every number ties to a record you already have.
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

      <div className="sticky top-16 z-30 -mx-1 mb-1 rounded-2xl border border-slate-200/80 bg-white/90 px-2 py-2.5 shadow-card backdrop-blur-md supports-[backdrop-filter]:bg-white/75 sm:px-3 sm:py-3 md:top-20">
        <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick actions</p>
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

      {paymentConversion ? (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3 shadow-sm sm:px-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment conversion · live counts</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">Operational view of money in motion</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200/60 bg-white/80 px-2.5 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Awaiting payment</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{paymentConversion.awaitingPaymentCount.toLocaleString()}</dd>
              <dd className="text-[10px] text-slate-500">Open invoices</dd>
            </div>
            <div className="rounded-lg border border-slate-200/60 bg-white/80 px-2.5 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Viewed, still unpaid</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{paymentConversion.viewedNotPaidCount.toLocaleString()}</dd>
              <dd className="text-[10px] text-slate-500">Receipt page views logged</dd>
            </div>
            <div className="rounded-lg border border-slate-200/60 bg-white/80 px-2.5 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reminders sent</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{paymentConversion.remindersSentCount.toLocaleString()}</dd>
              <dd className="text-[10px] text-slate-500">Last 30 days</dd>
            </div>
            <div className="rounded-lg border border-slate-200/60 bg-white/80 px-2.5 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Proofs to confirm</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">
                {paymentConversion.proofsAwaitingConfirmation.toLocaleString()}
              </dd>
              <dd className="text-[10px] text-slate-500">Pending review</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {healthIssues.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-3 shadow-sm sm:px-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Top issues affecting health</p>
            <p className="mt-0.5 text-xs text-slate-600">Derived from your health subscores (points left on the table).</p>
            <ul className="mt-2 space-y-2">
              {healthIssues.slice(0, 5).map((row) => (
                <li key={row.key} className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink">{row.label}</p>
                    <SeverityBadge severity={healthInsightToMissionSev(row.severity)} className="px-1.5 py-0 text-[9px]" />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">{row.note}</p>
                  <Link href={row.href} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-cedar">
                    {row.actionLabel}
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-3 shadow-sm sm:px-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">What improves operations fastest</p>
            <p className="mt-0.5 text-xs text-slate-600">Same breakdown, ordered by the largest point gaps.</p>
            <ul className="mt-2 space-y-2">
              {healthFast.map((row) => (
                <li key={`fast-${row.key}`} className="rounded-lg border border-emerald-100/80 bg-emerald-50/35 px-2.5 py-2">
                  <p className="text-xs font-semibold text-ink">{row.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-600">{row.note}</p>
                  <Link href={row.href} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-cedar">
                    {row.actionLabel}
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" aria-hidden />
              <h3 className="text-lg font-bold text-ink">Operations queue</h3>
            </div>
            {hasAlerts ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={reviewNextHref}
                  className="btn btn-primary touch-manipulation px-3 py-2 text-xs transition hover:opacity-95 active:scale-[0.99]"
                >
                  Review next
                </Link>
                <Link
                  href={resolveHref}
                  className="btn btn-secondary touch-manipulation px-3 py-2 text-xs transition hover:bg-slate-100 active:scale-[0.99]"
                >
                  Resolve all
                </Link>
              </div>
            ) : null}
          </div>
          {!hasAlerts ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-5 text-sm text-emerald-900">
              <p className="font-semibold">Queue is clear.</p>
              <p className="mt-1 text-emerald-800/90">No overdue, proof age, expiring link, deposit, or client-pattern flags matched your current data.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {BUCKET_ORDER.map((bucket) => {
                const bucketClusters = clusters.filter((c) => bucketForCluster(c.key) === bucket);
                const clusteredIds = new Set(bucketClusters.flatMap((c) => c.alerts.map((a) => a.id)));
                const bucketSingles = model.alertsByBucket[bucket].filter((a) => !clusteredIds.has(a.id));
                const total = bucketClusters.length + bucketSingles.length;
                if (!total) return null;
                const criticalHere = [...bucketClusters.flatMap((c) => c.alerts), ...bucketSingles].some((i) => i.priority === "critical");
                const defaultOpen = criticalHere || total <= 3;
                return (
                  <CollapsibleGroup key={bucket} title={BUCKET_LABEL[bucket]} count={total} defaultOpen={defaultOpen}>
                    <ul className="grid gap-1.5">
                      {bucketClusters.map((c) => (
                        <li key={c.key}>
                          <OpsClusterCard cluster={c} bucket={bucket} />
                        </li>
                      ))}
                      {bucketSingles.map((a) => (
                        <li key={a.id}>
                          <OpsAlertCompactRow alert={a} bucket={bucket} />
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
          <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-slate-50/90 to-white p-3 shadow-sm backdrop-blur-[2px] sm:p-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-slate-500" aria-hidden />
              <h3 className="text-sm font-bold text-ink">Financial snapshot · cash (USD)</h3>
            </div>
            <dl className="mt-3 grid gap-2.5 text-sm">
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Cash arriving this week</dt>
                <dd className="font-bold text-ink">
                  <AnimatedMoney value={model.cashFlow.expectedIncomingWeekUsd} currency="USD" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Revenue at risk (overdue)</dt>
                <dd className="font-bold text-red-700">
                  <AnimatedMoney value={model.cashFlow.overdueRecoverableUsd} currency="USD" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <dt className="text-slate-600">Deposit still needed (est.)</dt>
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

          <MissionCollapsible
            id="ops-signals"
            title="Signals, payment mix & deep context"
            subtitle="Method mix, statistical insights, health breakdown, and client risk cards — expand when you want the full picture."
            defaultOpen={false}
            expandLabel="Expand intelligence"
            collapseLabel="Collapse intelligence"
          >
            <div className="grid gap-4">
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
            </div>
          </MissionCollapsible>
        </div>
      </div>

      <MissionCollapsible
        id="ops-timeline"
        title="Timeline & activity"
        subtitle="Reminders, proofs, deposits, receipts, voids — grouped by day. Last 7 days first; older entries tuck away."
        defaultOpen={false}
        expandLabel="Expand timeline"
        collapseLabel="Collapse timeline"
        badge={
          model.timeline.length > 0 ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{model.timeline.length}</span>
          ) : null
        }
      >
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/30 p-3 sm:p-4">
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
            <div className="max-h-[min(70vh,520px)] space-y-4 overflow-y-auto pr-1 text-xs">
              {recentTimeline.map(([dayKey, events]) => (
                <div key={dayKey} className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{formatDayHeading(dayKey, todayKey)}</p>
                  <ul className="space-y-1.5">
                    {events.map((ev) => {
                      const overdueHint =
                        ev.message.toLowerCase().includes("overdue") || ev.eventType.toLowerCase().includes("overdue");
                      const voidHint = ev.eventType.toLowerCase().includes("void");
                      return (
                        <li
                          key={ev.id}
                          className={`flex gap-2 rounded-lg border px-2.5 py-2 transition hover:shadow-sm ${
                            voidHint
                              ? "border-red-200 bg-red-50/50"
                              : overdueHint
                                ? "border-amber-200 bg-amber-50/40"
                                : ev.tone === "payment"
                                  ? "border-emerald-100 bg-emerald-50/50"
                                  : ev.tone === "risk"
                                    ? "border-red-100 bg-red-50/40"
                                    : ev.tone === "reminder"
                                      ? "border-amber-100 bg-amber-50/40"
                                      : ev.tone === "receipt"
                                        ? "border-sky-100 bg-sky-50/40"
                                        : "border-slate-100 bg-white/80"
                          }`}
                        >
                          <TimelineRowIcon eventType={ev.eventType} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold leading-snug text-ink">{ev.message}</p>
                            <p className="truncate text-[10px] text-slate-500">
                              {ev.invoiceLabel} · <span className="font-mono">{ev.eventType}</span>
                            </p>
                          </div>
                          <time className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{shortDate(ev.createdAt)}</time>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              {olderTimeline.length > 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white/60">
                  <button
                    type="button"
                    className="flex w-full touch-manipulation items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    onClick={() => setOlderTimelineOpen((o) => !o)}
                    aria-expanded={olderTimelineOpen}
                  >
                    <span className="inline-flex items-center gap-2">
                      {olderTimelineOpen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                      Earlier activity
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{olderCount}</span>
                  </button>
                  {olderTimelineOpen ? (
                    <div className="space-y-4 border-t border-slate-100 px-2 pb-3 pt-2">
                      {olderTimeline.map(([dayKey, events]) => (
                        <div key={dayKey} className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{formatDayHeading(dayKey, todayKey)}</p>
                          <ul className="space-y-1.5">
                            {events.map((ev) => {
                              const overdueHint =
                                ev.message.toLowerCase().includes("overdue") || ev.eventType.toLowerCase().includes("overdue");
                              const voidHint = ev.eventType.toLowerCase().includes("void");
                              return (
                                <li
                                  key={ev.id}
                                  className={`flex gap-2 rounded-lg border px-2.5 py-2 ${
                                    voidHint
                                      ? "border-red-200 bg-red-50/50"
                                      : overdueHint
                                        ? "border-amber-200 bg-amber-50/40"
                                        : ev.tone === "payment"
                                          ? "border-emerald-100 bg-emerald-50/50"
                                          : ev.tone === "risk"
                                            ? "border-red-100 bg-red-50/40"
                                            : ev.tone === "reminder"
                                              ? "border-amber-100 bg-amber-50/40"
                                              : ev.tone === "receipt"
                                                ? "border-sky-100 bg-sky-50/40"
                                                : "border-slate-100 bg-white/80"
                                  }`}
                                >
                                  <TimelineRowIcon eventType={ev.eventType} />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[13px] font-semibold leading-snug text-ink">{ev.message}</p>
                                    <p className="truncate text-[10px] text-slate-500">
                                      {ev.invoiceLabel} · <span className="font-mono">{ev.eventType}</span>
                                    </p>
                                  </div>
                                  <time className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                                    {shortDate(ev.createdAt)}
                                  </time>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </MissionCollapsible>
    </section>
  );
}
