import { getDepositRequest, getDepositStatus } from "@/lib/deposit";
import { documentStatus, isQuoteDocument } from "@/lib/documents";
import { formatPaymentMethod, money, shortDate } from "@/lib/format";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import type { InvoiceStatus } from "@/lib/types";
import type { OCEventRow, OCInvoiceProof, OCInvoiceRow } from "@/lib/operations-center";

const MS_DAY = 86400000;
const MS_HOUR = 3600000;

export type WorkflowSectionKey =
  | "urgent_proof_reviews"
  | "overdue_recoveries"
  | "expiring_invoices"
  | "clients_awaiting_response"
  | "unpaid_deposits"
  | "stale_quotes"
  | "follow_up_opportunities";

export type WorkflowPriorityTier = "focus_now" | "high_priority" | "steady_followup" | "cleanup";

export type SuggestedActionKind =
  | "review_pending_proof"
  | "send_gentle_reminder"
  | "send_recovery_reminder"
  | "request_deposit"
  | "extend_validity"
  | "regenerate_pay_link"
  | "create_payment_plan"
  | "thank_after_payment"
  | "follow_up_overdue_invoice"
  | "follow_up_quote"
  | "finish_stale_draft"
  | "wait_recent_reminder"
  | "contact_recently_active_client";

export type SuggestedNextAction = {
  id: string;
  kind: SuggestedActionKind;
  title: string;
  explanation: string;
  ctaLabel: string;
  href: string;
  section: WorkflowSectionKey;
  tier: WorkflowPriorityTier;
  invoiceId?: string;
  clientId?: string;
  proofId?: string;
  amountLabel?: string | null;
  meta: string[];
  /** Internal deterministic sort only. Never display as an AI score. */
  internalSort: number;
};

export type WorkflowSection = {
  key: WorkflowSectionKey;
  title: string;
  subtitle: string;
  items: SuggestedNextAction[];
};

export type OperationalInsight = {
  id: string;
  title: string;
  detail: string;
  basis: string;
  tone: "info" | "good" | "attention";
};

export type WorkloadSuggestion = {
  id: string;
  title: string;
  detail: string;
  href: string;
  ctaLabel: string;
  tone: "attention" | "cleanup" | "info";
};

export type WorkflowAssistantModel = {
  actions: SuggestedNextAction[];
  focusNow: SuggestedNextAction[];
  sections: WorkflowSection[];
  insights: OperationalInsight[];
  workload: WorkloadSuggestion[];
};

export type ReminderAssistItem = {
  id: string;
  label: string;
  detail: string;
  tone: "attention" | "good" | "info" | "wait";
};

export const WORKFLOW_SECTION_ORDER: WorkflowSectionKey[] = [
  "urgent_proof_reviews",
  "overdue_recoveries",
  "expiring_invoices",
  "clients_awaiting_response",
  "unpaid_deposits",
  "stale_quotes",
  "follow_up_opportunities"
];

const SECTION_COPY: Record<WorkflowSectionKey, { title: string; subtitle: string }> = {
  urgent_proof_reviews: {
    title: "Urgent proof reviews",
    subtitle: "Payment uploads that still need a manual accept or reject decision."
  },
  overdue_recoveries: {
    title: "Overdue recoveries",
    subtitle: "Open balances past due, sorted by age, balance size, and follow-up state."
  },
  expiring_invoices: {
    title: "Expiring invoices",
    subtitle: "Payment pages where the validity window is expired or close to ending."
  },
  clients_awaiting_response: {
    title: "Clients awaiting response",
    subtitle: "Clients who were recently reminded, viewed a page, or need a calm next touch."
  },
  unpaid_deposits: {
    title: "Unpaid deposits",
    subtitle: "Deposit requests that remain unpaid before the work can move cleanly."
  },
  stale_quotes: {
    title: "Stale quotes",
    subtitle: "Quotes and drafts that are old enough to finish, follow up, or close."
  },
  follow_up_opportunities: {
    title: "Follow-up opportunities",
    subtitle: "Low-friction thank-yous, due-soon nudges, payment plans, and cleanup actions."
  }
};

function num(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isFinite(t) ? t : null;
}

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function daysUntilDate(value: string | null | undefined): number | null {
  const t = parseTime(value);
  if (t === null) return null;
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfTodayMs()) / MS_DAY);
}

function daysSinceDate(value: string | null | undefined): number | null {
  const t = parseTime(value);
  if (t === null) return null;
  return Math.max(0, Math.floor((Date.now() - t) / MS_DAY));
}

function hoursSince(value: string | null | undefined): number | null {
  const t = parseTime(value);
  if (t === null) return null;
  return Math.max(0, Math.floor((Date.now() - t) / MS_HOUR));
}

function ageLabelFromHours(hours: number | null): string {
  if (hours === null) return "age unknown";
  if (hours < 24) return `${hours}h old`;
  const days = Math.floor(hours / 24);
  return `${days}d old`;
}

function daysPastLabel(days: number): string {
  if (days <= 0) return "past due";
  if (days === 1) return "1 day past due";
  return `${days} days past due`;
}

function primaryCurrency(inv: OCInvoiceRow | { currency?: string | null }): "USD" | "LBP" {
  return (inv.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
}

function invoiceTitle(inv: Partial<OCInvoiceRow>): string {
  const title = inv.title || "Invoice";
  return inv.invoice_number ? `${inv.invoice_number} - ${title}` : title;
}

function rowProofs(inv: { payment_proofs?: OCInvoiceProof[] | MinimalProof[] | null }): MinimalProof[] {
  return (inv.payment_proofs || []).map((p) => ({
    status: p.status || "",
    amount_usd: p.amount_usd === null || p.amount_usd === undefined ? null : Number(p.amount_usd),
    amount_lbp: p.amount_lbp === null || p.amount_lbp === undefined ? null : Number(p.amount_lbp)
  }));
}

function reconciled(inv: OCInvoiceRow): InvoiceStatus {
  return reconcileInvoiceStatus(inv as never, rowProofs(inv));
}

function displayStatus(inv: OCInvoiceRow): string {
  const rec = reconciled(inv);
  return isQuoteDocument(inv) ? documentStatus({ ...inv, status: rec }) : getDisplayInvoiceStatus({ ...inv, status: rec });
}

function paymentPlanExists(inv: OCInvoiceRow): boolean {
  const raw = inv.payment_plan;
  if (!raw) return false;
  if (typeof raw === "object" && raw !== null && "milestones" in raw) {
    const milestones = (raw as { milestones?: unknown }).milestones;
    return Array.isArray(milestones) && milestones.length > 0;
  }
  return true;
}

function lastEvent(events: OCEventRow[], invoiceId: string, eventTypes: string | string[]): OCEventRow | null {
  const types = Array.isArray(eventTypes) ? new Set(eventTypes) : new Set([eventTypes]);
  let best: OCEventRow | null = null;
  for (const e of events) {
    if (e.invoice_id !== invoiceId || !types.has(e.event_type)) continue;
    if (!best || e.created_at > best.created_at) best = e;
  }
  return best;
}

function eventAfter(events: OCEventRow[], invoiceId: string, eventTypes: string[], afterIso: string | null | undefined): OCEventRow | null {
  const after = parseTime(afterIso);
  if (after === null) return null;
  const types = new Set(eventTypes);
  let best: OCEventRow | null = null;
  for (const e of events) {
    if (e.invoice_id !== invoiceId || !types.has(e.event_type)) continue;
    const t = parseTime(e.created_at);
    if (t === null || t < after) continue;
    if (!best || e.created_at > best.created_at) best = e;
  }
  return best;
}

function recentAcceptedProof(inv: OCInvoiceRow): OCInvoiceProof | null {
  const accepted = (inv.payment_proofs || []).filter((p) => (p.status || "").toLowerCase() === "accepted");
  if (!accepted.length) return null;
  return accepted.reduce((best, p) => {
    const bestT = parseTime(best.confirmed_at || best.uploaded_at) || 0;
    const nextT = parseTime(p.confirmed_at || p.uploaded_at) || 0;
    return nextT > bestT ? p : best;
  }, accepted[0]);
}

function openForCollection(status: string): boolean {
  return ["sent", "unpaid", "partial", "overdue"].includes(status);
}

function tierFromSort(sort: number): WorkflowPriorityTier {
  if (sort >= 900) return "focus_now";
  if (sort >= 650) return "high_priority";
  if (sort >= 350) return "steady_followup";
  return "cleanup";
}

export function workflowTierLabel(tier: WorkflowPriorityTier): string {
  if (tier === "focus_now") return "Focus now";
  if (tier === "high_priority") return "High priority";
  if (tier === "steady_followup") return "Steady follow-up";
  return "Cleanup";
}

function addAction(
  actions: SuggestedNextAction[],
  seen: Set<string>,
  action: Omit<SuggestedNextAction, "tier"> & { tier?: WorkflowPriorityTier }
) {
  if (seen.has(action.id)) return;
  seen.add(action.id);
  actions.push({
    ...action,
    tier: action.tier || tierFromSort(action.internalSort),
    meta: action.meta.filter(Boolean)
  });
}

function amountLabel(inv: OCInvoiceRow, balance = getRemainingBalance(inv as never, rowProofs(inv))): string {
  return money(balance.primaryBalance, balance.primaryCurrency);
}

function approxUsd(inv: OCInvoiceRow, primaryAmount: number): number {
  if (primaryCurrency(inv) === "USD") return primaryAmount;
  const rate = num(inv.exchange_rate_lbp_per_usd) || 90000;
  return rate > 0 ? primaryAmount / rate : 0;
}

type ClientHistory = {
  paidCount: number;
  latePaidCount: number;
  partialCount: number;
  avgDaysToPay: number | null;
};

function buildClientHistory(invoices: OCInvoiceRow[]): Map<string, ClientHistory> {
  const acc = new Map<string, { paidCount: number; latePaidCount: number; partialCount: number; sumDays: number; samples: number }>();
  for (const inv of invoices) {
    if (!inv.client_id || isQuoteDocument(inv)) continue;
    const cid = inv.client_id;
    const current = acc.get(cid) || { paidCount: 0, latePaidCount: 0, partialCount: 0, sumDays: 0, samples: 0 };
    const rec = reconciled(inv);
    if (rec === "partial") current.partialCount += 1;
    if (rec === "paid") current.paidCount += 1;
    const accepted = (inv.payment_proofs || []).filter((p) => (p.status || "").toLowerCase() === "accepted");
    if (accepted.length && inv.created_at) {
      const created = parseTime(inv.created_at);
      const first = accepted.reduce((best, p) => {
        const bestT = parseTime(best.confirmed_at || best.uploaded_at) || Infinity;
        const nextT = parseTime(p.confirmed_at || p.uploaded_at) || Infinity;
        return nextT < bestT ? p : best;
      }, accepted[0]);
      const firstT = parseTime(first.confirmed_at || first.uploaded_at);
      if (created !== null && firstT !== null && firstT >= created) {
        current.sumDays += (firstT - created) / MS_DAY;
        current.samples += 1;
      }
    }
    for (const p of accepted) {
      if (!inv.due_date || !p.payment_date) continue;
      const due = parseTime(inv.due_date);
      const paid = parseTime(p.payment_date);
      if (due !== null && paid !== null && paid > due) current.latePaidCount += 1;
    }
    acc.set(cid, current);
  }

  const out = new Map<string, ClientHistory>();
  for (const [cid, row] of acc) {
    out.set(cid, {
      paidCount: row.paidCount,
      latePaidCount: row.latePaidCount,
      partialCount: row.partialCount,
      avgDaysToPay: row.samples ? row.sumDays / row.samples : null
    });
  }
  return out;
}

function clientHistoryMeta(history: ClientHistory | undefined): string | null {
  if (!history) return null;
  if (history.latePaidCount >= 2) return `${history.latePaidCount} late payments on record`;
  if (history.partialCount >= 2) return "often pays in parts";
  if (history.paidCount >= 2 && history.avgDaysToPay !== null && history.avgDaysToPay <= 5) return "usually settles quickly";
  return null;
}

function pushInvoiceActions({
  inv,
  events,
  clientHistory,
  actions,
  seen
}: {
  inv: OCInvoiceRow;
  events: OCEventRow[];
  clientHistory: Map<string, ClientHistory>;
  actions: SuggestedNextAction[];
  seen: Set<string>;
}) {
  const proofs = rowProofs(inv);
  const rec = reconciled(inv);
  const status = displayStatus(inv);
  const label = invoiceTitle(inv);
  const href = `/invoices/${inv.id}`;
  const history = inv.client_id ? clientHistory.get(inv.client_id) : undefined;
  const historyLabel = clientHistoryMeta(history);
  const lastReminder = lastEvent(events, inv.id, "reminder_copied");
  const lastReminderAge = daysSinceDate(lastReminder?.created_at);
  const recentlyReminded = lastReminderAge !== null && lastReminderAge <= 2;
  const lastReceiptView = lastEvent(events, inv.id, "receipt_viewed");
  const paymentAfterLastReminder = eventAfter(events, inv.id, ["proof_accepted", "manual_payment"], lastReminder?.created_at);
  const pendingProofs = (inv.payment_proofs || []).filter((p) => (p.status || "").toLowerCase() === "pending");

  for (const proof of pendingProofs) {
    const ageHours = hoursSince(proof.uploaded_at);
    const ageText = ageLabelFromHours(ageHours);
    const method = formatPaymentMethod(proof.method);
    const proofSort = 980 + Math.min(90, ageHours || 0);
    addAction(actions, seen, {
      id: `proof-${proof.id || inv.id}`,
      kind: "review_pending_proof",
      title: "Review pending proof",
      explanation: `Appears because ${label} has a client proof ${ageText}. Payment is not confirmed until you manually accept, reject, or void it.`,
      ctaLabel: "Review proof",
      href: `${href}#proofs-review`,
      section: "urgent_proof_reviews",
      invoiceId: inv.id,
      clientId: inv.client_id || undefined,
      proofId: proof.id,
      amountLabel: proof.amount_usd ? money(proof.amount_usd, "USD") : proof.amount_lbp ? money(proof.amount_lbp, "LBP") : null,
      meta: [label, method, ageText],
      internalSort: proofSort
    });
  }

  if (isQuoteDocument(inv)) {
    const qStatus = documentStatus({ ...inv, status: rec });
    if (!["expired", "approved", "rejected"].includes(qStatus)) {
      const age = daysSinceDate(inv.created_at) || 0;
      if (age >= 7) {
        const reminderFresh = lastReminderAge !== null && lastReminderAge < 7;
        if (!reminderFresh) {
          addAction(actions, seen, {
            id: `quote-follow-${inv.id}`,
            kind: "follow_up_quote",
            title: age >= 21 ? "Follow up stale quote" : "Follow up open quote",
            explanation: `Appears because ${label} is still open after ${age} days and no recent reminder copy is recorded.`,
            ctaLabel: "Open quote",
            href: `${href}#follow-up`,
            section: "stale_quotes",
            invoiceId: inv.id,
            clientId: inv.client_id || undefined,
            meta: [label, `${age}d old`],
            internalSort: age >= 21 ? 360 + Math.min(age, 80) : 300 + Math.min(age, 50)
          });
        }
      }
    }
    return;
  }

  const balance = getRemainingBalance({ ...inv, status: rec } as never, proofs);
  const remaining = balance.primaryBalance;
  const amount = amountLabel(inv, balance);
  const amountRefUsd = approxUsd(inv, remaining);
  const dueAge = daysSinceDate(inv.due_date) || 0;
  const dueIn = daysUntilDate(inv.due_date);

  const depReq = getDepositRequest(inv);
  const dep = getDepositStatus({ ...inv, status: rec }, proofs);
  if (depReq && dep?.label === "Not paid" && status !== "paid" && pendingProofs.length === 0) {
    addAction(actions, seen, {
      id: `deposit-${inv.id}`,
      kind: "request_deposit",
      title: "Request deposit",
      explanation: `Appears because this invoice has a deposit request and ${money(dep.remainingDeposit, dep.request.currency)} is still unpaid.`,
      ctaLabel: "Open follow-up",
      href: `${href}#follow-up`,
      section: "unpaid_deposits",
      invoiceId: inv.id,
      clientId: inv.client_id || undefined,
      amountLabel: money(dep.remainingDeposit, dep.request.currency),
      meta: [label, "deposit unpaid"],
      internalSort: status === "overdue" ? 760 : 610
    });
  }

  if (inv.valid_until && status !== "paid") {
    const daysToValidity = daysUntilDate(inv.valid_until);
    if (daysToValidity !== null && daysToValidity <= 7) {
      const expired = daysToValidity < 0;
      addAction(actions, seen, {
        id: `validity-${inv.id}`,
        kind: "extend_validity",
        title: expired ? "Extend expired payment page" : "Extend validity before it expires",
        explanation: expired
          ? `Appears because ${label} expired ${Math.abs(daysToValidity)} day${Math.abs(daysToValidity) === 1 ? "" : "s"} ago and the balance is still open.`
          : `Appears because ${label} expires in ${daysToValidity} day${daysToValidity === 1 ? "" : "s"} while ${amount} remains open.`,
        ctaLabel: "Extend validity",
        href: `${href}#extend-validity`,
        section: "expiring_invoices",
        invoiceId: inv.id,
        clientId: inv.client_id || undefined,
        amountLabel: amount,
        meta: [label, expired ? "expired" : `${daysToValidity}d left`],
        internalSort: expired ? 860 + Math.min(60, Math.abs(daysToValidity)) : 660 + Math.max(0, 7 - daysToValidity)
      });

      if (expired && Math.abs(daysToValidity) >= 14 && lastReminder) {
        addAction(actions, seen, {
          id: `regen-${inv.id}`,
          kind: "regenerate_pay_link",
          title: "Optional: regenerate pay link",
          explanation:
            "Appears because the old payment page has been expired for more than 14 days and a reminder was already copied. Regenerating invalidates older shared URLs; use only when you want a fresh link.",
          ctaLabel: "Open link tools",
          href: `${href}#public-link`,
          section: "expiring_invoices",
          invoiceId: inv.id,
          clientId: inv.client_id || undefined,
          amountLabel: amount,
          meta: [label, "optional"],
          internalSort: 430
        });
      }
    }
  }

  if (status === "draft") {
    const age = daysSinceDate(inv.created_at) || 0;
    if (age >= 14) {
      addAction(actions, seen, {
        id: `draft-${inv.id}`,
        kind: "finish_stale_draft",
        title: "Finish stale draft",
        explanation: `Appears because ${label} has been in draft for ${age} days. Drafts do not create a client payment path until you finish and share them.`,
        ctaLabel: "Open draft",
        href,
        section: "stale_quotes",
        invoiceId: inv.id,
        clientId: inv.client_id || undefined,
        meta: [label, `${age}d in draft`],
        internalSort: age >= 30 ? 330 + Math.min(age, 80) : 240 + Math.min(age, 50)
      });
    }
  }

  if (remaining > 0 && openForCollection(status)) {
    if (status === "overdue") {
      const lateHistoryBoost = history?.latePaidCount && history.latePaidCount >= 2 ? 50 : 0;
      const amountBoost = Math.min(120, amountRefUsd / 80);
      const overdueSort = 760 + Math.min(160, dueAge * 7) + amountBoost + lateHistoryBoost;

      if (pendingProofs.length === 0) {
        if (recentlyReminded) {
          addAction(actions, seen, {
            id: `wait-reminder-${inv.id}`,
            kind: "wait_recent_reminder",
            title: "Reminder recently copied",
            explanation: `Appears because a reminder was copied ${lastReminderAge === 0 ? "today" : `${lastReminderAge} day${lastReminderAge === 1 ? "" : "s"} ago`}. Avoid duplicate pressure unless the client asks for help.`,
            ctaLabel: "Open invoice",
            href,
            section: "clients_awaiting_response",
            invoiceId: inv.id,
            clientId: inv.client_id || undefined,
            amountLabel: amount,
            meta: [label, "recent reminder"],
            internalSort: 420
          });
        } else {
          addAction(actions, seen, {
            id: `overdue-${inv.id}`,
            kind: dueAge >= 7 ? "send_recovery_reminder" : "follow_up_overdue_invoice",
            title: dueAge >= 7 ? "Send recovery reminder" : "Follow up overdue invoice",
            explanation: `Appears because ${label} is ${daysPastLabel(dueAge)}, ${amount} remains open, and no reminder was copied in the last 48 hours.`,
            ctaLabel: "Copy reminder",
            href: `${href}#follow-up`,
            section: "overdue_recoveries",
            invoiceId: inv.id,
            clientId: inv.client_id || undefined,
            amountLabel: amount,
            meta: [label, daysPastLabel(dueAge), historyLabel || ""],
            internalSort: overdueSort
          });
        }
      }

      if (dueAge >= 7 && remaining > 0 && !paymentPlanExists(inv)) {
        addAction(actions, seen, {
          id: `plan-${inv.id}`,
          kind: "create_payment_plan",
          title: "Create payment plan",
          explanation: `Appears because ${label} is at least 7 days overdue with ${amount} still open. A manual plan can split payment without automatic charges.`,
          ctaLabel: "Set up plan",
          href: `${href}#payment-plan`,
          section: "follow_up_opportunities",
          invoiceId: inv.id,
          clientId: inv.client_id || undefined,
          amountLabel: amount,
          meta: [label, "manual milestones"],
          internalSort: 540 + Math.min(90, dueAge)
        });
      }
    } else if (dueIn !== null && dueIn >= 0 && dueIn <= 5 && pendingProofs.length === 0 && !recentlyReminded) {
      addAction(actions, seen, {
        id: `due-soon-${inv.id}`,
        kind: "send_gentle_reminder",
        title: dueIn === 0 ? "Gentle reminder due today" : "Gentle reminder recommended",
        explanation: `Appears because ${label} is due ${dueIn === 0 ? "today" : `in ${dueIn} day${dueIn === 1 ? "" : "s"}`} and ${amount} remains open.`,
        ctaLabel: "Copy reminder",
        href: `${href}#follow-up`,
        section: "follow_up_opportunities",
        invoiceId: inv.id,
        clientId: inv.client_id || undefined,
        amountLabel: amount,
        meta: [label, dueIn === 0 ? "due today" : `${dueIn}d until due`],
        internalSort: dueIn === 0 ? 520 : 390 + (5 - dueIn) * 10
      });
    }
  }

  if (lastReminder && lastReceiptView && !paymentAfterLastReminder && status !== "paid") {
    const reminderT = parseTime(lastReminder.created_at);
    const viewT = parseTime(lastReceiptView.created_at);
    const viewAge = daysSinceDate(lastReceiptView.created_at);
    if (reminderT !== null && viewT !== null && viewT > reminderT && viewAge !== null && viewAge <= 7) {
      addAction(actions, seen, {
        id: `active-client-${inv.id}`,
        kind: "contact_recently_active_client",
        title: "Client recently active",
        explanation: `Appears because the client viewed a page after your last reminder, but no payment event is recorded yet.`,
        ctaLabel: "Follow up",
        href: `${href}#follow-up`,
        section: "clients_awaiting_response",
        invoiceId: inv.id,
        clientId: inv.client_id || undefined,
        amountLabel: remaining > 0 ? amount : null,
        meta: [label, `viewed ${viewAge}d ago`],
        internalSort: 590 + Math.max(0, 7 - viewAge) * 8
      });
    }
  }

  const recentPaid = recentAcceptedProof(inv);
  const paidAgeDays = daysSinceDate(recentPaid?.confirmed_at || recentPaid?.uploaded_at);
  if (recentPaid && paidAgeDays !== null && paidAgeDays <= 3) {
    if (status === "paid" || status === "partial") {
      addAction(actions, seen, {
        id: `thanks-${inv.id}`,
        kind: "thank_after_payment",
        title: status === "paid" ? "Thank client after payment" : "Thank client and confirm balance",
        explanation:
          status === "paid"
            ? `Appears because a payment was accepted ${paidAgeDays === 0 ? "today" : `${paidAgeDays} day${paidAgeDays === 1 ? "" : "s"} ago`} and the invoice is settled.`
            : `Appears because a partial payment was accepted ${paidAgeDays === 0 ? "today" : `${paidAgeDays} day${paidAgeDays === 1 ? "" : "s"} ago`} and ${amount} remains open.`,
        ctaLabel: "Open follow-up",
        href: `${href}#follow-up`,
        section: "follow_up_opportunities",
        invoiceId: inv.id,
        clientId: inv.client_id || undefined,
        amountLabel: status === "partial" ? amount : null,
        meta: [label, status === "paid" ? "paid" : "partial"],
        internalSort: status === "partial" ? 480 : 260
      });
    }
  }
}

function buildOperationalInsights(invoices: OCInvoiceRow[], events: OCEventRow[], actions: SuggestedNextAction[]): OperationalInsight[] {
  const insights: OperationalInsight[] = [];
  const billable = invoices.filter((i) => !isQuoteDocument(i));
  const pendingProofs = actions.filter((a) => a.kind === "review_pending_proof");
  const oldProofs = pendingProofs.filter((a) => a.internalSort >= 1004);

  if (pendingProofs.length >= 3 && oldProofs.length > 0) {
    insights.push({
      id: "proof-queue-growing",
      title: "Proof queue needs clearing",
      detail: `${pendingProofs.length} pending proof${pendingProofs.length === 1 ? "" : "s"} are waiting, including ${oldProofs.length} older item${oldProofs.length === 1 ? "" : "s"}.`,
      basis: `${pendingProofs.length} pending proofs from current invoice rows`,
      tone: "attention"
    });
  }

  const reminderEvents = events.filter((e) => e.event_type === "reminder_copied");
  let reminderThenPaid = 0;
  for (const reminder of reminderEvents) {
    const rTime = parseTime(reminder.created_at);
    if (rTime === null) continue;
    const paidSoon = events.some((e) => {
      if (e.invoice_id !== reminder.invoice_id) return false;
      if (e.event_type !== "proof_accepted" && e.event_type !== "manual_payment") return false;
      const pTime = parseTime(e.created_at);
      return pTime !== null && pTime > rTime && pTime - rTime <= 14 * MS_DAY;
    });
    if (paidSoon) reminderThenPaid += 1;
  }
  if (reminderEvents.length >= 4 && reminderThenPaid >= 2) {
    insights.push({
      id: "recoveries-improving",
      title: "Recoveries are showing follow-through",
      detail: `${reminderThenPaid} reminder copy event${reminderThenPaid === 1 ? "" : "s"} were followed by a payment event within 14 days.`,
      basis: `${reminderEvents.length} reminder copy events in the loaded activity window`,
      tone: "good"
    });
  }

  const withDeposit = billable.filter((i) => Boolean(i.deposit_enabled));
  const withoutDeposit = billable.filter((i) => !i.deposit_enabled);
  if (withDeposit.length >= 4 && withoutDeposit.length >= 4) {
    const overdueRate = (rows: OCInvoiceRow[]) => rows.filter((i) => displayStatus(i) === "overdue").length / rows.length;
    const depRate = overdueRate(withDeposit);
    const noDepRate = overdueRate(withoutDeposit);
    if (depRate + 0.1 < noDepRate) {
      insights.push({
        id: "deposit-requests-reduce-overdue",
        title: "Deposit requests are linked to fewer overdue files",
        detail: `Deposit-enabled invoices are overdue at ${Math.round(depRate * 100)}% vs ${Math.round(noDepRate * 100)}% without deposits.`,
        basis: `${withDeposit.length} deposit invoices and ${withoutDeposit.length} non-deposit invoices`,
        tone: "good"
      });
    }
  }

  const methodHours = new Map<string, number[]>();
  for (const inv of billable) {
    for (const p of inv.payment_proofs || []) {
      if ((p.status || "").toLowerCase() !== "accepted") continue;
      const up = parseTime(p.uploaded_at);
      const conf = parseTime(p.confirmed_at || p.uploaded_at);
      if (up === null || conf === null || conf < up) continue;
      const method = formatPaymentMethod(p.method) || "Unspecified";
      const hours = (conf - up) / MS_HOUR;
      if (hours > 24 * 120) continue;
      const arr = methodHours.get(method) || [];
      arr.push(hours);
      methodHours.set(method, arr);
    }
  }
  let fastest: { method: string; medianHours: number; count: number } | null = null;
  for (const [method, rows] of methodHours) {
    if (rows.length < 3) continue;
    const sorted = [...rows].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    if (!fastest || median < fastest.medianHours) fastest = { method, medianHours: median, count: rows.length };
  }
  if (fastest) {
    insights.push({
      id: "fastest-confirmations",
      title: `${fastest.method} confirmations are fastest`,
      detail: `Median manual review time is ${fastest.medianHours < 24 ? `${Math.round(fastest.medianHours)}h` : `${Math.round(fastest.medianHours / 24)}d`} for this method.`,
      basis: `${fastest.count} accepted proofs with upload and confirmation timestamps`,
      tone: "info"
    });
  }

  return insights.slice(0, 4);
}

function buildWorkloadSuggestions(invoices: OCInvoiceRow[], actions: SuggestedNextAction[]): WorkloadSuggestion[] {
  const suggestions: WorkloadSuggestion[] = [];
  const pendingProofs = actions.filter((a) => a.kind === "review_pending_proof");
  const overdueActions = actions.filter((a) => a.section === "overdue_recoveries");
  const clientAwaiting = actions.filter((a) => a.section === "clients_awaiting_response");
  const stale = actions.filter((a) => a.kind === "finish_stale_draft" || a.kind === "follow_up_quote");

  if (pendingProofs.filter((a) => a.internalSort >= 1004).length >= 2) {
    suggestions.push({
      id: "old-proof-cleanup",
      title: "Old proofs are waiting",
      detail: "Clear older proofs first so accepted payments update balances before more reminders go out.",
      href: "/proofs",
      ctaLabel: "Open proof queue",
      tone: "attention"
    });
  }

  if (overdueActions.length >= 5) {
    suggestions.push({
      id: "too-many-recoveries",
      title: "Recovery load is high",
      detail: `${overdueActions.length} overdue recovery actions are queued. Work top-down and avoid sending repeat reminders to recently contacted clients.`,
      href: "/recoveries",
      ctaLabel: "Open recovery center",
      tone: "attention"
    });
  }

  const overdueByClient = new Map<string, number>();
  let overdueTotal = 0;
  for (const inv of invoices) {
    if (displayStatus(inv) !== "overdue" || !inv.client_id) continue;
    const bal = getRemainingBalance(inv as never, rowProofs(inv));
    const usd = approxUsd(inv, bal.primaryBalance);
    overdueTotal += usd;
    overdueByClient.set(inv.client_id, (overdueByClient.get(inv.client_id) || 0) + usd);
  }
  let largest = 0;
  for (const value of overdueByClient.values()) largest = Math.max(largest, value);
  if (overdueTotal > 0 && largest / overdueTotal >= 0.45 && largest >= 1000) {
    suggestions.push({
      id: "large-overdue-concentration",
      title: "Large overdue concentration",
      detail: `One client represents about ${Math.round((largest / overdueTotal) * 100)}% of overdue USD-equivalent balance.`,
      href: "/clients",
      ctaLabel: "Review clients",
      tone: "info"
    });
  }

  if (clientAwaiting.length >= 3) {
    suggestions.push({
      id: "neglected-responses",
      title: "Several clients are waiting after contact",
      detail: `${clientAwaiting.length} reminders or client views need a measured follow-up rhythm.`,
      href: "/invoices",
      ctaLabel: "Review invoices",
      tone: "cleanup"
    });
  }

  if (stale.length >= 3) {
    suggestions.push({
      id: "stale-drafts-accumulating",
      title: "Stale quotes and drafts are accumulating",
      detail: `${stale.length} old quote or draft actions can be closed, followed up, or finished.`,
      href: "/invoices",
      ctaLabel: "Clean up documents",
      tone: "cleanup"
    });
  }

  return suggestions.slice(0, 4);
}

export function buildWorkflowAssistantModel(input: { invoices: OCInvoiceRow[]; events: OCEventRow[] }): WorkflowAssistantModel {
  const invoices = input.invoices || [];
  const events = input.events || [];
  const clientHistory = buildClientHistory(invoices);
  const actions: SuggestedNextAction[] = [];
  const seen = new Set<string>();

  for (const inv of invoices) {
    pushInvoiceActions({ inv, events, clientHistory, actions, seen });
  }

  actions.sort((a, b) => {
    const sort = b.internalSort - a.internalSort;
    if (sort !== 0) return sort;
    return a.title.localeCompare(b.title);
  });

  const sections = WORKFLOW_SECTION_ORDER.map((key) => ({
    key,
    title: SECTION_COPY[key].title,
    subtitle: SECTION_COPY[key].subtitle,
    items: actions.filter((a) => a.section === key)
  }));

  return {
    actions,
    focusNow: actions.filter((a) => a.tier === "focus_now").slice(0, 6),
    sections,
    insights: buildOperationalInsights(invoices, events, actions),
    workload: buildWorkloadSuggestions(invoices, actions)
  };
}

export function buildSuggestedNextActionsForInvoice(input: {
  invoice: OCInvoiceRow;
  allInvoices?: OCInvoiceRow[];
  events: OCEventRow[];
}): SuggestedNextAction[] {
  const invoices = [input.invoice, ...(input.allInvoices || []).filter((i) => i.id !== input.invoice.id)];
  return buildWorkflowAssistantModel({ invoices, events: input.events }).actions.filter((a) => a.invoiceId === input.invoice.id);
}

export function buildReminderAssistance(input: {
  invoice: OCInvoiceRow;
  proofs: Array<OCInvoiceProof | MinimalProof>;
  events: OCEventRow[];
}): ReminderAssistItem[] {
  const inv = { ...input.invoice, payment_proofs: input.proofs as OCInvoiceProof[] };
  const status = displayStatus(inv);
  const proofs = rowProofs(inv);
  const balance = getRemainingBalance(inv as never, proofs);
  const out: ReminderAssistItem[] = [];
  const pendingProof = (input.proofs || []).find((p) => (p.status || "").toLowerCase() === "pending");
  const lastReminder = lastEvent(input.events, inv.id, "reminder_copied");
  const lastReminderAge = daysSinceDate(lastReminder?.created_at);
  const lastReceiptView = lastEvent(input.events, inv.id, "receipt_viewed");
  const lastAccepted = recentAcceptedProof(inv);
  const dueAge = daysSinceDate(inv.due_date);
  const dueIn = daysUntilDate(inv.due_date);
  const depReq = getDepositRequest(inv);
  const dep = getDepositStatus(inv, proofs);

  if (pendingProof) {
    out.push({
      id: "proof-first",
      label: "Proof uploaded but not reviewed",
      detail: `Review the proof before sending another reminder. Uploaded ${ageLabelFromHours(hoursSince((pendingProof as OCInvoiceProof).uploaded_at))}.`,
      tone: "attention"
    });
    return out;
  }

  if (lastReminderAge !== null && lastReminderAge <= 2) {
    out.push({
      id: "recent-reminder",
      label: "Reminder recently copied",
      detail: `Last reminder copy was ${lastReminderAge === 0 ? "today" : `${lastReminderAge} day${lastReminderAge === 1 ? "" : "s"} ago`}. Reuse only if the client asks for the link.`,
      tone: "wait"
    });
  }

  if (lastReceiptView && status !== "paid") {
    const viewAge = daysSinceDate(lastReceiptView.created_at);
    const reminderT = parseTime(lastReminder?.created_at);
    const viewT = parseTime(lastReceiptView.created_at);
    if (viewAge !== null && viewAge <= 7 && (reminderT === null || (viewT !== null && viewT >= reminderT))) {
      out.push({
        id: "recently-active",
        label: "Client recently active",
        detail: `A client page view was recorded ${viewAge === 0 ? "today" : `${viewAge} day${viewAge === 1 ? "" : "s"} ago`}. Keep the next message specific and calm.`,
        tone: "info"
      });
    }
  }

  if (depReq && dep?.label === "Not paid" && status !== "paid") {
    out.push({
      id: "deposit-reminder",
      label: "Deposit reminder recommended",
      detail: `${money(dep.remainingDeposit, dep.request.currency)} of the requested deposit is still unpaid.`,
      tone: "attention"
    });
  }

  if (status === "partial") {
    out.push({
      id: "partial-detected",
      label: "Partial payment detected",
      detail: `${money(balance.primaryBalance, balance.primaryCurrency)} remains open. Thank the client and confirm the remaining balance.`,
      tone: "good"
    });
  }

  if (status === "overdue" && dueAge !== null) {
    out.push({
      id: "recovery-recommended",
      label: dueAge >= 7 ? "Recovery reminder recommended" : "Gentle overdue reminder recommended",
      detail: `${invoiceTitle(inv)} is ${daysPastLabel(dueAge)} with ${money(balance.primaryBalance, balance.primaryCurrency)} still open.`,
      tone: dueAge >= 7 ? "attention" : "info"
    });
  } else if (openForCollection(status) && dueIn !== null && dueIn >= 0 && dueIn <= 5) {
    out.push({
      id: "gentle-recommended",
      label: "Gentle reminder recommended",
      detail: `${invoiceTitle(inv)} is due ${dueIn === 0 ? "today" : `in ${dueIn} day${dueIn === 1 ? "" : "s"}`}.`,
      tone: "info"
    });
  }

  const paidAge = daysSinceDate(lastAccepted?.confirmed_at || lastAccepted?.uploaded_at);
  if (lastAccepted && paidAge !== null && paidAge <= 3) {
    out.push({
      id: "thanks",
      label: "Thank-you follow-up available",
      detail: status === "paid" ? "A recent accepted payment settled the invoice." : "A recent accepted payment changed the remaining balance.",
      tone: "good"
    });
  }

  if (!out.length) {
    out.push({
      id: "manual-control",
      label: "Manual follow-up ready",
      detail: "No blocking proof, recent reminder, or special state is detected. Copy or open WhatsApp only when you choose.",
      tone: "info"
    });
  }

  return out.slice(0, 5);
}

export function suggestedActionShortReason(action: SuggestedNextAction): string {
  const parts = action.explanation.split(".");
  return parts[0] ? `${parts[0]}.` : action.explanation;
}

export function workflowSectionCopy(key: WorkflowSectionKey) {
  return SECTION_COPY[key];
}

export function proofDuplicateKey(input: {
  status?: string | null;
  method?: string | null;
  payment_date?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
}) {
  const status = (input.status || "").toLowerCase();
  if (status !== "pending" && status !== "accepted") return null;
  const method = (input.method || "").trim().toLowerCase();
  const date = (input.payment_date || "").slice(0, 10);
  const usd = num(input.amount_usd);
  const lbp = num(input.amount_lbp);
  if (!method || !date || (usd <= 0 && lbp <= 0)) return null;
  return [method, date, usd > 0 ? `usd:${usd}` : "", lbp > 0 ? `lbp:${lbp}` : ""].filter(Boolean).join("|");
}

export function buildDuplicateProofMap<T extends { id: string } & Parameters<typeof proofDuplicateKey>[0]>(proofs: T[]): Map<string, number> {
  const counts = new Map<string, number>();
  const keyById = new Map<string, string>();
  for (const proof of proofs) {
    const key = proofDuplicateKey(proof);
    if (!key) continue;
    keyById.set(proof.id, key);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const out = new Map<string, number>();
  for (const [id, key] of keyById) out.set(id, counts.get(key) || 0);
  return out;
}
