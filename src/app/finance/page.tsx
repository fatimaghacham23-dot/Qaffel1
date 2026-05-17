import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Archive,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  TimerReset
} from "lucide-react";
import { updateFinanceCloseStatusAction, updateFinanceCloseTaskAction } from "@/app/finance-actions";
import { AppShell } from "@/components/AppShell";
import { OperationalPresenceHeartbeat } from "@/components/OperationalPresenceHeartbeat";
import { EntityPresenceLine, OperationalPresenceStrip } from "@/components/OperationalPresenceStrip";
import { PrintButton } from "@/components/PrintButton";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getWorkspaceContext } from "@/lib/get-workspace";
import {
  buildFinanceClosingModel,
  type FinanceApprovalRow,
  type FinanceClosePeriodState,
  type FinanceCloseTaskState,
  type FinanceClosingModel,
  type FinanceEventRow,
  type FinanceExportRunRow,
  type FinanceInvoiceRow
} from "@/lib/finance-closing";
import { hasPermission } from "@/lib/permissions";
import { buildOperationalPresenceModel, type EntityPresenceSummary, type PresenceSessionRow } from "@/lib/operational-presence";
import { requireUser } from "@/lib/supabase/server";

type PageSearch = {
  m?: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function previousMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function nextMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 7);
}

function metricToneClass(tone: FinanceClosingModel["metrics"][number]["tone"]) {
  if (tone === "good") return "border-emerald-200/70 bg-emerald-50/55";
  if (tone === "watch") return "border-amber-200/70 bg-amber-50/55";
  if (tone === "risk") return "border-rose-200/65 bg-rose-50/45";
  return "border-slate-200/70 bg-white/90";
}

function closeStatusBadge(status: string) {
  if (status === "signed_off") return <StatusBadge status="complete" label="Signed off" />;
  if (status === "in_review") return <StatusBadge status="pending" label="In review" />;
  if (status === "reopened") return <StatusBadge status="warning" label="Reopened" />;
  return <StatusBadge status="neutral" label="Draft close" />;
}

function taskStatusBadge(status: string) {
  if (status === "completed") return <StatusBadge status="complete" label="Complete" size="sm" />;
  if (status === "skipped") return <StatusBadge status="neutral" label="Carried forward" size="sm" />;
  return <StatusBadge status="pending" label="Open" size="sm" />;
}

function dateLabel(value?: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Not recorded";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function baseHref(href: string) {
  return href.split("#")[0];
}

function reconciliationStatus(status: string) {
  if (status.includes("over")) return "overdue";
  if (status.includes("void")) return "voided";
  if (status.includes("accepted")) return "accepted";
  if (status.includes("partial")) return "partial";
  if (status.includes("pending") || status.includes("open")) return "pending";
  return "neutral";
}

function MetricGrid({ model }: { model: FinanceClosingModel }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {model.metrics.map((metric) => (
        <div key={metric.label} className={`q-surface p-4 ${metricToneClass(metric.tone)}`}>
          <p className="q-section-label">{metric.label}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-ink">{metric.value}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{metric.detail}</p>
        </div>
      ))}
    </section>
  );
}

function CloseChecklist({
  model,
  canUpdate,
  presenceByEntity
}: {
  model: FinanceClosingModel;
  canUpdate: boolean;
  presenceByEntity?: Map<string, EntityPresenceSummary>;
}) {
  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="q-section-label">Month-end workflow</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">Close checklist</h2>
          <p className="mt-1 text-sm text-slate-600">
            {model.completion.completed}/{model.completion.total} tasks complete. Notes are internal operational context, not accounting adjustments.
          </p>
        </div>
        <div className="min-w-32 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Progress</p>
          <p className="text-xl font-semibold text-ink">{model.completion.percentage}%</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {model.checklist.map((task) => (
          <form key={task.key} action={updateFinanceCloseTaskAction} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <input name="period_month" type="hidden" value={model.periodMonth} />
            <input name="task_key" type="hidden" value={task.key} />
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {taskStatusBadge(task.status)}
                  <h3 className="font-semibold text-ink">{task.title}</h3>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{task.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {task.completed_at ? `Completed ${dateLabel(task.completed_at)}${task.completed_by_name ? ` by ${task.completed_by_name}` : ""}` : "No completion recorded yet."}
                </p>
                <EntityPresenceLine summary={presenceByEntity?.get(`finance_close:${model.periodMonth}:${task.key}`)} />
              </div>
              <div className="grid gap-2 sm:grid-cols-[150px_minmax(220px,1fr)_auto] lg:min-w-[560px]">
                <select className="field h-10 text-xs" name="status" defaultValue={task.status} disabled={!canUpdate}>
                  <option value="open">Open</option>
                  <option value="completed">Completed</option>
                  <option value="skipped">Carry forward</option>
                </select>
                <input className="field h-10 text-xs" name="note" placeholder="Finance review note" defaultValue={task.note || ""} disabled={!canUpdate} />
                <button className="btn btn-secondary h-10 px-3 text-xs" type="submit" disabled={!canUpdate}>
                  Save
                </button>
              </div>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}

function ReconciliationReview({
  model,
  presenceByHref
}: {
  model: FinanceClosingModel;
  presenceByHref?: Map<string, EntityPresenceSummary>;
}) {
  const groups = [
    ["acceptedProofs", "Accepted proofs"],
    ["partialPayments", "Partial payments"],
    ["overpayments", "Overpayments"],
    ["voidedReceipts", "Voided receipts"],
    ["unresolvedBalances", "Unresolved balances"],
    ["depositCoverage", "Deposit coverage"],
    ["paymentPlanBalances", "Payment-plan balances"]
  ] as const;

  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="q-section-label">Reconciliation review</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">Explainable financial states</h2>
          <p className="mt-1 text-sm text-slate-600">Every row shows the source calculation. No hidden adjustments are applied.</p>
        </div>
        <StatusBadge status={model.summary.unresolvedCount ? "warning" : "complete"} label={`${model.summary.unresolvedCount} unresolved`} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="grid content-start gap-2">
          {groups.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm">
              <span className="text-slate-600">{label}</span>
              <span className="font-semibold text-ink">{model.reconciliation[key].length}</span>
            </div>
          ))}
        </div>

        <div className="max-h-[640px] overflow-y-auto pr-1">
          {model.reconciliation.items.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/65 p-5 text-sm text-emerald-950">
              No reconciliation review items matched this close period.
            </div>
          ) : (
            <div className="grid gap-3">
              {model.reconciliation.items.slice(0, 80).map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={reconciliationStatus(item.status)} label={item.status} size="sm" />
                        <span className="q-chip min-h-7 px-2 py-0 text-[10px]">{item.type.replaceAll("_", " ")}</span>
                      </div>
                      <h3 className="mt-2 font-semibold text-ink">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.invoiceNumber} - {item.clientName}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.explanation}</p>
                      <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                        {item.formula}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.evidence.slice(0, 3).map((evidence) => (
                          <span key={evidence} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                            {evidence}
                          </span>
                        ))}
                      </div>
                      <EntityPresenceLine summary={presenceByHref?.get(baseHref(item.href))} />
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink">${item.amountUsd.toLocaleString()}</p>
                      <p className="text-xs font-medium tabular-nums text-slate-500">LBP {Math.round(item.amountLbp).toLocaleString()}</p>
                      <Link className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cedar" href={item.href}>
                        Open <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ExportPackage({ model, canExport }: { model: FinanceClosingModel; canExport: boolean }) {
  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="q-section-label">Accountant export experience</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">Monthly finance package</h2>
          <p className="mt-1 text-sm text-slate-600">
            Export-ready CSVs with clean labels and no internal IDs. Each download is manual.
          </p>
        </div>
        <Link className="btn btn-secondary btn-xs" href="/export">
          Export center
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {model.exports.map((dataset) => (
          <article key={dataset.key} className="flex min-h-48 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cedar/10 bg-cedar/[0.06] text-cedar">
                <FileSpreadsheet className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink">{dataset.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{dataset.description}</p>
              </div>
            </div>
            <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              {dataset.rows.length.toLocaleString()} row{dataset.rows.length === 1 ? "" : "s"} ready
            </p>
            <div className="mt-auto pt-4">
              <Link
                className={`btn w-full ${dataset.key === "finance_close_snapshot" ? "btn-primary" : "btn-secondary"} btn-xs`}
                href={canExport ? `/reports/csv?preset=${encodeURIComponent(dataset.key)}&m=${encodeURIComponent(model.periodMonth)}` : "/export"}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Download CSV
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-slate-500" aria-hidden />
          <h3 className="text-sm font-semibold text-ink">Export generation history</h3>
        </div>
        <div className="mt-3 grid gap-2">
          {model.exportRuns.length === 0 ? (
            <p className="text-sm text-slate-600">No finance exports recorded for this month yet.</p>
          ) : (
            model.exportRuns.slice(0, 8).map((run) => (
              <div key={`${run.export_type}-${run.generated_at}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-ink">{run.title}</span>
                <span className="text-slate-500">
                  {Number(run.row_count || 0).toLocaleString()} rows - {dateLabel(run.generated_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function FinanceTimeline({ model }: { model: FinanceClosingModel }) {
  return (
    <section className="panel">
      <div className="flex items-center gap-2">
        <TimerReset className="h-4 w-4 text-slate-500" aria-hidden />
        <h2 className="text-lg font-semibold text-ink">Finance timeline</h2>
      </div>
      <p className="mt-1 text-sm text-slate-600">Financial lifecycle events, approvals, recovery actions, plan changes, and export history for this period.</p>
      <div className="mt-4 max-h-[520px] overflow-y-auto pr-1">
        {model.timeline.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-600">No finance timeline events in this period.</div>
        ) : (
          <ul className="grid gap-2">
            {model.timeline.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold capitalize text-ink">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {item.invoiceNumber || "Workspace"}{item.actor ? ` - ${item.actor}` : ""}
                    </p>
                  </div>
                  <time className="text-[11px] font-semibold text-slate-400">{dateLabel(item.occurredAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default async function FinanceClosingPage({ searchParams }: { searchParams?: Promise<PageSearch> }) {
  const resolved = searchParams ? await searchParams : {};
  const selectedMonth = /^\d{4}-\d{2}$/.test(resolved.m || "") ? resolved.m! : currentMonth();
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();

  if (!hasPermission(ctx.role, "reports.view")) {
    redirect("/dashboard");
  }

  const canUpdateClose = hasPermission(ctx.role, "exports.finance");
  const presenceCutoff = new Date();
  presenceCutoff.setMinutes(presenceCutoff.getMinutes() - 10);

  const [
    { data: invoices },
    { data: events },
    { data: approvals },
    { data: closePeriod },
    { data: closeTasks },
    { data: exportRuns },
    { data: presenceSessions }
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, title, status, document_type, client_id, amount_usd, amount_lbp, currency, due_date, valid_until, created_at, exchange_rate_lbp_per_usd, deposit_enabled, deposit_type, deposit_percent, deposit_amount_usd, deposit_amount_lbp, deposit_note, payment_plan, approval_status, clients(id, name, phone, email), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, reviewed_at, reviewed_by, reviewer_name, reviewer_role, payment_date, method, voided_at, void_reason, note, reviewer_decision_note)"
      )
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase
      .from("invoice_events")
      .select("id, invoice_id, event_type, message, created_at, actor_id, actor_name, actor_role, metadata")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(4000),
    supabase
      .from("workspace_approvals")
      .select("id, type, reference_id, reference_type, requested_by, approved_by, status, note, threshold_usd, created_at, resolved_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(800),
    supabase
      .from("finance_close_periods")
      .select("period_month, status, notes, signed_off_by_name, signed_off_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("period_month", selectedMonth)
      .maybeSingle(),
    supabase
      .from("finance_close_tasks")
      .select("task_key, status, note, completed_by_name, completed_at, updated_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("period_month", selectedMonth),
    supabase
      .from("finance_export_runs")
      .select("id, period_month, export_type, title, row_count, generated_by_name, generated_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("period_month", selectedMonth)
      .order("generated_at", { ascending: false })
      .limit(40),
    supabase
      .from("operational_presence_sessions")
      .select("id, user_id, user_name, user_role, scope, entity_type, entity_id, label, target_href, last_seen_at, expires_at")
      .eq("workspace_id", ctx.workspaceId)
      .gt("expires_at", presenceCutoff.toISOString())
      .order("last_seen_at", { ascending: false })
      .limit(80)
  ]);

  const normalizedInvoices = ((invoices || []) as unknown as FinanceInvoiceRow[]).map((invoice) => ({
    ...invoice,
    clients: one(invoice.clients)
  }));

  const model = buildFinanceClosingModel({
    periodMonth: selectedMonth,
    invoices: normalizedInvoices,
    events: (events || []) as FinanceEventRow[],
    approvals: (approvals || []) as FinanceApprovalRow[],
    closeState: (closePeriod || null) as FinanceClosePeriodState | null,
    taskStates: (closeTasks || []) as FinanceCloseTaskState[],
    exportRuns: (exportRuns || []) as FinanceExportRunRow[]
  });
  const presenceModel = buildOperationalPresenceModel({
    userId: ctx.userId,
    role: ctx.role,
    invoices: normalizedInvoices,
    events: (events || []) as FinanceEventRow[],
    approvals: (approvals || []) as FinanceApprovalRow[],
    exportRuns: (exportRuns || []) as FinanceExportRunRow[],
    closeTasks: ((closeTasks || []) as FinanceCloseTaskState[]).map((task) => ({
      ...task,
      period_month: selectedMonth
    })),
    sessions: (presenceSessions || []) as PresenceSessionRow[]
  });
  const presenceByEntity = new Map(presenceModel.entitySummaries.map((summary) => [summary.entityKey, summary]));
  const presenceByHref = presenceModel.entitySummaries.reduce((map, summary) => {
    const href = baseHref(summary.href);
    if (!map.has(href)) map.set(href, summary);
    return map;
  }, new Map<string, EntityPresenceSummary>());

  return (
    <AppShell>
      <OperationalPresenceHeartbeat
        scope="finance_close"
        entityType="finance_close"
        entityId={model.periodMonth}
        label={`Finance close ${model.periodLabel}`}
        targetHref={`/finance?m=${model.periodMonth}`}
      />
      <div className="q-dashboard-stack">
        <SettingsPageHeader
          title="Finance closing"
          subtitle="Month-end review, reconciliation visibility, accountant exports, and finance continuity. Operational only, with no tax or compliance claims."
          action={
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link className="btn btn-secondary btn-xs" href={`/finance?m=${previousMonth(model.periodMonth)}`}>
                Previous month
              </Link>
              <Link className="btn btn-secondary btn-xs" href={`/finance?m=${nextMonth(model.periodMonth)}`}>
                Next month
              </Link>
              <PrintButton label="Print close" className="btn btn-primary btn-xs" showIcon />
            </div>
          }
        />

        <section className="q-elevated bg-white/[0.82] p-6 backdrop-blur-md sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="q-section-label text-cedar">Close period</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="page-title">{model.periodLabel}</h1>
                {closeStatusBadge(model.closeState.status)}
              </div>
              <p className="q-subtitle mt-2 max-w-3xl">
                Built from invoices, accepted proofs, voids, approvals, payment plans, recovery events, and export logs. Calculations are shown so finance reviewers can trace every state.
              </p>
            </div>
            <form className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 lg:min-w-[360px]" action={updateFinanceCloseStatusAction}>
              <input name="period_month" type="hidden" value={model.periodMonth} />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select className="field h-10 text-xs" name="status" defaultValue={model.closeState.status} disabled={!canUpdateClose}>
                  <option value="draft">Draft</option>
                  <option value="in_review">In review</option>
                  <option value="signed_off">Signed off</option>
                  <option value="reopened">Reopened</option>
                </select>
                <button className="btn btn-secondary h-10 px-3 text-xs" type="submit" disabled={!canUpdateClose}>
                  Update
                </button>
              </div>
              <input className="field h-10 text-xs" name="notes" placeholder="Finance signoff note" defaultValue={model.closeState.notes || ""} disabled={!canUpdateClose} />
              <p className="text-[11px] text-slate-500">
                {model.closeState.signed_off_at ? `Signed off ${dateLabel(model.closeState.signed_off_at)}${model.closeState.signed_off_by_name ? ` by ${model.closeState.signed_off_by_name}` : ""}` : "No signoff recorded."}
              </p>
            </form>
          </div>
        </section>

        <OperationalPresenceStrip model={presenceModel} />

        <MetricGrid model={model} />

        {model.attention.length > 0 ? (
          <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {model.attention.map((item) => (
              <Link key={item.id} href={item.href} className={`q-surface-hover rounded-2xl border p-4 shadow-card ${item.severity === "risk" ? "border-rose-200 bg-rose-50/50" : "border-amber-200 bg-amber-50/55"}`}>
                <div className="flex items-center gap-2">
                  {item.severity === "risk" ? <ShieldCheck className="h-4 w-4 text-rose-700" aria-hidden /> : <ClipboardList className="h-4 w-4 text-amber-700" aria-hidden />}
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.detail}</p>
              </Link>
            ))}
          </section>
        ) : (
          <section className="rounded-3xl border border-emerald-200/70 bg-emerald-50/60 p-5 text-emerald-950 shadow-card">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden />
              <div>
                <p className="font-semibold">No finance attention warnings for this close period.</p>
                <p className="mt-1 text-sm text-emerald-900/80">Pending proofs, overdue exposure, void activity, and approvals are clear under the current rules.</p>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <CloseChecklist model={model} canUpdate={canUpdateClose} presenceByEntity={presenceByEntity} />
          <div className="grid content-start gap-5">
            <section className="panel">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-slate-500" aria-hidden />
                <h2 className="text-lg font-semibold text-ink">Close readiness</h2>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4">
                  <p className="q-section-label">Checklist completion</p>
                  <p className="mt-2 text-3xl font-semibold text-ink">{model.completion.percentage}%</p>
                  <p className="mt-1 text-sm text-slate-600">{model.completion.readyForSignoff ? "Ready for finance signoff." : "Open close tasks remain."}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="q-section-label">Unresolved tracking</p>
                  <p className="mt-2 text-xl font-semibold text-ink">{model.summary.unresolvedCount.toLocaleString()}</p>
                  <p className="mt-1 text-sm text-slate-600">Open balances, deposit gaps, plan balances, partials, overpayments, and voids remain traceable below.</p>
                </div>
              </div>
            </section>
            <FinanceTimeline model={model} />
          </div>
        </div>

        <ReconciliationReview model={model} presenceByHref={presenceByHref} />
        <ExportPackage model={model} canExport={canUpdateClose} />

        <section className="q-table-shell print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Printable operational finance summary</h2>
              <p className="mt-1 text-sm text-slate-500">For internal finance review and accountant handoff. It does not make tax, legal, or compliance claims.</p>
            </div>
            <Printer className="h-5 w-5 text-slate-400 print:hidden" aria-hidden />
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="q-section-label">Accepted proof rows</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{model.reconciliation.acceptedProofs.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="q-section-label">Payment-plan balances</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{model.reconciliation.paymentPlanBalances.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="q-section-label">Approval history rows</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{model.exports.find((row) => row.key === "approval_history")?.rows.length || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="q-section-label">Export datasets</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{model.exports.length}</p>
            </div>
          </div>
          <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
            Period: {model.periodStart.slice(0, 10)} to {model.periodEnd.slice(0, 10)}. Workspace: {ctx.workspaceName}.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
