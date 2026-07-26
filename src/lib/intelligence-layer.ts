/**
 * Qaffel Intelligence Layer — decision support from real workspace data only.
 * No synthetic forecasts, no AI, no fabricated metrics.
 */

import { documentStatus, isQuoteDocument } from "@/lib/documents";
import { formatPaymentMethod, money, todayIso } from "@/lib/format";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import { getOutstandingBalance, isAcceptedNonVoidedPayment, isActiveInvoice, isOverdueInvoice, isOutstandingInvoice, type CollectionInvoice } from "@/lib/collection";
import { csvEscapeCell, csvNumber, monthKeySafe } from "@/lib/safe-metrics";
import { derivePaymentMethodCurrencyCharts, type MonthlyPaymentMethodCurrencyTotal, type PaymentMethodCurrencyChart } from "@/lib/payment-method-currency-charts";
import { deriveRevenueCurrencyCharts, type MonthlyRevenueCurrencyFact, type RevenueCurrencyChart } from "@/lib/revenue-currency-charts";
import { deriveMomentumCurrencyIndicators, type MomentumCollectionCurrencyFact, type MomentumCurrencyIndicatorInput, type MomentumCurrencyIndicatorResult, type MomentumOutstandingCurrencyFact } from "@/lib/momentum-currency-indicators";
import { deriveRevenueCurrencyKpis, type CollectedBilledCurrencyFact, type InvoiceCurrencyFact, type MonthlyRevenueCurrencyValue, type RevenueCurrencyKpiInput, type RevenueCurrencyKpiSummary } from "@/lib/revenue-currency-kpis";
import type { InvoiceStatus } from "@/lib/types";
import type { OCEventRow, OCInvoiceProof, OCInvoiceRow } from "@/lib/operations-center";

const MS_DAY = 86400000;
const MS_HOUR = 3600000;

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function medianSorted(sorted: number[]): number | null {
  if (!sorted.length) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  return medianSorted([...nums].sort((a, b) => a - b));
}

function invPrimaryCur(inv: OCInvoiceRow): "USD" | "LBP" {
  return (inv.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
}

function proofPrimaryAmount(p: OCInvoiceProof, inv: OCInvoiceRow): number {
  return invPrimaryCur(inv) === "USD" ? num(p.amount_usd) : num(p.amount_lbp);
}

function invoiceBilledPrimary(inv: OCInvoiceRow): number {
  return invPrimaryCur(inv) === "USD" ? num(inv.amount_usd) : num(inv.amount_lbp);
}

/** Chart / risk totals: LBP → USD via invoice rate; invalid rate → 0 */
function toApproxUsd(inv: OCInvoiceRow, primaryAmt: number): number {
  const a = Number.isFinite(primaryAmt) ? primaryAmt : 0;
  if (invPrimaryCur(inv) === "USD") return a;
  const r = num(inv.exchange_rate_lbp_per_usd);
  if (r <= 0) return 0;
  return a / r;
}

function rowProofs(inv: OCInvoiceRow): MinimalProof[] {
  return (inv.payment_proofs || []).map((p) => ({
    status: p.status || "",
    amount_usd: p.amount_usd === null || p.amount_usd === undefined ? null : Number(p.amount_usd),
    amount_lbp: p.amount_lbp === null || p.amount_lbp === undefined ? null : Number(p.amount_lbp)
  }));
}

function reconciled(inv: OCInvoiceRow): InvoiceStatus {
  return reconcileInvoiceStatus(inv as any, rowProofs(inv));
}

function display(inv: OCInvoiceRow) {
  const rec = reconciled(inv);
  if (isQuoteDocument(inv)) return documentStatus({ ...inv, status: rec });
  return getDisplayInvoiceStatus({ ...inv, status: rec });
}

function methodKey(m: string | null | undefined): string {
  const raw = (m || "").trim();
  if (!raw) return "Unspecified";
  return formatPaymentMethod(raw) || raw;
}

export type RevenueIntelligence = {
  revenueCurrencyKpis: RevenueCurrencyKpiSummary[];
  averagePaymentDelayDays: number | null;
  depositConversionRate: number | null;
  currencyCharts: RevenueCurrencyChart[];
};

export type MethodBehaviorRow = {
  method: string;
  accepted: number;
  rejected: number;
  voided: number;
  medianReviewHours: number | null;
  trustedRatio: number | null;
};

export type InvoicePerformance = {
  withDeposit: { total: number; paid: number };
  withoutDeposit: { total: number; paid: number };
  quotes: number;
  invoices: number;
  approvalRequired: { total: number; paid: number };
  directPay: { total: number; paid: number };
  shortValidity: { total: number; paid: number };
  longValidity: { total: number; paid: number };
};

export type ReminderEffectiveness = {
  remindersLogged: number;
  remindersBeforePayment: number;
  medianDaysReminderToPayment: number | null;
  whatsappReminders: number;
  whatsappThenPaidWithin14d: number;
};

export type MomentumIndicators = MomentumCurrencyIndicatorResult;


export type SmartRecommendation = { text: string; basis: string };

export type MonthlyReportRow = {
  monthKey: string;
  monthLabel: string;
  invoicesCreated: number;
  /** Accepted proofs in month, approx. USD (LBP at invoice rate). */
  paidTotalUsd: number;
  /** Overdue remaining balances in month bucket, approx. USD. */
  overdueTotalUsd: number;
  newClients: number;
  topMethod: string | null;
  operationalIssues: number;
};

export type OperationalListItem = {
  id: string;
  label: string;
  href: string;
  meta?: string;
};

export type OperationalFilters = {
  latePayers: OperationalListItem[];
  riskyClients: OperationalListItem[];
  highValueInvoices: OperationalListItem[];
  noFollowUpInvoices: OperationalListItem[];
  multipleRejectedProofs: OperationalListItem[];
  overpaidInvoices: OperationalListItem[];
  staleDrafts: OperationalListItem[];
};

export type ClientSegment = "reliable" | "growing" | "at_risk" | "inactive" | "high_value";

export type ClientSegmentationRow = {
  clientId: string;
  name: string;
  segments: ClientSegment[];
  href: string;
};

export type IntelligenceBundle = {
  revenue: RevenueIntelligence;
  paymentMethods: MethodBehaviorRow[];
  invoicePerformance: InvoicePerformance;
  reminders: ReminderEffectiveness;
  momentum: MomentumIndicators;
  recommendations: SmartRecommendation[];
  monthlyReports: MonthlyReportRow[];
  operational: OperationalFilters;
  clientSegmentation: ClientSegmentationRow[];
  paymentMethodCurrencyCharts: PaymentMethodCurrencyChart[];
};

export type ClientIntelligence = {
  lifetimeBilledPrimary: number;
  lifetimePaidPrimary: number;
  primaryCurrency: "USD" | "LBP";
  averagePaymentSpeedDays: number | null;
  overdueInvoiceCount: number;
  preferredMethod: string | null;
  lastInteractionAt: string | null;
  lastInteractionLabel: string | null;
  reliabilityScore: number;
  /** Simple 0–100 from on-time paid share vs late; not ML */
  reliabilityTrend: "improving" | "stable" | "worsening" | "unknown";
};

function invoiceTitle(inv: OCInvoiceRow) {
  return inv.invoice_number ? `${inv.invoice_number} · ${inv.title}` : inv.title;
}

function collectionInvoiceForRevenue(invoice: OCInvoiceRow): CollectionInvoice {
  return {
    id: invoice.id,
    status: invoice.status,
    document_type: invoice.document_type,
    currency: invoice.currency,
    amount_usd: num(invoice.amount_usd),
    amount_lbp: num(invoice.amount_lbp),
    due_date: invoice.due_date,
    created_at: invoice.created_at,
    payment_proofs: (invoice.payment_proofs || []).map((proof) => ({
      status: proof.status || "",
      amount_usd: proof.amount_usd === null || proof.amount_usd === undefined ? null : Number(proof.amount_usd),
      amount_lbp: proof.amount_lbp === null || proof.amount_lbp === undefined ? null : Number(proof.amount_lbp),
      voided_at: proof.voided_at || null
    }))
  };
}

function revenueCurrency(invoice: OCInvoiceRow): "USD" | "LBP" | null {
  const currency = String(invoice.currency || "").trim().toUpperCase();
  return currency === "USD" || currency === "LBP" ? currency : null;
}

function revenueAmount(invoice: OCInvoiceRow, proof: OCInvoiceProof | null, currency: "USD" | "LBP") {
  if (proof) return currency === "USD" ? num(proof.amount_usd) : num(proof.amount_lbp);
  return currency === "USD" ? num(invoice.amount_usd) : num(invoice.amount_lbp);
}

/**
 * Produces only factual revenue facts for the supplied, already-authorized
 * workspace invoices. The pure chart adapter owns aggregation and zero filling.
 */
export function deriveRevenueCurrencyFacts(input: {
  invoices: readonly OCInvoiceRow[];
  reportingMonths: readonly string[];
}): MonthlyRevenueCurrencyFact[] {
  const reportingMonthSet = new Set(input.reportingMonths);
  const facts: MonthlyRevenueCurrencyFact[] = [];
  const today = todayIso();

  for (const invoice of input.invoices) {
    const currency = revenueCurrency(invoice);
    const collectionInvoice = collectionInvoiceForRevenue(invoice);
    if (!currency || !isActiveInvoice(collectionInvoice)) continue;

    const createdMonth = monthKeySafe(invoice.created_at);
    if (createdMonth && reportingMonthSet.has(createdMonth)) {
      facts.push({ month: createdMonth, currency, metric: "billed", amount: revenueAmount(invoice, null, currency) });
    }

    if (isOutstandingInvoice(collectionInvoice) && invoice.due_date && invoice.due_date < today) {
      const dueMonth = monthKeySafe(invoice.due_date) ?? monthKeySafe(`${invoice.due_date}T12:00:00`);
      if (dueMonth && reportingMonthSet.has(dueMonth)) {
        facts.push({
          month: dueMonth,
          currency,
          metric: "overdue",
          amount: getOutstandingBalance(collectionInvoice).primaryBalance
        });
      }
    }

    for (const proof of invoice.payment_proofs || []) {
      if (!isAcceptedNonVoidedPayment(proof)) continue;
      const confirmedMonth = monthKeySafe(proof.confirmed_at || proof.uploaded_at);
      if (!confirmedMonth || !reportingMonthSet.has(confirmedMonth)) continue;
      facts.push({
        month: confirmedMonth,
        currency,
        metric: "collected",
        amount: revenueAmount(invoice, proof, currency)
      });
    }
  }

  return facts;
}

/**
 * Produces factual inputs for the active revenue KPI cards. The caller has
 * already applied workspace scope and non-quote eligibility. This intentionally
 * mirrors the legacy KPI source rules without conversion or aggregation.
 */
export function deriveRevenueCurrencyKpiFacts(input: {
  invoices: readonly OCInvoiceRow[];
  reportingMonths: readonly string[];
}): RevenueCurrencyKpiInput {
  const reportingMonthSet = new Set(input.reportingMonths);
  const monthlyValues: MonthlyRevenueCurrencyValue[] = [];
  const invoiceFacts: InvoiceCurrencyFact[] = [];
  const collectedBilledFacts: CollectedBilledCurrencyFact[] = [];

  for (const invoice of input.invoices) {
    const currency = revenueCurrency(invoice);
    if (!currency) continue;
    const billedAmount = revenueAmount(invoice, null, currency);
    invoiceFacts.push({ currency, amount: billedAmount, eligibleForAverage: true });
    collectedBilledFacts.push({ currency, billed: billedAmount, collected: 0 });

    // The old best-month and trend loop skipped records without a created date.
    const canContributeToMonthlyKpis = Boolean(invoice.created_at);
    for (const proof of invoice.payment_proofs || []) {
      // Intentionally matches the legacy KPI status test; void semantics remain unchanged here.
      if ((proof.status || "").toLowerCase() !== "accepted") continue;
      const amount = revenueAmount(invoice, proof, currency);
      collectedBilledFacts.push({ currency, billed: 0, collected: amount });
      if (!canContributeToMonthlyKpis) continue;
      const month = monthKeySafe(proof.confirmed_at || proof.uploaded_at);
      if (!month || !reportingMonthSet.has(month)) continue;
      monthlyValues.push({ month, currency, collected: amount, billed: 0 });
    }
  }

  return { reportingMonths: input.reportingMonths, monthlyValues, invoiceFacts, collectedBilledFacts };
}

/**
 * Produces factual inputs for active momentum. The caller supplies already-scoped,
 * non-quote workspace invoices; canonical collection predicates determine
 * outstanding eligibility before the pure adapter aggregates by currency.
 */
export function deriveMomentumCurrencyFacts(input: {
  invoices: readonly OCInvoiceRow[];
  now: number;
  today: string;
}): MomentumCurrencyIndicatorInput {
  const collectionFacts: MomentumCollectionCurrencyFact[] = [];
  const outstandingFacts: MomentumOutstandingCurrencyFact[] = [];
  const oneMonthAgo = new Date(input.now - 30 * MS_DAY).toISOString();
  const recentDueStart = oneMonthAgo.slice(0, 10);
  let overdueCountNow = 0;
  let overdueCountPriorMonth = 0;

  for (const invoice of input.invoices) {
    const collectionInvoice = collectionInvoiceForRevenue(invoice);
    if (isOverdueInvoice(collectionInvoice, input.today)) {
      overdueCountNow += 1;
      if (invoice.due_date && invoice.due_date >= recentDueStart) overdueCountPriorMonth += 1;
    }

    const currency = revenueCurrency(invoice);
    if (!currency) continue;
    const eligibleForOutstanding = isOutstandingInvoice(collectionInvoice);
    const remaining = getOutstandingBalance(collectionInvoice).primaryBalance;
    outstandingFacts.push({
      currency,
      currentAmount: remaining,
      olderAmount: invoice.created_at && invoice.created_at < oneMonthAgo ? remaining : 0,
      eligibleForOutstanding
    });

    for (const proof of invoice.payment_proofs || []) {
      // Matches the active momentum acceptance source rule; proof void semantics are unchanged here.
      if ((proof.status || "").toLowerCase() !== "accepted") continue;
      const timestamp = new Date(proof.confirmed_at || proof.uploaded_at).getTime();
      if (!Number.isFinite(timestamp)) continue;
      const age = input.now - timestamp;
      const period = age < 30 * MS_DAY ? "current_30d" : age >= 30 * MS_DAY && age < 60 * MS_DAY ? "previous_30d" : null;
      if (!period) continue;
      collectionFacts.push({ currency, period, amount: revenueAmount(invoice, proof, currency) });
    }
  }

  const clientInvoiceCounts = input.invoices.reduce((counts, invoice) => {
    if (!invoice.client_id) return counts;
    counts.set(invoice.client_id, (counts.get(invoice.client_id) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const repeatClients = [...clientInvoiceCounts.values()].filter((count) => count >= 2).length;

  return {
    collectionFacts,
    outstandingFacts,
    shared: {
      overdueCountNow,
      overdueCountPriorMonth,
      repeatClientRate: clientInvoiceCounts.size > 0 ? repeatClients / clientInvoiceCounts.size : null
    }
  };
}
export function buildIntelligenceBundle(input: {
  workspaceId: string;
  invoices: OCInvoiceRow[];
  events: OCEventRow[];
  clients: { id: string; name: string | null; created_at: string }[];
}): IntelligenceBundle {
  const { invoices, events, clients, workspaceId } = input;
  const workspaceInvoices = invoices.filter((invoice) => invoice.workspace_id === workspaceId);
  const billable = workspaceInvoices.filter((i) => !isQuoteDocument(i));
  const quotes = workspaceInvoices.filter((i) => isQuoteDocument(i));
  const now = Date.now();

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
  const last12: { key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    last12.push({ key, label: monthFormatter.format(d) });
  }

  const collectedByMonth = new Map<string, number>();
  const billedByMonth = new Map<string, number>();
  const overdueByMonth = new Map<string, number>();
  for (const m of last12) {
    collectedByMonth.set(m.key, 0);
    billedByMonth.set(m.key, 0);
    overdueByMonth.set(m.key, 0);
  }

  for (const inv of billable) {
    if (!inv.created_at) continue;
    const mk = monthKeySafe(inv.created_at);
    if (mk && billedByMonth.has(mk)) {
      billedByMonth.set(mk, (billedByMonth.get(mk) || 0) + toApproxUsd(inv, invoiceBilledPrimary(inv)));
    }
    const ds = display(inv);
    if (ds === "overdue" && inv.due_date) {
      const dk = monthKeySafe(inv.due_date) ?? monthKeySafe(`${inv.due_date}T12:00:00`);
      const bal = getRemainingBalance(inv as any, rowProofs(inv));
      if (dk && overdueByMonth.has(dk)) {
        overdueByMonth.set(dk, (overdueByMonth.get(dk) || 0) + toApproxUsd(inv, bal.primaryBalance));
      }
    }
    for (const p of inv.payment_proofs || []) {
      if ((p.status || "").toLowerCase() !== "accepted") continue;
      const conf = p.confirmed_at || p.uploaded_at;
      if (!conf) continue;
      const ck = monthKeySafe(conf);
      if (!ck || !collectedByMonth.has(ck)) continue;
      collectedByMonth.set(ck, (collectedByMonth.get(ck) || 0) + toApproxUsd(inv, proofPrimaryAmount(p, inv)));
    }
  }

  const reportingMonths = last12.map((month) => month.key);
  const currencyCharts = deriveRevenueCurrencyCharts(
    deriveRevenueCurrencyFacts({ invoices: billable, reportingMonths }),
    { reportingMonths }
  );
  const revenueCurrencyKpis = deriveRevenueCurrencyKpis(
    deriveRevenueCurrencyKpiFacts({ invoices: billable, reportingMonths })
  );

  const delays: number[] = [];
  for (const inv of billable) {
    if (display(inv) !== "paid" || !inv.created_at) continue;
    const created = new Date(inv.created_at).getTime();
    const accepted = (inv.payment_proofs || []).filter((p) => (p.status || "").toLowerCase() === "accepted");
    if (!accepted.length) continue;
    let first = Infinity;
    for (const p of accepted) {
      const t = new Date(p.confirmed_at || p.payment_date || p.uploaded_at).getTime();
      if (Number.isFinite(t) && t < first) first = t;
    }
    if (first !== Infinity && first >= created) delays.push((first - created) / MS_DAY);
  }
  const averagePaymentDelayDays = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;

  const withDep = billable.filter((i) => Boolean(i.deposit_enabled));
  const depPaid = withDep.filter((i) => display(i) === "paid").length;
  const depositConversionRate = withDep.length ? depPaid / withDep.length : null;

  const methodAgg = new Map<string, { accepted: number; rejected: number; voided: number; reviewHours: number[] }>();
  for (const inv of invoices) {
    for (const p of inv.payment_proofs || []) {
      const k = methodKey(p.method);
      if (!methodAgg.has(k)) methodAgg.set(k, { accepted: 0, rejected: 0, voided: 0, reviewHours: [] });
      const row = methodAgg.get(k)!;
      const st = (p.status || "").toLowerCase();
      if (st === "accepted") {
        row.accepted += 1;
        const up = new Date(p.uploaded_at).getTime();
        const cf = new Date(p.confirmed_at || p.uploaded_at).getTime();
        if (Number.isFinite(up) && Number.isFinite(cf) && cf >= up) {
          const h = (cf - up) / MS_HOUR;
          if (h <= 24 * 90) row.reviewHours.push(h);
        }
      } else if (st === "rejected") row.rejected += 1;
      else if (st === "voided") row.voided += 1;
    }
  }
  const paymentMethods: MethodBehaviorRow[] = [];
  for (const [method, row] of methodAgg) {
    const denom = row.accepted + row.rejected + row.voided;
    const trustedRatio = denom > 0 ? row.accepted / denom : null;
    const med = median(row.reviewHours);
    paymentMethods.push({
      method,
      accepted: row.accepted,
      rejected: row.rejected,
      voided: row.voided,
      medianReviewHours: med,
      trustedRatio
    });
  }
  paymentMethods.sort((a, b) => b.accepted - a.accepted);

  const paid = (inv: OCInvoiceRow) => display(inv) === "paid";
  const withDeposit = billable.filter((i) => Boolean(i.deposit_enabled));
  const withoutDeposit = billable.filter((i) => !i.deposit_enabled);
  const approvalReq = billable.filter((i) => (i.approval_status || "not_required") === "pending" || i.approval_status === "approved");
  const directPay = billable.filter((i) => !i.approval_status || i.approval_status === "not_required");

  const validityDays = (inv: OCInvoiceRow) => {
    if (!inv.created_at || !inv.valid_until) return null;
    const a = new Date(inv.created_at).getTime();
    const b = new Date(inv.valid_until).getTime();
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return (b - a) / MS_DAY;
  };
  const shortV = billable.filter((i) => {
    const d = validityDays(i);
    return d !== null && d <= 14;
  });
  const longV = billable.filter((i) => {
    const d = validityDays(i);
    return d === null || d > 14;
  });

  const invoicePerformance: InvoicePerformance = {
    withDeposit: { total: withDeposit.length, paid: withDeposit.filter(paid).length },
    withoutDeposit: { total: withoutDeposit.length, paid: withoutDeposit.filter(paid).length },
    quotes: quotes.length,
    invoices: billable.length,
    approvalRequired: { total: approvalReq.length, paid: approvalReq.filter(paid).length },
    directPay: { total: directPay.length, paid: directPay.filter(paid).length },
    shortValidity: { total: shortV.length, paid: shortV.filter(paid).length },
    longValidity: { total: longV.length, paid: longV.filter(paid).length }
  };

  const reminders = events.filter((e) => e.event_type === "reminder_copied");
  const byInvoice = new Map<string, OCEventRow[]>();
  for (const e of events) {
    if (!byInvoice.has(e.invoice_id)) byInvoice.set(e.invoice_id, []);
    byInvoice.get(e.invoice_id)!.push(e);
  }
  for (const arr of byInvoice.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));

  let remindersBeforePayment = 0;
  const lagDays: number[] = [];
  let whatsappReminders = 0;
  let whatsappThenPaidWithin14d = 0;

  for (const inv of billable) {
    const arr = byInvoice.get(inv.id) || [];
    const payEvents = arr.filter((e) => e.event_type === "proof_accepted" || e.event_type === "manual_payment");
    for (const r of arr.filter((e) => e.event_type === "reminder_copied")) {
      const rt = new Date(r.created_at).getTime();
      const meta = r.metadata as { channel?: string } | null | undefined;
      const isWa = (meta?.channel || "").toLowerCase() === "whatsapp";
      if (isWa) whatsappReminders += 1;
      const nextPay = payEvents.find((e) => new Date(e.created_at).getTime() > rt);
      if (nextPay) {
        remindersBeforePayment += 1;
        lagDays.push((new Date(nextPay.created_at).getTime() - rt) / MS_DAY);
        if (isWa && (new Date(nextPay.created_at).getTime() - rt) / MS_DAY <= 14) whatsappThenPaidWithin14d += 1;
      }
    }
  }

  const remindersEffectiveness: ReminderEffectiveness = {
    remindersLogged: reminders.length,
    remindersBeforePayment,
    medianDaysReminderToPayment: median(lagDays),
    whatsappReminders,
    whatsappThenPaidWithin14d
  };

  const momentum: MomentumIndicators = deriveMomentumCurrencyIndicators(
    deriveMomentumCurrencyFacts({ invoices: billable, now, today: todayIso() })
  );

  const recommendations: SmartRecommendation[] = [];

  if (withDeposit.length >= 4 && withoutDeposit.length >= 4) {
    const paidDep = withDeposit.filter(paid).length / withDeposit.length;
    const paidNo = withoutDeposit.filter(paid).length / withoutDeposit.length;
    if (paidDep > paidNo + 0.1) {
      recommendations.push({
        text: `Invoices with a deposit request are marked paid at a higher share (${Math.round(paidDep * 100)}% vs ${Math.round(paidNo * 100)}% without deposits).`,
        basis: `${withDeposit.length} with deposit · ${withoutDeposit.length} without`
      });
    }
  }

  const whish = paymentMethods.find((m) => m.method.toLowerCase().includes("whish"));
  const other = paymentMethods.filter((m) => !m.method.toLowerCase().includes("whish") && m.accepted >= 3);
  if (whish && whish.medianReviewHours !== null && other.length) {
    let bestOther: MethodBehaviorRow | null = null;
    for (const m of other) {
      if (m.medianReviewHours === null) continue;
      if (!bestOther || bestOther.medianReviewHours === null || m.medianReviewHours < bestOther.medianReviewHours) {
        bestOther = m;
      }
    }
    const whH = whish.medianReviewHours;
    const oH = bestOther?.medianReviewHours;
    if (bestOther && oH !== null && oH !== undefined && whH < oH * 0.85 && whish.accepted >= 5) {
      recommendations.push({
        text: `${whish.method} proofs are confirmed faster in the median than your next-fastest busy method (${Math.round(whH)}h vs ${Math.round(oH)}h for ${bestOther.method}).`,
        basis: `${whish.accepted} accepted ${whish.method} proofs`
      });
    }
  }

  const curMk = monthKeySafe(todayIso());
  const overdueThisMonth = billable.filter((i) => {
    if (display(i) !== "overdue" || !i.due_date || !curMk) return false;
    const dm = monthKeySafe(i.due_date) ?? monthKeySafe(`${i.due_date}T12:00:00`);
    return dm === curMk;
  }).length;
  const overdueLastMonth = billable.filter((i) => {
    if (display(i) !== "overdue" || !i.due_date) return false;
    const t = new Date();
    t.setMonth(t.getMonth() - 1);
    const prevMk = monthKeySafe(t.toISOString());
    const dm = monthKeySafe(i.due_date) ?? monthKeySafe(`${i.due_date}T12:00:00`);
    return Boolean(prevMk && dm === prevMk);
  }).length;
  if (billable.length >= 8 && overdueThisMonth > overdueLastMonth && overdueThisMonth >= 2) {
    recommendations.push({
      text: `More invoices are overdue with due dates landing in the current month snapshot than the prior month (${overdueThisMonth} vs ${overdueLastMonth}).`,
      basis: `${billable.length} active invoices`
    });
  }

  const monthlyReports: MonthlyReportRow[] = last12.map(({ key, label }) => {
    const created = billable.filter((i) => i.created_at && monthKeySafe(i.created_at) === key).length;
    const paidUsd = billable.reduce((s, inv) => {
      for (const p of inv.payment_proofs || []) {
        if ((p.status || "").toLowerCase() !== "accepted") continue;
        const conf = p.confirmed_at || p.uploaded_at;
        const confMk = conf ? monthKeySafe(conf) : null;
        if (!confMk || confMk !== key) continue;
        s += toApproxUsd(inv, proofPrimaryAmount(p, inv));
      }
      return s;
    }, 0);
    const overdueUsd = billable
      .filter((i) => {
        if (display(i) !== "overdue" || !i.due_date) return false;
        const dm = monthKeySafe(i.due_date) ?? monthKeySafe(`${i.due_date}T12:00:00`);
        return dm === key;
      })
      .reduce((s, i) => {
        const bal = getRemainingBalance(i as any, rowProofs(i));
        return s + toApproxUsd(i, bal.primaryBalance);
      }, 0);
    const newClients = clients.filter((c) => c.created_at && monthKeySafe(c.created_at) === key).length;
    const methodUse = new Map<string, number>();
    for (const inv of billable) {
      for (const p of inv.payment_proofs || []) {
        if ((p.status || "").toLowerCase() !== "accepted") continue;
        const conf = p.confirmed_at || p.uploaded_at;
        const confMk = conf ? monthKeySafe(conf) : null;
        if (!confMk || confMk !== key) continue;
        const mk = methodKey(p.method);
        methodUse.set(mk, (methodUse.get(mk) || 0) + 1);
      }
    }
    let topMethod: string | null = null;
    let topC = 0;
    for (const [m, c] of methodUse) if (c > topC) { topMethod = m; topC = c; }

    const opsIssues =
      (collectedByMonth.get(key) || 0) > 0 && overdueUsd > (collectedByMonth.get(key) || 0)
        ? 1
        : overdueUsd > 0 ? 1 : 0;

    return {
      monthKey: key,
      monthLabel: label,
      invoicesCreated: created,
      paidTotalUsd: paidUsd,
      overdueTotalUsd: overdueUsd,
      newClients,
      topMethod,
      operationalIssues: opsIssues
    };
  });

  const reminderLast = new Map<string, string>();
  for (const e of events) {
    if (e.event_type !== "reminder_copied") continue;
    const cur = reminderLast.get(e.invoice_id);
    if (!cur || e.created_at > cur) reminderLast.set(e.invoice_id, e.created_at);
  }

  const operational: OperationalFilters = {
    latePayers: [],
    riskyClients: [],
    highValueInvoices: [],
    noFollowUpInvoices: [],
    multipleRejectedProofs: [],
    overpaidInvoices: [],
    staleDrafts: []
  };

  const clientRisk = new Map<string, { late: number; overdue: number; openUsd: number; name: string }>();
  for (const inv of billable) {
    if (!inv.client_id || !inv.clients?.name) continue;
    const cid = inv.client_id;
    if (!clientRisk.has(cid)) clientRisk.set(cid, { late: 0, overdue: 0, openUsd: 0, name: inv.clients.name });
    const row = clientRisk.get(cid)!;
    const ds = display(inv);
    if (ds === "overdue") row.overdue += 1;
    if (["sent", "unpaid", "partial", "overdue"].includes(ds)) {
      const bal = getRemainingBalance(inv as any, rowProofs(inv));
      row.openUsd += toApproxUsd(inv, bal.primaryBalance);
    }
    for (const p of inv.payment_proofs || []) {
      if ((p.status || "").toLowerCase() !== "accepted" || !inv.due_date || !p.payment_date) continue;
      if (new Date(p.payment_date) > new Date(inv.due_date)) row.late += 1;
    }
  }
  for (const [cid, row] of clientRisk) {
    if (row.late >= 2) operational.latePayers.push({ id: cid, label: row.name, href: `/clients/${cid}`, meta: `${row.late} late payments` });
    if (row.overdue >= 2 || row.openUsd >= 5000)
      operational.riskyClients.push({ id: cid, label: row.name, href: `/clients/${cid}`, meta: `${row.overdue} overdue` });
  }

  for (const inv of billable) {
    const approxBilled = toApproxUsd(inv, invoiceBilledPrimary(inv));
    if (approxBilled >= 5000 && display(inv) !== "paid") {
      operational.highValueInvoices.push({
        id: inv.id,
        label: invoiceTitle(inv),
        href: `/invoices/${inv.id}`,
        meta: money(invoiceBilledPrimary(inv), invPrimaryCur(inv))
      });
    }
    const lastRem = reminderLast.get(inv.id);
    const age = inv.created_at ? (now - new Date(inv.created_at).getTime()) / MS_DAY : 0;
    if (!lastRem && age > 10 && !["paid", "draft"].includes(display(inv))) {
      operational.noFollowUpInvoices.push({
        id: inv.id,
        label: invoiceTitle(inv),
        href: `/invoices/${inv.id}#follow-up`,
        meta: "No reminder logged"
      });
    }
    const rej = (inv.payment_proofs || []).filter((p) => (p.status || "").toLowerCase() === "rejected").length;
    if (rej >= 2) {
      operational.multipleRejectedProofs.push({
        id: inv.id,
        label: invoiceTitle(inv),
        href: `/invoices/${inv.id}`,
        meta: `${rej} rejected`
      });
    }
    const bal = getRemainingBalance(inv as any, rowProofs(inv));
    if (bal.primaryOverpaid > 0.02) {
      operational.overpaidInvoices.push({
        id: inv.id,
        label: invoiceTitle(inv),
        href: `/invoices/${inv.id}`,
        meta: money(bal.primaryOverpaid, bal.primaryCurrency)
      });
    }
  }

  for (const inv of billable) {
    if (inv.status !== "draft" || !inv.created_at) continue;
    const age = (now - new Date(inv.created_at).getTime()) / MS_DAY;
    if (age >= 21) {
      operational.staleDrafts.push({
        id: inv.id,
        label: invoiceTitle(inv),
        href: `/invoices/${inv.id}`,
        meta: `${Math.floor(age)}d in draft`
      });
    }
  }

  const clientSegmentation: ClientSegmentationRow[] = [];
  for (const [cid, row] of clientRisk) {
    const invs = billable.filter((i) => i.client_id === cid);
    const paidN = invs.filter((i) => display(i) === "paid").length;
    const lastAny = invs
      .map((i) => i.created_at)
      .filter(Boolean)
      .sort()
      .pop();
    const daysSince = lastAny ? (now - new Date(lastAny).getTime()) / MS_DAY : 999;
    const segments: ClientSegment[] = [];
    if (row.overdue === 0 && row.late <= 1 && paidN >= 3) segments.push("reliable");
    if (invs.length >= 2 && paidN >= invs.length - 1 && daysSince < 120) segments.push("growing");
    if (row.overdue >= 1 || row.late >= 2) segments.push("at_risk");
    if (daysSince > 120 && paidN === 0) segments.push("inactive");
    if (row.openUsd >= 8000) segments.push("high_value");
    if (segments.length) {
      clientSegmentation.push({
        clientId: cid,
        name: row.name,
        segments: [...new Set(segments)],
        href: `/clients/${cid}`
      });
    }
  }
  clientSegmentation.sort((a, b) => b.segments.length - a.segments.length);

  const chartMonths = new Set(last12.slice(-6).map((month) => month.key));
  const paymentMethodFacts: MonthlyPaymentMethodCurrencyTotal[] = [];
  for (const invoice of billable) {
    const currency = String(invoice.currency || "").trim().toUpperCase();
    for (const proof of invoice.payment_proofs || []) {
      if (!isAcceptedNonVoidedPayment(proof)) continue;
      const month = monthKeySafe(proof.confirmed_at || proof.uploaded_at);
      if (!month || !chartMonths.has(month)) continue;
      paymentMethodFacts.push({
        month,
        method: methodKey(proof.method),
        currency,
        amount: currency === "LBP" ? num(proof.amount_lbp) : currency === "USD" ? num(proof.amount_usd) : 0
      });
    }
  }
  const paymentMethodCurrencyCharts = derivePaymentMethodCurrencyCharts(paymentMethodFacts);

  const revenue: RevenueIntelligence = {
    revenueCurrencyKpis,
    averagePaymentDelayDays,
    depositConversionRate,
    currencyCharts
  };

  return {
    revenue,
    paymentMethods,
    invoicePerformance,
    reminders: remindersEffectiveness,
    momentum,
    recommendations,
    monthlyReports,
    operational,
    clientSegmentation,
    paymentMethodCurrencyCharts
  };
}

export function buildClientIntelligence(input: {
  clientId: string;
  invoices: OCInvoiceRow[];
  events: OCEventRow[];
}): ClientIntelligence | null {
  const { invoices, events } = input;
  const invs = invoices.filter((i) => !isQuoteDocument(i));
  if (!invs.length) return null;

  let primary: "USD" | "LBP" = "USD";
  let billed = 0;
  let paid = 0;
  for (const inv of invs) {
    primary = (inv.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
    const proofs = rowProofs(inv);
    const bal = getRemainingBalance(inv as any, proofs);
    billed += primary === "USD" ? num(inv.amount_usd) : num(inv.amount_lbp);
    paid += bal.primaryTotalPaid;
  }

  const speedSamples: number[] = [];
  let overdueInvoiceCount = 0;
  const methodCounts = new Map<string, number>();
  for (const inv of invs) {
    if (display(inv) === "overdue") overdueInvoiceCount += 1;
    const due = inv.due_date ? new Date(inv.due_date).getTime() : null;
    for (const p of inv.payment_proofs || []) {
      if ((p.status || "").toLowerCase() !== "accepted") continue;
      const payd = p.payment_date || p.confirmed_at || p.uploaded_at;
      if (due && payd && Number.isFinite(due)) {
        const pt = new Date(payd).getTime();
        if (Number.isFinite(pt)) {
          const days = (pt - due) / MS_DAY;
          if (Number.isFinite(days)) speedSamples.push(days);
        }
      }
      const mk = methodKey(p.method);
      if (mk !== "Unspecified") methodCounts.set(mk, (methodCounts.get(mk) || 0) + 1);
    }
  }
  const finiteSpeeds = speedSamples.filter(Number.isFinite);
  const averagePaymentSpeedDays = finiteSpeeds.length
    ? finiteSpeeds.reduce((a, b) => a + b, 0) / finiteSpeeds.length
    : null;
  let preferredMethod: string | null = null;
  let best = 0;
  for (const [m, c] of methodCounts) if (c > best) { preferredMethod = m; best = c; }

  const onTime = finiteSpeeds.filter((d) => d <= 0).length;
  const late = finiteSpeeds.filter((d) => d > 0).length;
  const reliabilityScore =
    finiteSpeeds.length === 0 ? 70 : Math.round(100 * (onTime / Math.max(1, onTime + late))) - Math.min(30, overdueInvoiceCount * 10);
  const score = Math.max(0, Math.min(100, reliabilityScore));

  let reliabilityTrend: ClientIntelligence["reliabilityTrend"] = "unknown";
  if (finiteSpeeds.length >= 4) {
    const half = Math.floor(finiteSpeeds.length / 2);
    const early = median(finiteSpeeds.slice(0, half)) ?? 0;
    const lateH = median(finiteSpeeds.slice(half)) ?? 0;
    if (lateH < early - 1) reliabilityTrend = "improving";
    else if (lateH > early + 1) reliabilityTrend = "worsening";
    else reliabilityTrend = "stable";
  }

  const times: { t: number; label: string }[] = [];
  for (const inv of invs) {
    for (const e of events) {
      if (e.invoice_id !== inv.id) continue;
      const t = new Date(e.created_at).getTime();
      if (!Number.isFinite(t)) continue;
      times.push({ t, label: e.event_type });
    }
    for (const p of inv.payment_proofs || []) {
      const t = new Date(p.uploaded_at).getTime();
      if (Number.isFinite(t)) times.push({ t, label: "proof" });
    }
  }
  times.sort((a, b) => b.t - a.t);
  const last = times[0];
  const lastInteractionAt = last ? new Date(last.t).toISOString() : null;
  const lastInteractionLabel = last?.label ?? null;

  return {
    lifetimeBilledPrimary: billed,
    lifetimePaidPrimary: paid,
    primaryCurrency: primary,
    averagePaymentSpeedDays: averagePaymentSpeedDays !== null && Number.isFinite(averagePaymentSpeedDays) ? averagePaymentSpeedDays : null,
    overdueInvoiceCount,
    preferredMethod,
    lastInteractionAt,
    lastInteractionLabel,
    reliabilityScore: score,
    reliabilityTrend
  };
}

export function monthlyReportToCsv(row: MonthlyReportRow): string {
  /** Amount columns: approx. USD equivalent (LBP converted at each invoice's rate). */
  const headers = [
    "month",
    "invoices_created",
    "paid_total_usd",
    "overdue_total_usd",
    "new_clients",
    "top_payment_method",
    "operational_issue_flag"
  ];
  const line = [
    csvEscapeCell(row.monthKey),
    String(row.invoicesCreated),
    csvNumber(row.paidTotalUsd),
    csvNumber(row.overdueTotalUsd),
    String(row.newClients),
    csvEscapeCell(row.topMethod || ""),
    String(row.operationalIssues)
  ];
  return `${headers.join(",")}\n${line.join(",")}\n`;
}

export function buildMonthlyReportCsv(monthKey: string, rows: MonthlyReportRow[]): string {
  const row = rows.find((r) => r.monthKey === monthKey);
  if (!row) {
    return monthlyReportToCsv({
      monthKey,
      monthLabel: monthKey,
      invoicesCreated: 0,
      paidTotalUsd: 0,
      overdueTotalUsd: 0,
      newClients: 0,
      topMethod: null,
      operationalIssues: 0
    });
  }
  return monthlyReportToCsv(row);
}
