import { documentStatus, isQuoteDocument } from "@/lib/documents";
import { getDepositRequest, getDepositStatus } from "@/lib/deposit";
import { formatPaymentMethod, money, todayIso } from "@/lib/format";
import {
  evaluatePaymentReadiness,
  evaluateProfileCompleteness,
  getPendingProofUrgency,
  type PaymentMethodRow
} from "@/lib/operations";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import type { InvoiceStatus } from "@/lib/types";

export type AlertPriority = "critical" | "high" | "medium" | "low";
export type AlertBucket = "payments" | "clients" | "invoices" | "proofs";

export type OpsAlert = {
  id: string;
  alertType: string;
  priority: AlertPriority;
  bucket: AlertBucket;
  title: string;
  detail: string;
  href: string;
  invoiceId?: string;
  proofId?: string;
  clientId?: string;
};

export type OpsTimelineItem = {
  id: string;
  invoiceId: string;
  invoiceLabel: string;
  eventType: string;
  message: string;
  createdAt: string;
  tone: "payment" | "proof" | "reminder" | "receipt" | "risk" | "neutral";
};

export type ClientRiskRow = {
  clientId: string;
  name: string;
  tags: string[];
  summary: string;
  href: string;
};

export type CashFlowSnapshot = {
  expectedIncomingWeekUsd: number;
  overdueRecoverableUsd: number;
  unpaidDepositsUsd: number;
  velocityLabel: string;
  velocityDetail: string | null;
};

export type PaymentMethodInsight = {
  preferredByCount: { method: string; count: number; share: number } | null;
  fastestSettling: { method: string; medianHours: number } | null;
  highestConfirmed: { method: string; count: number } | null;
  mostUsedPaidInvoices: { method: string; count: number } | null;
};

export type BusinessInsight = { text: string; basis: string };

export type WorkspaceHealth = {
  score: number;
  label: string;
  breakdown: { key: string; label: string; points: number; max: number; note: string }[];
};

export type OCInvoiceProof = {
  id: string;
  status: string;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  uploaded_at: string;
  confirmed_at?: string | null;
  payment_date?: string | null;
  method?: string | null;
  voided_at?: string | null;
};

export type OCInvoiceRow = {
  id: string;
  title: string;
  invoice_number?: string | null;
  client_id?: string | null;
  status: InvoiceStatus;
  document_type?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  currency?: string | null;
  due_date?: string | null;
  valid_until?: string | null;
  created_at: string;
  public_token: string;
  exchange_rate_lbp_per_usd?: number | string | null;
  deposit_enabled?: boolean | null;
  deposit_type?: string | null;
  deposit_percent?: number | string | null;
  deposit_amount_usd?: number | string | null;
  deposit_amount_lbp?: number | string | null;
  deposit_note?: string | null;
  payment_plan?: unknown;
  approval_status?: string | null;
  clients?: { id: string; name: string | null; phone: string | null; email: string | null } | null;
  payment_proofs?: OCInvoiceProof[] | null;
};

export type OCEventRow = {
  id: string;
  invoice_id: string;
  event_type: string;
  message: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export type OperationsCenterModel = {
  alerts: OpsAlert[];
  alertsByBucket: Record<AlertBucket, OpsAlert[]>;
  timeline: OpsTimelineItem[];
  clientRisks: ClientRiskRow[];
  insights: BusinessInsight[];
  cashFlow: CashFlowSnapshot;
  paymentMethods: PaymentMethodInsight;
  health: WorkspaceHealth;
};

const MS_DAY = 86400000;
const MS_HOUR = 3600000;

function priorityRank(p: AlertPriority): number {
  switch (p) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}

export function sortOpsAlerts(a: OpsAlert, b: OpsAlert): number {
  const pr = priorityRank(a.priority) - priorityRank(b.priority);
  if (pr !== 0) return pr;
  return a.title.localeCompare(b.title);
}

function rowProofs(inv: OCInvoiceRow): MinimalProof[] {
  return (inv.payment_proofs || []).map((p) => ({
    status: p.status || "",
    amount_usd: p.amount_usd === null || p.amount_usd === undefined ? null : Number(p.amount_usd),
    amount_lbp: p.amount_lbp === null || p.amount_lbp === undefined ? null : Number(p.amount_lbp)
  }));
}

function reconciled(inv: OCInvoiceRow) {
  return reconcileInvoiceStatus(inv as any, rowProofs(inv));
}

function displayStatus(inv: OCInvoiceRow) {
  const rec = reconciled(inv);
  if (isQuoteDocument(inv)) return documentStatus({ ...inv, status: rec });
  return getDisplayInvoiceStatus({ ...inv, status: rec });
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / MS_DAY);
}

function normalizeMethodKey(method: string | null | undefined): string {
  const raw = (method || "").trim();
  if (!raw) return "Unspecified";
  return formatPaymentMethod(raw) || raw;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const TIMELINE_TYPES = new Set([
  "manual_payment",
  "proof_accepted",
  "proof_rejected",
  "proof_uploaded",
  "payment_voided",
  "deposit_satisfied",
  "deposit_requested",
  "reminder_copied",
  "receipt_viewed",
  "client_approved",
  "client_rejected",
  "payment_link_extended",
  "pay_link_regenerated",
  "invoice_paid",
  "invoice_partial",
  "assignment_created",
  "assignment_reassigned",
  "assignment_status_changed",
  "assignment_completed",
  "assignment_note_added",
  "handoff_completed"
]);

function timelineTone(eventType: string): OpsTimelineItem["tone"] {
  if (eventType.includes("proof") || eventType === "manual_payment") return "payment";
  if (eventType.includes("deposit") || eventType === "payment_voided") return "risk";
  if (eventType === "reminder_copied") return "reminder";
  if (eventType.includes("assignment") || eventType.includes("handoff")) return "neutral";
  if (eventType === "receipt_viewed") return "receipt";
  if (eventType.includes("client_")) return "neutral";
  return "neutral";
}

export function buildTimelineItems(
  events: OCEventRow[],
  invoiceTitleById: Map<string, string>
): OpsTimelineItem[] {
  return events
    .filter((e) => TIMELINE_TYPES.has(e.event_type))
    .map((e) => ({
      id: e.id,
      invoiceId: e.invoice_id,
      invoiceLabel: invoiceTitleById.get(e.invoice_id) || "Invoice",
      eventType: e.event_type,
      message: e.message,
      createdAt: e.created_at,
      tone: timelineTone(e.event_type)
    }));
}

export function buildOperationsCenterModel(input: {
  invoices: OCInvoiceRow[];
  /** Pending proofs with invoice join (flat list) */
  pendingProofQueue: Array<{
    id: string;
    uploaded_at: string;
    invoice_id: string;
    invoices?: { id: string; title?: string | null; invoice_number?: string | null } | null;
  }>;
  events: OCEventRow[];
  paymentMethods: PaymentMethodRow[];
  profile: { business_name?: string | null; phone?: string | null; business_address?: string | null } | null;
  userEmail: string | null | undefined;
}): OperationsCenterModel {
  const { invoices, pendingProofQueue, events, paymentMethods, profile, userEmail } = input;
  const billable = invoices.filter((i) => !isQuoteDocument(i));
  const quotes = invoices.filter((i) => isQuoteDocument(i));

  const invoiceTitleById = new Map<string, string>();
  for (const inv of invoices) {
    const label = inv.invoice_number ? `${inv.invoice_number} · ${inv.title}` : inv.title;
    invoiceTitleById.set(inv.id, label);
  }

  const reminderLastByInvoice = new Map<string, string>();
  for (const e of events) {
    if (e.event_type !== "reminder_copied") continue;
    const prev = reminderLastByInvoice.get(e.invoice_id);
    if (!prev || e.created_at > prev) reminderLastByInvoice.set(e.invoice_id, e.created_at);
  }

  const alerts: OpsAlert[] = [];
  const now = Date.now();
  const today = todayIso();
  const seenClientContactAlert = new Set<string>();

  for (const inv of billable) {
    const proofs = rowProofs(inv);
    const rec = reconciled(inv);
    const ds = getDisplayInvoiceStatus({ ...inv, status: rec });
    const balance = getRemainingBalance(inv as any, proofs);
    const primary: "USD" | "LBP" = balance.primaryCurrency;

    if (ds === "overdue") {
      const due = inv.due_date ? new Date(inv.due_date) : null;
      const daysPast = due && !Number.isNaN(due.getTime()) ? Math.max(0, daysBetween(due, new Date())) : 0;
      const amt = primary === "USD" ? Number(inv.amount_usd || 0) : Number(inv.amount_lbp || 0);
      const priority: AlertPriority =
        daysPast >= 21 || amt >= (primary === "USD" ? 10000 : 150000000) ? "critical" : daysPast >= 7 || amt >= 2500 ? "high" : "medium";
      alerts.push({
        id: `overdue-${inv.id}`,
        alertType: "overdue_invoice",
        priority,
        bucket: "invoices",
        title: "Overdue invoice",
        detail: `${invoiceTitleById.get(inv.id)} · ${money(balance.primaryBalance, primary)} remaining · ${daysPast ? `${daysPast}d past due` : "Past due"}`,
        href: `/invoices/${inv.id}`,
        invoiceId: inv.id,
        clientId: inv.client_id || undefined
      });
    }

    if (
      inv.client_id &&
      inv.clients &&
      ["sent", "unpaid", "partial", "overdue"].includes(ds) &&
      !seenClientContactAlert.has(inv.client_id)
    ) {
      const missingPhone = !String(inv.clients.phone ?? "").trim();
      const missingEmail = !String(inv.clients.email ?? "").trim();
      if (missingPhone || missingEmail) {
        seenClientContactAlert.add(inv.client_id);
        alerts.push({
          id: `client-contact-${inv.client_id}`,
          alertType: "client_missing_contact",
          priority: ds === "overdue" ? "high" : "medium",
          bucket: "clients",
          title: "Client missing phone or email",
          detail: `${inv.clients.name || "Client"} · ${missingPhone ? "No phone" : ""}${missingPhone && missingEmail ? " · " : ""}${missingEmail ? "No email" : ""}`,
          href: `/clients/${inv.client_id}`,
          clientId: inv.client_id
        });
      }
    }

    if (balance.primaryOverpaid > (primary === "USD" ? 0.02 : 1)) {
      alerts.push({
        id: `overpaid-${inv.id}`,
        alertType: "invoice_overpaid",
        priority: "high",
        bucket: "payments",
        title: "Invoice may be overpaid",
        detail: `${invoiceTitleById.get(inv.id)} · ${money(balance.primaryOverpaid, primary)} above invoice total in ${primary}`,
        href: `/invoices/${inv.id}`,
        invoiceId: inv.id
      });
    }

    const dep = getDepositStatus({ ...inv, status: rec }, proofs);
    const depReq = getDepositRequest(inv);
    if (dep?.label === "Not paid" && ds !== "paid" && depReq) {
      alerts.push({
        id: `deposit-${inv.id}`,
        alertType: "unpaid_deposit",
        priority: ds === "overdue" ? "high" : "medium",
        bucket: "payments",
        title: "Unpaid deposit",
        detail: `${invoiceTitleById.get(inv.id)} · ${money(dep.remainingDeposit, dep.request.currency)} still due on deposit`,
        href: `/invoices/${inv.id}`,
        invoiceId: inv.id
      });
    }

    if (inv.valid_until && ds !== "paid") {
      const vu = new Date(inv.valid_until);
      if (!Number.isNaN(vu.getTime())) {
        const days = Math.round((vu.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / MS_DAY);
        if (days >= 0 && days <= 7) {
          alerts.push({
            id: `expiring-${inv.id}`,
            alertType: "expiring_link",
            priority: days <= 2 ? "critical" : days <= 4 ? "high" : "medium",
            bucket: "invoices",
            title: "Payment link expiring",
            detail: `${invoiceTitleById.get(inv.id)} · validity ends in ${days}d`,
            href: `/invoices/${inv.id}#extend-validity`,
            invoiceId: inv.id
          });
        }
      }
    }

    if ((inv.status as string) === "draft") {
      const created = new Date(inv.created_at);
      const ageDays = !Number.isNaN(created.getTime()) ? daysBetween(created, new Date()) : 0;
      if (ageDays >= 14) {
        alerts.push({
          id: `stale-draft-${inv.id}`,
          alertType: "stale_draft",
          priority: ageDays >= 45 ? "medium" : "low",
          bucket: "invoices",
          title: "Stale draft invoice",
          detail: `${invoiceTitleById.get(inv.id)} · draft for ${ageDays}d`,
          href: `/invoices/${inv.id}`,
          invoiceId: inv.id
        });
      }
    }
  }

  for (const q of quotes) {
    const qs = documentStatus({ ...q, status: reconciled(q) });
    if (qs === "expired" || qs === "approved" || qs === "rejected") continue;
    const created = new Date(q.created_at);
    const ageDays = !Number.isNaN(created.getTime()) ? daysBetween(created, new Date()) : 0;
    if (ageDays < 7) continue;
    const lastRem = reminderLastByInvoice.get(q.id);
    const remAge = lastRem ? daysBetween(new Date(lastRem), new Date()) : 999;
    if (!lastRem || remAge >= 7) {
      alerts.push({
        id: `quote-followup-${q.id}`,
        alertType: "quote_followup",
        priority: ageDays >= 30 ? "high" : "medium",
        bucket: "invoices",
        title: "Quote needs follow-up",
        detail: `${invoiceTitleById.get(q.id)} · open ${ageDays}d${lastRem ? "" : " · no reminder logged"}`,
        href: `/invoices/${q.id}`,
        invoiceId: q.id,
        clientId: q.client_id || undefined
      });
    }
  }

  for (const p of pendingProofQueue) {
    const tier = getPendingProofUrgency(p.uploaded_at);
    if (tier === "fresh") continue;
    const inv = p.invoices;
    const label = inv?.invoice_number ? `${inv.invoice_number} · ${inv.title || "Invoice"}` : inv?.title || "Invoice";
    alerts.push({
      id: `proof-wait-${p.id}`,
      alertType: "proof_waiting",
      priority: tier === "over3d" ? "critical" : "high",
      bucket: "proofs",
      title: "Proof waiting for review",
      detail: `${label} · pending ${tier === "over3d" ? ">72h" : ">24h"}`,
      href: `/proofs`,
      proofId: p.id,
      invoiceId: p.invoice_id
    });
  }

  const readiness = evaluatePaymentReadiness(paymentMethods);
  if (!readiness.hasActiveMethod) {
    alerts.push({
      id: "no-pay-methods",
      alertType: "missing_payment_methods",
      priority: "critical",
      bucket: "payments",
      title: "No active payment methods",
      detail: "Clients cannot see how to pay on public invoice pages.",
      href: "/settings/payment-methods"
    });
  } else if (!readiness.whishOmtComplete || readiness.incompleteMethods > 0) {
    alerts.push({
      id: "pay-methods-incomplete",
      alertType: "payment_methods_incomplete",
      priority: "high",
      bucket: "payments",
      title: "Payment methods need detail",
      detail:
        readiness.incompleteMethods > 0
          ? `${readiness.incompleteMethods} active method(s) look incomplete (placeholders or missing receiver info).`
          : "Whish / OMT methods may be missing receiver details.",
      href: "/settings/payment-methods"
    });
  }

  const voidedRecently = (() => {
    let n = 0;
    for (const inv of invoices) {
      for (const pr of inv.payment_proofs || []) {
        if ((pr.status || "").toLowerCase() !== "voided" || !pr.voided_at) continue;
        const t = new Date(pr.voided_at).getTime();
        if (Number.isFinite(t) && now - t < 30 * MS_DAY) n += 1;
      }
    }
    return n;
  })();
  if (voidedRecently > 0) {
    alerts.push({
      id: "voided-recent",
      alertType: "voided_payment",
      priority: voidedRecently >= 3 ? "medium" : "low",
      bucket: "payments",
      title: "Recent voided payments",
      detail: `${voidedRecently} void in the last 30 days — balances were reversed.`,
      href: "/proofs"
    });
  }

  const clientAgg = new Map<
    string,
    {
      name: string;
      phone: string | null;
      overdueCount: number;
      openUsd: number;
      rejectedProofs: number;
      latePaidCount: number;
      paidCount: number;
      fastPayerSamples: number;
    }
  >();

  for (const inv of billable) {
    const cid = inv.client_id;
    if (!cid) continue;
    const proofs = rowProofs(inv);
    const rec = reconciled(inv);
    const ds = getDisplayInvoiceStatus({ ...inv, status: rec });
    const name = inv.clients?.name || "Client";
    const phone = inv.clients?.phone || null;
    if (!clientAgg.has(cid)) {
      clientAgg.set(cid, {
        name,
        phone,
        overdueCount: 0,
        openUsd: 0,
        rejectedProofs: 0,
        latePaidCount: 0,
        paidCount: 0,
        fastPayerSamples: 0
      });
    }
    const row = clientAgg.get(cid)!;
    if (ds === "overdue") row.overdueCount += 1;
    if (["sent", "unpaid", "partial", "overdue"].includes(ds)) {
      row.openUsd += Number(inv.amount_usd || 0);
    }
    for (const pr of inv.payment_proofs || []) {
      if ((pr.status || "").toLowerCase() === "rejected") row.rejectedProofs += 1;
      if ((pr.status || "").toLowerCase() === "accepted" && inv.due_date && pr.payment_date) {
        const due = new Date(inv.due_date);
        const paid = new Date(pr.payment_date);
        if (!Number.isNaN(due.getTime()) && !Number.isNaN(paid.getTime()) && paid > due) row.latePaidCount += 1;
        if (!Number.isNaN(due.getTime()) && !Number.isNaN(paid.getTime()) && daysBetween(paid, due) <= 0 && daysBetween(paid, due) >= -3) {
          row.fastPayerSamples += 1;
        }
      }
      if ((pr.status || "").toLowerCase() === "accepted") row.paidCount += 1;
    }
  }

  for (const [cid, row] of clientAgg) {
    if (row.overdueCount >= 2 || row.latePaidCount >= 2) {
      alerts.push({
        id: `client-late-${cid}`,
        alertType: "client_late_pattern",
        priority: row.overdueCount >= 3 ? "high" : "medium",
        bucket: "clients",
        title: "Client with repeated late pattern",
        detail: `${row.name} · ${row.overdueCount} overdue now · ${row.latePaidCount} historically paid after due date`,
        href: `/clients/${cid}`,
        clientId: cid
      });
    }
  }

  alerts.sort(sortOpsAlerts);

  const alertsByBucket: Record<AlertBucket, OpsAlert[]> = {
    payments: [],
    clients: [],
    invoices: [],
    proofs: []
  };
  for (const a of alerts) alertsByBucket[a.bucket].push(a);

  const timeline = buildTimelineItems(events, invoiceTitleById).slice(0, 60);

  const clientRisks: ClientRiskRow[] = [];
  for (const [cid, row] of clientAgg) {
    const tags: string[] = [];
    if (row.overdueCount >= 2) tags.push("Many overdue");
    if (row.latePaidCount >= 2) tags.push("Often pays late");
    if (row.openUsd >= 5000) tags.push("High open balance (USD)");
    if (row.rejectedProofs >= 2) tags.push("Rejected proofs");
    if (row.paidCount >= 3 && row.latePaidCount === 0 && row.fastPayerSamples >= 2) tags.push("Fast payer");
    if (row.paidCount >= 5 && row.rejectedProofs === 0 && row.latePaidCount <= 1) tags.push("Reliable");

    if (tags.length === 0) continue;
    const summary =
      tags.includes("Reliable") && tags.length === 1
        ? "Consistent payment history."
        : tags.includes("Fast payer")
          ? "Usually settles within a few days of due date."
          : "Review payment behaviour on open invoices.";
    clientRisks.push({
      clientId: cid,
      name: row.name,
      tags,
      summary,
      href: `/clients/${cid}`
    });
  }
  clientRisks.sort((a, b) => b.tags.length - a.tags.length);

  const insights: BusinessInsight[] = [];
  const acceptedProofs: OCInvoiceProof[] = [];
  for (const inv of invoices) {
    for (const pr of inv.payment_proofs || []) {
      if ((pr.status || "").toLowerCase() === "accepted") acceptedProofs.push(pr);
    }
  }
  const withMethod = acceptedProofs.filter((p) => (p.method || "").trim().length > 0);
  const methodCounts = new Map<string, number>();
  for (const p of withMethod) {
    const k = normalizeMethodKey(p.method);
    methodCounts.set(k, (methodCounts.get(k) || 0) + 1);
  }
  if (withMethod.length >= 5) {
    let best: { k: string; c: number } | null = null;
    for (const [k, c] of methodCounts) {
      if (!best || c > best.c) best = { k, c };
    }
    if (best && best.c / withMethod.length >= 0.35) {
      insights.push({
        text: `Most recorded payments specify ${best.k} (${Math.round((100 * best.c) / withMethod.length)}% of ${withMethod.length} accepted proofs with a method).`,
        basis: `${withMethod.length} accepted proofs with method`
      });
    }
  }

  if (billable.length >= 5) {
    const deltas: number[] = [];
    for (const inv of billable) {
    const proofs = rowProofs(inv);
    const accepted = (inv.payment_proofs || []).filter((p) => (p.status || "").toLowerCase() === "accepted");
    if (!accepted.length) continue;
    const first = accepted.reduce((earliest, p) => {
      const t = new Date(p.confirmed_at || p.uploaded_at).getTime();
      const et = new Date(earliest.confirmed_at || earliest.uploaded_at).getTime();
      return t < et ? p : earliest;
    }, accepted[0]);
      const invCreated = new Date(inv.created_at).getTime();
      const paidAt = new Date(first.confirmed_at || first.uploaded_at).getTime();
      if (Number.isFinite(invCreated) && Number.isFinite(paidAt) && paidAt >= invCreated) {
        deltas.push((paidAt - invCreated) / MS_DAY);
      }
    }
    const med = median(deltas);
    if (med !== null && deltas.length >= 5) {
      insights.push({
        text: `Paid invoices in your workspace typically show a first accepted payment around ${med < 1 ? "within a day" : `${Math.round(med * 10) / 10} days`} after the invoice was created (median across ${deltas.length} invoices).`,
        basis: `${deltas.length} invoices with accepted payments`
      });
    }
  }

  const depositEnabled = billable.filter((i) => Boolean(i.deposit_enabled));
  if (depositEnabled.length >= 4) {
    const paidRate = (subset: OCInvoiceRow[]) => {
      const ok = subset.filter((i) => displayStatus(i) === "paid").length;
      return subset.length ? ok / subset.length : 0;
    };
    const withDep = paidRate(depositEnabled);
    const withoutDep = paidRate(billable.filter((i) => !i.deposit_enabled));
    if (withDep > withoutDep + 0.12 && withoutDep < 0.95) {
      insights.push({
        text: `Deposit-enabled invoices are paid at a higher share right now (${Math.round(withDep * 100)}% vs ${Math.round(withoutDep * 100)}% without deposits).`,
        basis: `${depositEnabled.length} with deposit · ${billable.filter((i) => !i.deposit_enabled).length} without`
      });
    }
  }

  const w1 = new Date(now - 7 * MS_DAY).toISOString().slice(0, 10);
  const w2 = new Date(now - 14 * MS_DAY).toISOString().slice(0, 10);
  const overdueThisWeek = billable.filter((i) => {
    if (displayStatus(i) !== "overdue" || !i.due_date) return false;
    return i.due_date >= w1 && i.due_date <= today;
  }).length;
  const overduePrior = billable.filter((i) => {
    if (displayStatus(i) !== "overdue" || !i.due_date) return false;
    return i.due_date >= w2 && i.due_date < w1;
  }).length;
  if (billable.length >= 8 && overdueThisWeek > overduePrior && overdueThisWeek >= 2) {
    insights.push({
      text: `More invoices are currently overdue with due dates in the last 7 days (${overdueThisWeek}) than in the prior week (${overduePrior}).`,
      basis: `${billable.length} active invoices`
    });
  }

  let expectedIncomingWeekUsd = 0;
  let overdueRecoverableUsd = 0;
  let unpaidDepositsUsd = 0;
  const weekEnd = new Date(now + 7 * MS_DAY).toISOString().slice(0, 10);

  for (const inv of billable) {
    const proofs = rowProofs(inv);
    const rec = reconciled(inv);
    const ds = getDisplayInvoiceStatus({ ...inv, status: rec });
    const bal = getRemainingBalance(inv as any, proofs);
    if (ds === "overdue") overdueRecoverableUsd += bal.usd;
    if (inv.due_date && inv.due_date <= weekEnd && inv.due_date >= today && ds !== "paid") {
      expectedIncomingWeekUsd += bal.usd;
    }
    const dep = getDepositStatus({ ...inv, status: rec }, proofs);
    if (dep?.label === "Not paid" && ds !== "paid") {
      const rate = Math.max(1, Number(inv.exchange_rate_lbp_per_usd) || 89000);
      unpaidDepositsUsd += dep.request.currency === "USD" ? dep.remainingDeposit : dep.remainingDeposit / rate;
    }
  }

  const acceptedLast7 = acceptedProofs.filter((p) => {
    const t = new Date(p.confirmed_at || p.uploaded_at).getTime();
    return Number.isFinite(t) && now - t < 7 * MS_DAY;
  }).length;
  const acceptedPrev7 = acceptedProofs.filter((p) => {
    const t = new Date(p.confirmed_at || p.uploaded_at).getTime();
    return Number.isFinite(t) && now - t >= 7 * MS_DAY && now - t < 14 * MS_DAY;
  }).length;
  let velocityLabel = "Payment velocity";
  let velocityDetail: string | null = null;
  if (acceptedLast7 + acceptedPrev7 >= 3) {
    if (acceptedLast7 > acceptedPrev7) {
      velocityLabel = "Accelerating confirmations";
      velocityDetail = `${acceptedLast7} accepted in the last 7 days vs ${acceptedPrev7} in the prior 7 days.`;
    } else if (acceptedLast7 < acceptedPrev7) {
      velocityLabel = "Slower confirmations";
      velocityDetail = `${acceptedLast7} accepted in the last 7 days vs ${acceptedPrev7} in the prior 7 days.`;
    } else {
      velocityLabel = "Steady confirmation pace";
      velocityDetail = `${acceptedLast7} accepted payments in each of the last two 7-day windows.`;
    }
  }

  const cashFlow: CashFlowSnapshot = {
    expectedIncomingWeekUsd,
    overdueRecoverableUsd,
    unpaidDepositsUsd,
    velocityLabel,
    velocityDetail
  };

  const settleHours: Map<string, number[]> = new Map();
  for (const p of acceptedProofs) {
    const up = new Date(p.uploaded_at).getTime();
    const conf = new Date(p.confirmed_at || p.uploaded_at).getTime();
    if (!Number.isFinite(up) || !Number.isFinite(conf) || conf < up) continue;
    const hrs = (conf - up) / MS_HOUR;
    if (hrs > 24 * 120) continue;
    const k = normalizeMethodKey(p.method);
    if (!settleHours.has(k)) settleHours.set(k, []);
    settleHours.get(k)!.push(hrs);
  }
  let fastestSettling: PaymentMethodInsight["fastestSettling"] = null;
  for (const [method, arr] of settleHours) {
    if (arr.length < 3) continue;
    const medH = median(arr);
    if (medH === null) continue;
    if (!fastestSettling || medH < fastestSettling.medianHours) {
      fastestSettling = { method, medianHours: medH };
    }
  }

  let preferredByCount: PaymentMethodInsight["preferredByCount"] = null;
  if (withMethod.length >= 3) {
    let top: { method: string; count: number } | null = null;
    for (const [method, count] of methodCounts) {
      if (!top || count > top.count) top = { method, count };
    }
    if (top) {
      preferredByCount = { ...top, share: top.count / withMethod.length };
    }
  }

  let highestConfirmed: PaymentMethodInsight["highestConfirmed"] = null;
  for (const [method, count] of methodCounts) {
    if (!highestConfirmed || count > highestConfirmed.count) highestConfirmed = { method, count };
  }
  if (highestConfirmed && highestConfirmed.count < 2) highestConfirmed = null;

  const paidInvoices = billable.filter((i) => displayStatus(i) === "paid");
  const methodOnPaid = new Map<string, number>();
  for (const inv of paidInvoices) {
    const accepted = (inv.payment_proofs || []).filter((p) => (p.status || "").toLowerCase() === "accepted");
    const methodsUsed = new Set(accepted.map((p) => normalizeMethodKey(p.method)).filter(Boolean));
    for (const m of methodsUsed) {
      methodOnPaid.set(m, (methodOnPaid.get(m) || 0) + 1);
    }
  }
  let mostUsedPaidInvoices: PaymentMethodInsight["mostUsedPaidInvoices"] = null;
  for (const [method, count] of methodOnPaid) {
    if (!mostUsedPaidInvoices || count > mostUsedPaidInvoices.count) mostUsedPaidInvoices = { method, count };
  }
  if (mostUsedPaidInvoices && mostUsedPaidInvoices.count < 2) mostUsedPaidInvoices = null;

  const paymentMethodsInsight: PaymentMethodInsight = {
    preferredByCount,
    fastestSettling,
    highestConfirmed,
    mostUsedPaidInvoices
  };

  const profileCompleteness = evaluateProfileCompleteness({
    profile,
    userEmail,
    hasActivePaymentMethod: readiness.hasActiveMethod
  });
  const profileScore =
    (profileCompleteness.businessName ? 8 : 0) +
    (profileCompleteness.phone ? 8 : 0) +
    (profileCompleteness.email ? 4 : 0) +
    (profileCompleteness.paymentMethodsActive ? 10 : 0) +
    (profileCompleteness.businessAddress ? 5 : 0);

  const readinessScore = (readiness.hasActiveMethod ? 12 : 0) + (readiness.whishOmtComplete ? 10 : 0) + (readiness.incompleteMethods === 0 ? 8 : 0);

  const openCount = billable.filter((i) => ["sent", "unpaid", "partial", "overdue"].includes(displayStatus(i))).length;
  const overdueOnly = billable.filter((i) => displayStatus(i) === "overdue").length;
  const overdueRatio = openCount ? overdueOnly / openCount : 0;
  const overduePoints = Math.round(25 * (1 - Math.min(1, overdueRatio * 2)));

  const pendingHours = pendingProofQueue.map((p) => (now - new Date(p.uploaded_at).getTime()) / MS_HOUR);
  const avgPending = pendingHours.length ? pendingHours.reduce((a, b) => a + b, 0) / pendingHours.length : 0;
  const proofPoints =
    pendingProofQueue.length === 0 ? 25 : avgPending < 12 ? 22 : avgPending < 36 ? 15 : avgPending < 72 ? 8 : 3;

  const totalBilledUsd = billable.reduce((s, i) => s + Number(i.amount_usd || 0), 0);
  const totalOpenUsd = billable.reduce((s, i) => {
    const ds = displayStatus(i);
    if (!["sent", "unpaid", "partial", "overdue"].includes(ds)) return s;
    const proofs = rowProofs(i);
    const rec = reconciled(i);
    const bal = getRemainingBalance(i as any, proofs);
    return s + bal.usd;
  }, 0);
  const balanceRatio = totalBilledUsd > 0 ? totalOpenUsd / totalBilledUsd : 0;
  const balancePoints = Math.round(20 * (1 - Math.min(1, balanceRatio)));

  const rawScore = profileScore + readinessScore + overduePoints + proofPoints + balancePoints;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const label =
    score >= 85 ? "Strong operations" : score >= 70 ? "Healthy" : score >= 50 ? "Needs attention" : "At risk";

  const health: WorkspaceHealth = {
    score,
    label,
    breakdown: [
      { key: "profile", label: "Profile & identity", points: profileScore, max: 35, note: "From your profile + payment activation." },
      { key: "readiness", label: "Payment readiness", points: readinessScore, max: 30, note: "Active methods and complete instructions." },
      { key: "overdue", label: "Overdue pressure", points: overduePoints, max: 25, note: "Lower when fewer open invoices are overdue." },
      { key: "proofs", label: "Proof response", points: proofPoints, max: 25, note: "Higher when the pending queue is fresh." },
      { key: "balance", label: "Open balance load", points: balancePoints, max: 20, note: "Lower unpaid share of billed USD." }
    ]
  };

  return {
    alerts,
    alertsByBucket,
    timeline,
    clientRisks,
    insights,
    cashFlow,
    paymentMethods: paymentMethodsInsight,
    health
  };
}
