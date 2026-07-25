import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { assignOperationalWorkAction } from "@/app/assignment-actions";
import { AssignmentInlineBadges } from "@/components/OperationalAssignmentPanel";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getAssignmentMembers, getAssignmentsForTargets } from "@/lib/assignment-data";
import { money, shortDate } from "@/lib/format";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission, ROLE_LABELS } from "@/lib/permissions";
import { parsePaymentPlan } from "@/lib/payment-plan";
import { paymentPlanProgress } from "@/lib/payment-plan";
import {
  computeRecoveryForInvoice,
  computeReminderStageOutcomes,
  recoveryKpis,
  recoveryNextActionLabel,
  recoveryTierLabel,
  responsivenessLabel,
  type InvoiceEventRow,
  type RecoveryComputation,
  type RecoveryInvoiceRow
} from "@/lib/recovery-engine";
import { reconcileInvoiceStatus } from "@/lib/status";
import { requireUser } from "@/lib/supabase/server";

function tierTone(tier: RecoveryComputation["tier"]) {
  if (tier === "critical") return "danger" as const;
  if (tier === "recovery_risk") return "recovery_risk" as const;
  if (tier === "attention") return "pending" as const;
  return "complete" as const;
}

function bucketTitle(b: RecoveryComputation["bucket"]) {
  if (b === "recent") return "Recently overdue";
  if (b === "aging") return "Aging overdue";
  return "Critical overdue";
}

export default async function RecoveriesPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  const anchor = new Date();
  anchor.setUTCDate(anchor.getUTCDate() - 120);
  const since = anchor.toISOString();

  const [{ data: invoices }, { data: events }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, client_id, status, created_at, document_type, currency, amount_usd, amount_lbp, due_date, valid_until, invoice_number, title, public_token, deposit_enabled, deposit_type, deposit_percent, deposit_amount_usd, deposit_amount_lbp, exchange_rate_lbp_per_usd, payment_plan, clients(name, phone, email), payment_proofs(status, amount_usd, amount_lbp, confirmed_at, uploaded_at)"
      )
      .eq("workspace_id", ctx.workspaceId)
      .order("due_date", { ascending: true }),
    supabase
      .from("invoice_events")
      .select("invoice_id, event_type, created_at, metadata")
      .eq("workspace_id", ctx.workspaceId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(4000)
  ]);

  const rows = (invoices || []) as RecoveryInvoiceRow[];
  const ev = (events || []) as InvoiceEventRow[];

  const allForStats = rows.map((inv) => ({
    ...inv,
    payment_proofs: inv.payment_proofs || []
  }));

  const computations: RecoveryComputation[] = [];
  for (const inv of rows) {
    const proofs = (inv.payment_proofs || []).map((p) => ({
      status: p.status || "",
      amount_usd: p.amount_usd,
      amount_lbp: p.amount_lbp
    }));
    const rec = computeRecoveryForInvoice({
      invoice: { ...inv, payment_proofs: inv.payment_proofs || [] },
      proofs,
      events: ev,
      allUserInvoices: allForStats
    });
    if (rec) computations.push(rec);
  }

  computations.sort((a, b) => b.priorityScore - a.priorityScore);

  const kpis = recoveryKpis(computations);
  const stageOutcomes = computeReminderStageOutcomes(ev);

  let plansAllMilestonesMarked = 0;
  for (const inv of rows) {
    const plan = parsePaymentPlan(inv.payment_plan);
    if (!plan) continue;
    const p = paymentPlanProgress(plan);
    if (p.total > 0 && p.remaining <= (inv.currency === "USD" ? 0.05 : 500)) plansAllMilestonesMarked += 1;
  }

  const byBucket = {
    recent: computations.filter((c) => c.bucket === "recent"),
    aging: computations.filter((c) => c.bucket === "aging"),
    critical: computations.filter((c) => c.bucket === "critical")
  };

  const invById = new Map(rows.map((i) => [i.id, i]));
  const assignmentMembers = await getAssignmentMembers(supabase, ctx.workspaceId);
  const recoveryAssignmentsByInvoice = await getAssignmentsForTargets({
    supabase,
    workspaceId: ctx.workspaceId,
    targetType: "recovery",
    targetIds: rows.map((row) => row.id),
    members: assignmentMembers
  });
  const canManageAssignments = hasPermission(ctx.role, "assignments.manage");

  return (
    <AppShell role={ctx.role}>
      <SettingsPageHeader
        title="Overdue recovery center"
        subtitle="Operational view of overdue balances, reminder history, and suggested next steps. Nothing here sends automatically."
        action={
          <Link className="btn btn-secondary text-xs" href="/invoices">
            Back to invoices
          </Link>
        }
      />

      <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="q-surface p-5">
          <p className="q-section-label">Overdue recoverable (USD)</p>
          <p className="q-kpi-secondary mt-2">{money(kpis.overdueRecoverableUsd, "USD")}</p>
        </div>
        <div className="q-surface p-5">
          <p className="q-section-label">Overdue recoverable (LBP)</p>
          <p className="q-kpi-secondary mt-2">{money(kpis.overdueRecoverableLbp, "LBP")}</p>
        </div>
        <div className="q-surface p-5">
          <p className="q-section-label">Avg days overdue (this list)</p>
          <p className="q-kpi-secondary mt-2">{kpis.avgDaysOverdue}</p>
        </div>
        <div className="q-surface p-5">
          <p className="q-section-label">Reminder copies (60d, listed)</p>
          <p className="q-kpi-secondary mt-2">{kpis.remindersLast60d}</p>
          <p className="q-caption mt-2">{kpis.partialCount} partial · {kpis.criticalCount} critical tier</p>
        </div>
      </div>

      <div className="mb-7 grid gap-5 lg:grid-cols-2">
        <section className="q-surface p-5">
          <h2 className="q-section-label">Recovery funnel (buckets)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>Recently overdue</span>
              <span className="font-semibold">{byBucket.recent.length}</span>
            </li>
            <li className="flex justify-between">
              <span>Aging overdue</span>
              <span className="font-semibold">{byBucket.aging.length}</span>
            </li>
            <li className="flex justify-between">
              <span>Critical overdue</span>
              <span className="font-semibold">{byBucket.critical.length}</span>
            </li>
            <li className="flex justify-between border-t border-slate-100 pt-2">
              <span>Manual plans — milestones all marked</span>
              <span className="font-semibold">{plansAllMilestonesMarked}</span>
            </li>
          </ul>
        </section>

        <section className="q-surface p-5">
          <h2 className="q-section-label">Reminder stages → payments within 7d</h2>
          <p className="mt-1 text-xs text-slate-500">
            Counts proof acceptance or manual payment recorded after a reminder copy on the same invoice (observed order
            only).
          </p>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
            {Object.keys(stageOutcomes).length === 0 ? (
              <li className="text-slate-500">No reminder or payment events in the selected window.</li>
            ) : (
              Object.entries(stageOutcomes).map(([stage, o]) => (
                <li key={stage} className="flex justify-between gap-2">
                  <span className="truncate font-medium text-ink">{stage}</span>
                  <span className="shrink-0 text-slate-600">
                    {o.paymentsWithin7DaysAfter}/{o.reminderCopies} payments after copy
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      {(["recent", "aging", "critical"] as const).map((bucket) => {
        const list = byBucket[bucket];
        if (!list.length) return null;
        return (
          <section key={bucket} className="mb-8">
            <h2 className="q-headline mb-4">{bucketTitle(bucket)}</h2>
            <div className="grid gap-4">
              {list.map((c) => {
                const inv = invById.get(c.invoiceId);
                if (!inv) return null;
                const primary = (inv.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
                const overdueLabel =
                  primary === "USD" ? money(c.overdueAmountUsd, "USD") : money(c.overdueAmountLbp, "LBP");
                const plan = parsePaymentPlan(inv.payment_plan);
                const planProg = plan ? paymentPlanProgress(plan) : null;
                const proofs = inv.payment_proofs || [];
                const recoveryAssignments = recoveryAssignmentsByInvoice.get(inv.id) || [];
                const pendingProofs = proofs.filter((p) => (p.status || "").toLowerCase() === "pending").length;
                const acceptedProofs = proofs.filter((p) => (p.status || "") === "accepted").length;
                const recStatus = reconcileInvoiceStatus(inv, proofs.map((p) => ({ status: p.status || "", amount_usd: p.amount_usd, amount_lbp: p.amount_lbp })));

                return (
                  <div
                    key={c.invoiceId}
                    className="q-surface-hover overflow-hidden rounded-2xl border border-slate-200/60 bg-white/95 shadow-card"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={tierTone(c.tier)} label={recoveryTierLabel(c.tier)} />
                          <span className="text-xs font-semibold text-slate-500">Rule-based tier</span>
                        </div>
                        <p className="mt-2 font-semibold text-ink">
                          {inv.invoice_number ? `${inv.invoice_number} · ` : ""}
                          {inv.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{inv.clients?.name || "No client"}</p>
                        <AssignmentInlineBadges assignments={recoveryAssignments} />
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-bold text-ink">{overdueLabel}</p>
                        <p className="text-slate-500">{c.daysOverdue} days overdue</p>
                        <Link className="mt-2 inline-block text-xs font-bold text-cedar underline" href={`/invoices/${inv.id}`}>
                          Open invoice
                        </Link>
                      </div>
                    </div>
                    <div className="grid gap-4 p-4 md:grid-cols-2">
                      <div className="text-sm text-slate-700">
                        <p>
                          <span className="font-semibold text-ink">Last reminder: </span>
                          {c.lastReminderAt ? shortDate(c.lastReminderAt) : "—"}
                          {c.lastReminderStage ? ` (${c.lastReminderStage})` : ""}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-ink">Last payment activity: </span>
                          {c.lastPaymentAt ? shortDate(c.lastPaymentAt) : "—"}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-ink">Proof activity: </span>
                          {acceptedProofs} accepted · {pendingProofs} pending
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-ink">Deposit: </span>
                          {c.depositSatisfied ? "Deposit requirement satisfied" : "Deposit not fully satisfied"}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold text-ink">Client pattern: </span>
                          {responsivenessLabel(c.responsiveness)}
                        </p>
                        {c.responsivenessReasons.length ? (
                          <ul className="mt-2 list-inside list-disc text-xs text-slate-600">
                            {c.responsivenessReasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Suggested next steps</p>
                        <ul className="mt-2 list-inside list-decimal text-sm text-slate-700">
                          {c.nextActions.map((a) => (
                            <li key={a}>{recoveryNextActionLabel(a)}</li>
                          ))}
                        </ul>
                        {planProg && plan ? (
                          <p className="mt-3 text-xs text-slate-600">
                            Payment plan: {money(primary === "USD" ? planProg.satisfied : planProg.satisfied, primary)} paid of{" "}
                            {money(primary === "USD" ? planProg.total : planProg.total, primary)} · Next milestone{" "}
                            {planProg.next
                              ? money(
                                  primary === "USD" ? Number(planProg.next.amount_usd || 0) : Number(planProg.next.amount_lbp || 0),
                                  primary
                                )
                              : "—"}
                          </p>
                        ) : null}
                        {c.viewedAfterReminder ? (
                          <p className="mt-2 text-xs text-amber-800">Client viewed the receipt page after the last recorded reminder copy.</p>
                        ) : null}
                        <p className="mt-2 text-[11px] text-slate-500">Reconciled status: {recStatus}</p>
                        {canManageAssignments ? (
                          <form action={assignOperationalWorkAction} className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                            <input name="target_type" type="hidden" value="recovery" />
                            <input name="target_id" type="hidden" value={inv.id} />
                            <input name="assignment_type" type="hidden" value="recovery_owner" />
                            <input name="priority" type="hidden" value={c.tier === "critical" ? "urgent" : c.tier === "recovery_risk" ? "high" : "normal"} />
                            <select className="field h-9 max-w-[220px] text-xs" name="assignee" defaultValue={assignmentMembers[0] ? `user:${assignmentMembers[0].userId}` : "role:operations"}>
                              {assignmentMembers.length > 0 ? (
                                <optgroup label="People">
                                  {assignmentMembers.map((member) => (
                                    <option key={member.userId} value={`user:${member.userId}`}>
                                      {member.name} ({ROLE_LABELS[member.role]})
                                    </option>
                                  ))}
                                </optgroup>
                              ) : null}
                              <optgroup label="Roles">
                                <option value="role:operations">Operations</option>
                                <option value="role:finance">Finance</option>
                              </optgroup>
                            </select>
                            <button className="btn btn-secondary h-9 px-3 text-xs" type="submit">
                              Assign recovery
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {computations.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 p-12 text-center text-slate-600">
          <p className="font-semibold text-ink">No overdue balances right now</p>
          <p className="mt-2.5 text-sm">When an invoice is past due with an open balance, it will appear here with recovery context.</p>
        </div>
      ) : null}
    </AppShell>
  );
}
