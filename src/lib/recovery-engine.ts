
import {
  deriveRecoveryEngineCurrencyResult,
  RECOVERY_USD_AMOUNT_PRIORITY_THRESHOLD,
  type RecoveryEngineCurrencyCandidateFact,
  type RecoveryEngineCurrencyResult
} from "@/lib/recovery-engine-currency-summary";

export type RecoveryEngineCurrencyModelInput = {
  workspaceId: string;
  invoices: RecoveryInvoiceRow[];
  events: InvoiceEventRow[];
  nowMs: number;
};

export function deriveRecoveryEngineCurrencyModel(input: RecoveryEngineCurrencyModelInput): RecoveryEngineCurrencyResult {
  const invoices = input.invoices.filter((invoice) => invoice.workspace_id === input.workspaceId);
  const statsMap = computeClientPaymentStats(invoices);
  const facts: RecoveryEngineCurrencyCandidateFact[] = [];

  for (const invoice of invoices) {
    if (invoice.document_type && String(invoice.document_type).toLowerCase() === "quote") continue;
    const proofs = toMinimalProofs(invoice.payment_proofs);
    const status = reconcileInvoiceStatus(invoice, proofs);
    const remaining = getRemainingBalance(invoice, proofs);
    const due = invoice.due_date ? new Date(invoice.due_date + "T12:00:00") : null;
    const daysOverdue = due && Number.isFinite(due.getTime()) ? Math.max(0, Math.floor((input.nowMs - due.getTime()) / 86400000)) : 0;
    if (daysOverdue <= 0 || status === "paid" || status === "draft" || status === "rejected") continue;
    const currency = (invoice.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
    const outstanding = currency === "USD" ? remaining.usd : remaining.lbp;
    if (outstanding <= 0) continue;

    const invoiceEvents = input.events.filter((event) => event.invoice_id === invoice.id);
    const reminders = invoiceEvents.filter((event) => event.event_type === "reminder_copied");
    const lastReminder = reminders.reduce((best, event) => !best || parseEventTime(event.created_at) > parseEventTime(best.created_at) ? event : best, null as InvoiceEventRow | null);
    const payments = invoiceEvents.filter((event) => ["proof_accepted", "manual_payment", "payment_received", "payment_confirmed", "payment_recorded"].includes(event.event_type));
    const lastPayment = payments.reduce((best, event) => !best || parseEventTime(event.created_at) > parseEventTime(best.created_at) ? event : best, null as InvoiceEventRow | null);
    const reminderCopiedCount60d = reminders.filter((event) => {
      const timestamp = parseEventTime(event.created_at);
      return timestamp > 0 && input.nowMs - timestamp <= 60 * 86400000;
    }).length;
    const lastReminderAt = lastReminder?.created_at ?? null;
    const lastReminderStage = lastReminder?.metadata && typeof lastReminder.metadata === "object" && "stage" in lastReminder.metadata ? String(lastReminder.metadata.stage || "") || null : null;
    const lastView = invoiceEvents.filter((event) => event.event_type === "receipt_viewed").reduce((best, event) => !best || parseEventTime(event.created_at) > parseEventTime(best.created_at) ? event : best, null as InvoiceEventRow | null);
    const viewedAfterReminder = Boolean(lastReminderAt && lastView && parseEventTime(lastView.created_at) >= parseEventTime(lastReminderAt));
    const depositRequest = getDepositRequest(invoice);
    const depositStatus = getDepositStatus(invoice, proofs);
    const clientId = invoice.client_id || "";
    const stats = clientId ? statsMap.get(clientId) : undefined;
    const isRepeatClient = invoices.some((other) => other.id !== invoice.id && other.client_id === clientId && reconcileInvoiceStatus(other, toMinimalProofs(other.payment_proofs)) === "paid");
    const validUntil = invoice.valid_until ? parseEventTime(invoice.valid_until + "T12:00:00") : 0;
    const linkExpired = Boolean(invoice.valid_until) && parseEventTime(invoice.valid_until + "T23:59:59") < input.nowMs;
    facts.push({
      candidateKey: invoice.id, currency, outstanding, daysOverdue,
      workspaceMatched: invoice.workspace_id === input.workspaceId, eligibleForRecovery: true,
      amountPriorityRatio: currency === "USD" ? outstanding / RECOVERY_USD_AMOUNT_PRIORITY_THRESHOLD : null,
      lastReminderAt, lastReminderStage, lastPaymentAt: lastPayment?.created_at ?? null, reminderCopiedCount60d,
      viewedAfterReminder, partialPaymentsObserved: status === "partial",
      depositSatisfied: Boolean(depositRequest && depositStatus && depositStatus.label !== "Not paid"),
      isRepeatClient, avgDaysToPay: stats?.avgDaysToPay ?? null, paidCount: stats?.paidCount ?? 0,
      partialInvoiceCount: stats?.partialInvoiceCount ?? 0, pendingProof: proofs.some((proof) => proof.status.toLowerCase() === "pending"),
      hasValidity: Boolean(invoice.valid_until), linkExpired,
      daysUntilLinkExpiry: validUntil > input.nowMs ? Math.max(0, Math.floor((validUntil - input.nowMs) / 86400000)) : null
    });
  }
  return deriveRecoveryEngineCurrencyResult({ candidates: facts, nowMs: input.nowMs });
}
import type { InvoiceStatus } from "@/lib/types";
import { finiteN } from "@/lib/safe-metrics";
import { getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import { getDepositRequest, getDepositStatus } from "@/lib/deposit";
import type { InvoicePaymentPlan } from "@/lib/payment-plan";
import { paymentPlanProgress } from "@/lib/payment-plan";

export type OverdueBucket = "recent" | "aging" | "critical";

export type RecoveryTier = "low_risk" | "attention" | "recovery_risk" | "critical";

export type RecoveryNextAction =
  | "send_gentle_reminder"
  | "offer_split_payment"
  | "extend_validity"
  | "regenerate_payment_link"
  | "follow_up_whatsapp"
  | "wait_recently_reminded"
  | "review_pending_proof_first";

export type ClientResponsiveness =
  | "unknown"
  | "usually_pays_quickly"
  | "slow_responder"
  | "often_pays_after_reminders"
  | "usually_partial_first"
  | "high_trust_repeat";

export type InvoiceEventRow = {
  invoice_id: string;
  event_type: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

/** Invoice row shape used by recovery (matches Supabase select + nested proofs). */
export type RecoveryInvoiceRow = {
  workspace_id?: string | null;
  id: string;
  client_id?: string | null;
  status: InvoiceStatus;
  created_at?: string | null;
  invoice_number?: string | null;
  title?: string | null;
  public_token?: string | null;
  document_type?: string | null;
  currency?: string | null;
  amount_usd?: number | null;
  amount_lbp?: number | null;
  due_date?: string | null;
  valid_until?: string | null;
  deposit_enabled?: boolean | null;
  deposit_type?: string | null;
  deposit_percent?: number | null;
  deposit_amount_usd?: number | null;
  deposit_amount_lbp?: number | null;
  deposit_note?: string | null;
  exchange_rate_lbp_per_usd?: number | null;
  payment_plan?: unknown;
  clients?: { name?: string | null; phone?: string | null; email?: string | null } | null;
  payment_proofs?: MinimalProof[] | null;
};

export type RecoveryComputation = {
  invoiceId: string;
  daysOverdue: number;
  bucket: OverdueBucket;
  /** Higher = more operational attention needed (deterministic weights on observed data). */
  priorityScore: number;
  tier: RecoveryTier;
  overdueAmountUsd: number;
  overdueAmountLbp: number;
  lastReminderAt: string | null;
  lastReminderStage: string | null;
  lastPaymentAt: string | null;
  reminderCopiedCount60d: number;
  viewedAfterReminder: boolean;
  partialPaymentsObserved: boolean;
  depositSatisfied: boolean;
  isRepeatClient: boolean;
  nextActions: RecoveryNextAction[];
  responsiveness: ClientResponsiveness;
  responsivenessReasons: string[];
};

function tierFromScore(score: number): RecoveryTier {
  if (score >= 70) return "critical";
  if (score >= 45) return "recovery_risk";
  if (score >= 25) return "attention";
  return "low_risk";
}

function bucketFromDays(days: number): OverdueBucket {
  if (days >= 30) return "critical";
  if (days >= 8) return "aging";
  return "recent";
}

function parseEventTime(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return Number.isFinite(t) ? t : 0;
}

function withinDays(iso: string, days: number): boolean {
  const t = parseEventTime(iso);
  if (!t) return false;
  return Date.now() - t <= days * 86400000;
}

function isFullyPaidStatus(status: InvoiceStatus): boolean {
  return status === "paid";
}

function toMinimalProofs(
  proofs: { status?: string | null; amount_usd?: number | null; amount_lbp?: number | null; confirmed_at?: string | null; uploaded_at?: string | null }[] | null | undefined
): MinimalProof[] {
  return (proofs || []).map((p) => ({
    status: p.status || "",
    amount_usd: p.amount_usd,
    amount_lbp: p.amount_lbp
  }));
}

function inferLastSettlementTimeMs(inv: {
  payment_proofs?: { status?: string | null; confirmed_at?: string | null; uploaded_at?: string | null }[] | null;
}): number | null {
  const accepted = (inv.payment_proofs || []).filter((p) => (p.status || "") === "accepted");
  if (!accepted.length) return null;
  const times = accepted
    .map((p) => parseEventTime(p.confirmed_at || "") || parseEventTime(p.uploaded_at || ""))
    .filter(Boolean);
  if (!times.length) return null;
  return Math.max(...times);
}

export type ClientPaymentStats = {
  paidCount: number;
  avgDaysToPay: number | null;
  partialInvoiceCount: number;
};

export function computeClientPaymentStats(
  invoices: RecoveryInvoiceRow[]
): Map<string, ClientPaymentStats> {
  const acc = new Map<
    string,
    { paidCount: number; sumDays: number; daySamples: number; partialInvoiceCount: number }
  >();
  for (const inv of invoices) {
    const cid = inv.client_id;
    if (!cid) continue;
    const proofs = toMinimalProofs(inv.payment_proofs);
    const rec = reconcileInvoiceStatus(inv, proofs);
    const row = acc.get(cid) || { paidCount: 0, sumDays: 0, daySamples: 0, partialInvoiceCount: 0 };
    if (rec === "partial") row.partialInvoiceCount += 1;
    if (rec === "paid") {
      row.paidCount += 1;
      const start = parseEventTime(inv.created_at || "");
      const paidAt = inferLastSettlementTimeMs(inv);
      if (start && paidAt && paidAt >= start) {
        row.sumDays += (paidAt - start) / 86400000;
        row.daySamples += 1;
      }
    }
    acc.set(cid, row);
  }
  const out = new Map<string, ClientPaymentStats>();
  for (const [cid, r] of acc) {
    out.set(cid, {
      paidCount: r.paidCount,
      avgDaysToPay: r.daySamples ? r.sumDays / r.daySamples : null,
      partialInvoiceCount: r.partialInvoiceCount
    });
  }
  return out;
}

export function computeRecoveryForInvoice(input: {
  invoice: RecoveryInvoiceRow;
  proofs: MinimalProof[];
  events: InvoiceEventRow[];
  allUserInvoices: RecoveryInvoiceRow[];
}): RecoveryComputation | null {
  const { invoice, proofs, events, allUserInvoices } = input;
  if (invoice.document_type && String(invoice.document_type).toLowerCase() === "quote") return null;

  const status = reconcileInvoiceStatus(invoice, proofs);
  const remaining = getRemainingBalance(invoice, proofs);
  const due = invoice.due_date ? new Date(invoice.due_date + "T12:00:00") : null;
  if (!due) return null;
  const today = new Date();
  const daysOverdue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
  if (daysOverdue <= 0) return null;
  if (status === "paid" || status === "draft" || status === "rejected") return null;
  if (remaining.usd <= 0 && remaining.lbp <= 0) return null;

  const bucket = bucketFromDays(daysOverdue);
  const primary = (invoice.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
  const overdueAmountUsd = primary === "USD" ? remaining.usd : 0;
  const overdueAmountLbp = primary === "LBP" ? remaining.lbp : 0;
  const rate = finiteN(Number(invoice.exchange_rate_lbp_per_usd || 0)) || 90000;
  const amountRef = primary === "USD" ? overdueAmountUsd : overdueAmountLbp / rate;

  const invEvents = events.filter((e) => e.invoice_id === invoice.id);
  const reminderEvents = invEvents.filter((e) => e.event_type === "reminder_copied");
  const lastReminder = reminderEvents.reduce(
    (best, e) => (!best || parseEventTime(e.created_at) > parseEventTime(best.created_at) ? e : best),
    null as InvoiceEventRow | null
  );
  const lastReminderAt = lastReminder?.created_at ?? null;
  const lastReminderStage =
    lastReminder?.metadata && typeof lastReminder.metadata === "object" && "stage" in lastReminder.metadata!
      ? String((lastReminder.metadata as Record<string, unknown>).stage || "")
      : null;

  const reminderCopiedCount60d = reminderEvents.filter((e) => withinDays(e.created_at, 60)).length;

  const lastReceiptView = invEvents
    .filter((e) => e.event_type === "receipt_viewed")
    .reduce(
      (best, e) => (!best || parseEventTime(e.created_at) > parseEventTime(best.created_at) ? e : best),
      null as InvoiceEventRow | null
    );
  const lastReminderTs = parseEventTime(lastReminderAt || "");
  const lastViewTs = parseEventTime(lastReceiptView?.created_at || "");
  const viewedAfterReminder = Boolean(
    lastReminderTs && lastViewTs && lastViewTs >= lastReminderTs && !isFullyPaidStatus(status)
  );

  const paymentEvents = invEvents.filter((e) =>
    ["proof_accepted", "manual_payment", "payment_received", "payment_confirmed", "payment_recorded"].includes(
      e.event_type
    )
  );
  const lastPayment = paymentEvents.reduce(
    (best, e) => (!best || parseEventTime(e.created_at) > parseEventTime(best.created_at) ? e : best),
    null as InvoiceEventRow | null
  );

  const partialPaymentsObserved = status === "partial";

  const depositReq = getDepositRequest(invoice);
  const depositStatusNow = getDepositStatus(invoice, proofs);
  const depositSatisfied = Boolean(depositReq && depositStatusNow && depositStatusNow.label !== "Not paid");

  const clientId = invoice.client_id || "";
  const statsMap = computeClientPaymentStats(allUserInvoices);
  const stats = clientId ? statsMap.get(clientId) : undefined;

  const sameClient = allUserInvoices.filter((i) => i.client_id && i.client_id === clientId && i.id !== invoice.id);
  const isRepeatClient = sameClient.some((i) => isFullyPaidStatus(reconcileInvoiceStatus(i, toMinimalProofs(i.payment_proofs))));

  const avgDays = stats?.avgDaysToPay ?? null;

  let score = 0;
  score += Math.min(40, (Math.min(daysOverdue, 120) / 120) * 40);
  score += Math.min(25, (Math.min(amountRef, primary === "USD" ? 8000 : 90) / (primary === "USD" ? 8000 : 90)) * 25);
  score += Math.min(15, reminderCopiedCount60d * 5);
  if (viewedAfterReminder) score += 12;
  if (partialPaymentsObserved) score += 5;
  if (depositSatisfied && depositReq) score -= 8;
  if (isRepeatClient) score -= 6;
  if (avgDays != null && avgDays > 14) score += 8;
  if (avgDays != null && avgDays <= 3 && (stats?.paidCount || 0) >= 2) score -= 8;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier = tierFromScore(score);

  const pendingProof = proofs.some((p) => {
    const s = (p.status || "").toLowerCase();
    return s === "pending";
  });

  const linkExpired =
    Boolean(invoice.valid_until) && parseEventTime(`${invoice.valid_until}T23:59:59`) < Date.now();

  const validUntilMs = invoice.valid_until ? parseEventTime(`${invoice.valid_until}T12:00:00`) : 0;
  const daysUntilLinkExpiry =
    validUntilMs && validUntilMs > Date.now()
      ? Math.max(0, Math.floor((validUntilMs - Date.now()) / 86400000))
      : null;

  const nextActions: RecoveryNextAction[] = [];
  if (pendingProof) nextActions.push("review_pending_proof_first");
  if (lastReminderAt && withinDays(lastReminderAt, 2) && reminderCopiedCount60d > 0) {
    nextActions.push("wait_recently_reminded");
  } else {
    nextActions.push("send_gentle_reminder");
    if (daysOverdue >= 5) nextActions.push("follow_up_whatsapp");
  }
  if (daysOverdue >= 7) nextActions.push("offer_split_payment");
  if (daysOverdue >= 14 && !invoice.valid_until) nextActions.push("extend_validity");
  if (daysOverdue >= 10 && (linkExpired || (daysUntilLinkExpiry != null && daysUntilLinkExpiry <= 7))) {
    nextActions.push("extend_validity");
  }
  if (linkExpired) {
    nextActions.push("regenerate_payment_link");
  }

  const responsivenessReasons: string[] = [];
  let responsiveness: ClientResponsiveness = "unknown";
  if ((stats?.partialInvoiceCount || 0) >= 2) {
    responsiveness = "usually_partial_first";
    responsivenessReasons.push("This client has multiple invoices that were or are in a partial payment state.");
  } else if (isRepeatClient && (stats?.paidCount || 0) >= 2 && avgDays != null && avgDays <= 10) {
    responsiveness = "high_trust_repeat";
    responsivenessReasons.push("Repeat client with multiple completed payments on record.");
  } else if ((stats?.paidCount || 0) >= 2 && avgDays != null && avgDays <= 5) {
    responsiveness = "usually_pays_quickly";
    responsivenessReasons.push("Past invoices for this client were marked paid within a few days on average.");
  } else if (avgDays != null && avgDays > 14 && (stats?.paidCount || 0) >= 1) {
    responsiveness = "slow_responder";
    responsivenessReasons.push("Past invoices for this client took longer than two weeks to reach paid on average.");
  }
  if (reminderCopiedCount60d >= 2 && !isFullyPaidStatus(status)) {
    if (responsiveness === "unknown") responsiveness = "often_pays_after_reminders";
    responsivenessReasons.push("Multiple reminder copies were recorded for this invoice in the last 60 days.");
  }

  return {
    invoiceId: invoice.id,
    daysOverdue,
    bucket,
    priorityScore: score,
    tier,
    overdueAmountUsd,
    overdueAmountLbp,
    lastReminderAt,
    lastReminderStage,
    lastPaymentAt: lastPayment?.created_at ?? null,
    reminderCopiedCount60d,
    viewedAfterReminder,
    partialPaymentsObserved,
    depositSatisfied,
    isRepeatClient,
    nextActions: Array.from(new Set(nextActions)),
    responsiveness,
    responsivenessReasons
  };
}

export function recoveryTierLabel(tier: RecoveryTier): string {
  switch (tier) {
    case "low_risk":
      return "Low risk";
    case "attention":
      return "Attention needed";
    case "recovery_risk":
      return "Recovery risk";
    case "critical":
      return "Critical recovery";
    default:
      return "Attention needed";
  }
}

export function recoveryNextActionLabel(action: RecoveryNextAction): string {
  switch (action) {
    case "send_gentle_reminder":
      return "Send a gentle reminder";
    case "offer_split_payment":
      return "Offer a split payment (manual milestones)";
    case "extend_validity":
      return "Extend link validity";
    case "regenerate_payment_link":
      return "Regenerate payment link";
    case "follow_up_whatsapp":
      return "Follow up on WhatsApp (copy + open)";
    case "wait_recently_reminded":
      return "Wait — reminder was copied recently";
    case "review_pending_proof_first":
      return "Review pending proof first";
    default:
      return "Review invoice";
  }
}

export function responsivenessLabel(r: ClientResponsiveness): string {
  switch (r) {
    case "usually_pays_quickly":
      return "Usually settles quickly";
    case "slow_responder":
      return "Historically slower to settle";
    case "often_pays_after_reminders":
      return "Frequent reminders on this file";
    case "usually_partial_first":
      return "Often partial before full payment";
    case "high_trust_repeat":
      return "Repeat client with solid paid history";
    case "unknown":
    default:
      return "Not enough history yet";
  }
}

export function recoveryKpis(rows: RecoveryComputation[]): {
  overdueRecoverableUsd: number;
  overdueRecoverableLbp: number;
  avgDaysOverdue: number;
  remindersLast60d: number;
  partialCount: number;
  criticalCount: number;
} {
  let overdueRecoverableUsd = 0;
  let overdueRecoverableLbp = 0;
  let sumDays = 0;
  let remindersLast60d = 0;
  let partialCount = 0;
  let criticalCount = 0;
  for (const r of rows) {
    overdueRecoverableUsd += finiteN(r.overdueAmountUsd);
    overdueRecoverableLbp += finiteN(r.overdueAmountLbp);
    sumDays += r.daysOverdue;
    remindersLast60d += r.reminderCopiedCount60d;
    if (r.partialPaymentsObserved) partialCount += 1;
    if (r.tier === "critical") criticalCount += 1;
  }
  const n = rows.length || 1;
  return {
    overdueRecoverableUsd,
    overdueRecoverableLbp,
    avgDaysOverdue: Math.round((sumDays / n) * 10) / 10,
    remindersLast60d,
    partialCount,
    criticalCount
  };
}

export function formatPlanRemainingSummary(plan: InvoicePaymentPlan | null, currency: "USD" | "LBP"): string | null {
  if (!plan) return null;
  const p = paymentPlanProgress(plan);
  if (p.total <= 0) return null;
  const rem = currency === "USD" ? p.remaining : Math.round(p.remaining);
  return currency === "USD" ? `$${rem.toFixed(2)} remaining across milestones` : `LBP ${rem.toLocaleString()} remaining across milestones`;
}

/** Counts observed sequences per invoice: payment after a reminder within 7 days attributes to that reminder's stage. */
export function computeReminderStageOutcomes(events: InvoiceEventRow[]): Record<
  string,
  { reminderCopies: number; paymentsWithin7DaysAfter: number }
> {
  const byInvoice = new Map<string, InvoiceEventRow[]>();
  for (const e of events) {
    const arr = byInvoice.get(e.invoice_id) || [];
    arr.push(e);
    byInvoice.set(e.invoice_id, arr);
  }
  const stageStats = new Map<string, { reminderCopies: number; paymentsWithin7DaysAfter: number }>();

  for (const arr of byInvoice.values()) {
    const sorted = [...arr].sort((a, b) => parseEventTime(a.created_at) - parseEventTime(b.created_at));
    const reminders: { t: number; stage: string }[] = [];
    for (const e of sorted) {
      if (e.event_type === "reminder_copied") {
        const stage =
          e.metadata && typeof e.metadata === "object" && "stage" in e.metadata!
            ? String((e.metadata as Record<string, unknown>).stage || "unspecified")
            : "unspecified";
        const t = parseEventTime(e.created_at);
        reminders.push({ t, stage });
        const cur = stageStats.get(stage) || { reminderCopies: 0, paymentsWithin7DaysAfter: 0 };
        cur.reminderCopies += 1;
        stageStats.set(stage, cur);
      } else if (["proof_accepted", "manual_payment"].includes(e.event_type)) {
        const t = parseEventTime(e.created_at);
        let best: { t: number; stage: string } | null = null;
        for (const r of reminders) {
          if (r.t <= t && t - r.t <= 7 * 86400000) {
            if (!best || r.t > best.t) best = r;
          }
        }
        if (best) {
          const cur = stageStats.get(best.stage) || { reminderCopies: 0, paymentsWithin7DaysAfter: 0 };
          cur.paymentsWithin7DaysAfter += 1;
          stageStats.set(best.stage, cur);
        }
      }
    }
  }
  return Object.fromEntries(stageStats);
}
