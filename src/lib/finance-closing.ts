import { getDepositRequest, getDepositStatus } from "@/lib/deposit";
import { formatPaymentMethod } from "@/lib/format";
import { parsePaymentPlan, paymentPlanProgress } from "@/lib/payment-plan";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import type { CsvRow } from "@/lib/csv";
import type { InvoiceStatus } from "@/lib/types";

export type FinanceCloseTaskKey =
  | "unresolved_invoices"
  | "pending_proofs"
  | "stale_recoveries"
  | "overdue_balances"
  | "payment_plans"
  | "void_verification"
  | "approval_review"
  | "export_package";

export type FinanceCloseTaskStatus = "open" | "completed" | "skipped";
export type FinanceCloseStatus = "draft" | "in_review" | "signed_off" | "reopened";

export type FinanceCloseTaskDefinition = {
  key: FinanceCloseTaskKey;
  title: string;
  description: string;
};

export type FinanceCloseTaskState = {
  task_key: FinanceCloseTaskKey;
  status: FinanceCloseTaskStatus;
  note?: string | null;
  completed_by_name?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
};

export type FinanceClosePeriodState = {
  period_month: string;
  status: FinanceCloseStatus;
  notes?: string | null;
  signed_off_by_name?: string | null;
  signed_off_at?: string | null;
};

export type FinanceExportRunRow = {
  id?: string;
  period_month?: string | null;
  export_type: string;
  title: string;
  row_count?: number | null;
  generated_by_name?: string | null;
  generated_at: string;
};

export type FinanceProofRow = MinimalProof & {
  id?: string | null;
  status?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  uploaded_at?: string | null;
  confirmed_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  reviewer_name?: string | null;
  reviewer_role?: string | null;
  payment_date?: string | null;
  method?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  note?: string | null;
  reviewer_decision_note?: string | null;
};

export type FinanceInvoiceRow = {
  id: string;
  invoice_number?: string | null;
  title?: string | null;
  status: InvoiceStatus;
  document_type?: string | null;
  client_id?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  currency?: string | null;
  due_date?: string | null;
  valid_until?: string | null;
  created_at?: string | null;
  exchange_rate_lbp_per_usd?: number | string | null;
  deposit_enabled?: boolean | null;
  deposit_type?: string | null;
  deposit_percent?: number | string | null;
  deposit_amount_usd?: number | string | null;
  deposit_amount_lbp?: number | string | null;
  deposit_note?: string | null;
  payment_plan?: unknown;
  approval_status?: string | null;
  clients?: { id?: string | null; name?: string | null; phone?: string | null; email?: string | null } | null;
  payment_proofs?: FinanceProofRow[] | null;
};

export type FinanceEventRow = {
  id?: string | null;
  invoice_id: string;
  event_type: string;
  message?: string | null;
  created_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type FinanceApprovalRow = {
  id: string;
  type?: string | null;
  reference_id?: string | null;
  reference_type?: string | null;
  requested_by?: string | null;
  requested_by_name?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  status: string;
  note?: string | null;
  threshold_usd?: number | string | null;
  created_at: string;
  resolved_at?: string | null;
};

export type FinanceSummaryMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "good" | "watch" | "risk";
};

export type ReconciliationIssueType =
  | "accepted_proof"
  | "partial_payment"
  | "overpayment"
  | "voided_receipt"
  | "unresolved_balance"
  | "deposit_coverage"
  | "payment_plan_balance";

export type ReconciliationReviewItem = {
  id: string;
  type: ReconciliationIssueType;
  title: string;
  clientName: string;
  invoiceNumber: string;
  href: string;
  amountUsd: number;
  amountLbp: number;
  status: string;
  explanation: string;
  formula: string;
  evidence: string[];
  occurredAt?: string | null;
};

export type FinanceTimelineItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  actor?: string | null;
  occurredAt: string;
  invoiceNumber?: string | null;
};

export type FinanceExportDataset = {
  key: string;
  title: string;
  description: string;
  filename: string;
  rows: CsvRow[];
};

export type FinanceClosingModel = {
  periodMonth: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  closeState: FinanceClosePeriodState;
  checklist: Array<FinanceCloseTaskDefinition & FinanceCloseTaskState>;
  completion: {
    completed: number;
    total: number;
    percentage: number;
    readyForSignoff: boolean;
  };
  summary: {
    issuedUsd: number;
    issuedLbp: number;
    collectedUsd: number;
    collectedLbp: number;
    unpaidUsd: number;
    unpaidLbp: number;
    overdueUsd: number;
    overdueLbp: number;
    pendingProofUsd: number;
    pendingProofLbp: number;
    partialUsd: number;
    partialLbp: number;
    voidedUsd: number;
    voidedLbp: number;
    recoveryUsd: number;
    recoveryLbp: number;
    unresolvedCount: number;
    pendingProofCount: number;
    voidCount: number;
    partialCount: number;
    overpaymentCount: number;
  };
  metrics: FinanceSummaryMetric[];
  reconciliation: {
    items: ReconciliationReviewItem[];
    acceptedProofs: ReconciliationReviewItem[];
    partialPayments: ReconciliationReviewItem[];
    overpayments: ReconciliationReviewItem[];
    voidedReceipts: ReconciliationReviewItem[];
    unresolvedBalances: ReconciliationReviewItem[];
    depositCoverage: ReconciliationReviewItem[];
    paymentPlanBalances: ReconciliationReviewItem[];
  };
  exports: FinanceExportDataset[];
  timeline: FinanceTimelineItem[];
  exportRuns: FinanceExportRunRow[];
  attention: Array<{
    id: string;
    title: string;
    detail: string;
    href: string;
    severity: "watch" | "risk" | "neutral";
  }>;
};

export const FINANCE_CLOSE_TASKS: FinanceCloseTaskDefinition[] = [
  {
    key: "unresolved_invoices",
    title: "Unresolved invoice review",
    description: "Review invoices that still have an open balance at month end."
  },
  {
    key: "pending_proofs",
    title: "Pending proof queue review",
    description: "Clear or explicitly carry forward payment proofs still waiting for human review."
  },
  {
    key: "stale_recoveries",
    title: "Stale recovery review",
    description: "Check overdue accounts where reminder or recovery activity has aged."
  },
  {
    key: "overdue_balances",
    title: "Overdue balance audit",
    description: "Confirm overdue exposure and recovery ownership before closing the period."
  },
  {
    key: "payment_plans",
    title: "Payment-plan audit",
    description: "Review open milestones and unsatisfied installment balances."
  },
  {
    key: "void_verification",
    title: "Void verification",
    description: "Review voided payments, reasons, and reversal visibility."
  },
  {
    key: "approval_review",
    title: "Approval review",
    description: "Confirm finance approvals are resolved or explicitly carried forward."
  },
  {
    key: "export_package",
    title: "Finance export package",
    description: "Generate the accountant package and keep export history visible."
  }
];

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function text(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value: unknown) {
  const raw = text(value);
  return raw ? raw.slice(0, 10) : "";
}

function parseTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function monthBounds(month: string) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const start = new Date(`${safeMonth}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCMilliseconds(-1);
  return {
    month: safeMonth,
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: MONTH_FORMATTER.format(start)
  };
}

function inPeriod(value: string | null | undefined, start: Date, end: Date) {
  const time = parseTime(value);
  return time !== null && time >= start.getTime() && time <= end.getTime();
}

function daysSince(value: string | null | undefined, now: Date) {
  const time = parseTime(value);
  if (time === null) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / 86400000));
}

function moneyValue(value: number, currency: "USD" | "LBP") {
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `LBP ${Math.round(value).toLocaleString("en-US")}`;
}

function rowProofs(invoice: FinanceInvoiceRow): MinimalProof[] {
  return (invoice.payment_proofs || []).map((proof) => ({
    status: proof.status || "",
    amount_usd: proof.amount_usd == null ? null : Number(proof.amount_usd),
    amount_lbp: proof.amount_lbp == null ? null : Number(proof.amount_lbp)
  }));
}

function balanceInput(invoice: FinanceInvoiceRow) {
  return {
    amount_usd: numberValue(invoice.amount_usd),
    amount_lbp: numberValue(invoice.amount_lbp),
    currency: invoice.currency,
    status: invoice.status
  };
}

function displayStatus(invoice: FinanceInvoiceRow) {
  const reconciled = reconcileInvoiceStatus(balanceInput(invoice), rowProofs(invoice));
  return getDisplayInvoiceStatus({ ...invoice, status: reconciled });
}

function invoiceLabel(invoice: Pick<FinanceInvoiceRow, "invoice_number" | "title"> | null | undefined) {
  if (!invoice) return "Invoice";
  return invoice.invoice_number ? `${invoice.invoice_number} - ${invoice.title || "Invoice"}` : invoice.title || "Invoice";
}

function invoiceNumber(invoice: Pick<FinanceInvoiceRow, "invoice_number" | "title">) {
  return invoice.invoice_number || invoice.title || "Invoice";
}

function clientName(invoice: Pick<FinanceInvoiceRow, "clients">) {
  return invoice.clients?.name || "No client";
}

function invoiceHref(invoiceId: string, anchor?: string) {
  return `/invoices/${invoiceId}${anchor ? `#${anchor}` : ""}`;
}

function isBillable(invoice: FinanceInvoiceRow) {
  return (invoice.document_type || "invoice") !== "quote";
}

function acceptedProofTime(proof: FinanceProofRow) {
  return proof.payment_date || proof.confirmed_at || proof.reviewed_at || proof.uploaded_at || null;
}

function proofAmountUsd(proof: FinanceProofRow) {
  return numberValue(proof.amount_usd);
}

function proofAmountLbp(proof: FinanceProofRow) {
  return numberValue(proof.amount_lbp);
}

function eventInvoice(invoiceById: Map<string, FinanceInvoiceRow>, event: FinanceEventRow) {
  return invoiceById.get(event.invoice_id) || null;
}

function mergeTaskStates(states: FinanceCloseTaskState[]) {
  const map = new Map(states.map((state) => [state.task_key, state]));
  return FINANCE_CLOSE_TASKS.map((task) => ({
    ...task,
    ...(map.get(task.key) || {
      task_key: task.key,
      status: "open" as FinanceCloseTaskStatus,
      note: null,
      completed_by_name: null,
      completed_at: null,
      updated_at: null
    })
  }));
}

function emptyCloseState(periodMonth: string): FinanceClosePeriodState {
  return {
    period_month: periodMonth,
    status: "draft",
    notes: null,
    signed_off_by_name: null,
    signed_off_at: null
  };
}

function reviewItem(input: Omit<ReconciliationReviewItem, "id"> & { id: string }) {
  return input;
}

function sortReviewItems(a: ReconciliationReviewItem, b: ReconciliationReviewItem) {
  const ta = parseTime(a.occurredAt) || 0;
  const tb = parseTime(b.occurredAt) || 0;
  if (ta !== tb) return tb - ta;
  return a.title.localeCompare(b.title);
}

function buildTimeline(input: {
  invoices: FinanceInvoiceRow[];
  events: FinanceEventRow[];
  approvals: FinanceApprovalRow[];
  exportRuns: FinanceExportRunRow[];
  start: Date;
  end: Date;
}) {
  const invoiceById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  const items: FinanceTimelineItem[] = [];
  const eventTypes = new Set([
    "proof_uploaded",
    "proof_accepted",
    "proof_rejected",
    "manual_payment",
    "payment_voided",
    "payment_plan_saved",
    "payment_plan_cleared",
    "payment_plan_milestone_updated",
    "deposit_requested",
    "deposit_satisfied",
    "reminder_copied",
    "assignment_created",
    "assignment_reassigned",
    "assignment_completed"
  ]);

  for (const event of input.events) {
    if (!eventTypes.has(event.event_type) || !inPeriod(event.created_at, input.start, input.end)) continue;
    const invoice = eventInvoice(invoiceById, event);
    items.push({
      id: event.id || `${event.invoice_id}:${event.created_at}:${event.event_type}`,
      type: event.event_type,
      title: event.event_type.replaceAll("_", " "),
      detail: event.message || "Financial activity recorded.",
      actor: event.actor_name || event.actor_role || null,
      occurredAt: event.created_at,
      invoiceNumber: invoice ? invoiceNumber(invoice) : null
    });
  }

  for (const approval of input.approvals) {
    if (!inPeriod(approval.created_at, input.start, input.end) && !inPeriod(approval.resolved_at, input.start, input.end)) continue;
    items.push({
      id: `approval:${approval.id}`,
      type: "approval",
      title: `${approval.type || "Approval"} ${approval.status}`,
      detail: approval.note || "Approval workflow activity.",
      actor: approval.approved_by_name || approval.requested_by_name || null,
      occurredAt: approval.resolved_at || approval.created_at,
      invoiceNumber: null
    });
  }

  for (const run of input.exportRuns) {
    if (!inPeriod(run.generated_at, input.start, input.end)) continue;
    items.push({
      id: `export:${run.id || `${run.export_type}:${run.generated_at}`}`,
      type: "export_generated",
      title: "Export generated",
      detail: `${run.title} (${Number(run.row_count || 0).toLocaleString()} rows).`,
      actor: run.generated_by_name || null,
      occurredAt: run.generated_at,
      invoiceNumber: null
    });
  }

  return items.sort((a, b) => (parseTime(b.occurredAt) || 0) - (parseTime(a.occurredAt) || 0)).slice(0, 120);
}

function rowsForExports(input: {
  modelCore: Pick<FinanceClosingModel, "periodMonth" | "periodLabel" | "summary" | "reconciliation" | "timeline">;
  invoices: FinanceInvoiceRow[];
  events: FinanceEventRow[];
  approvals: FinanceApprovalRow[];
  start: Date;
  end: Date;
}): FinanceExportDataset[] {
  const invoiceById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));

  const paymentAuditRows: CsvRow[] = [];
  const proofReviewRows: CsvRow[] = [];
  const voidRows: CsvRow[] = [];
  for (const invoice of input.invoices) {
    for (const proof of invoice.payment_proofs || []) {
      const proofStatus = text(proof.status).toLowerCase();
      const relevantDate = proofStatus === "voided" ? proof.voided_at : acceptedProofTime(proof);
      if (!inPeriod(relevantDate, input.start, input.end)) continue;
      const base = {
        "Invoice number": invoice.invoice_number || "",
        "Client name": clientName(invoice),
        "Proof status": proof.status || "",
        Method: formatPaymentMethod(proof.method) || text(proof.method),
        "Amount USD": proofAmountUsd(proof),
        "Amount LBP": proofAmountLbp(proof),
        "Uploaded at": dateOnly(proof.uploaded_at),
        "Reviewed at": dateOnly(proof.reviewed_at || proof.confirmed_at),
        "Payment date": dateOnly(proof.payment_date),
        Reviewer: proof.reviewer_name || proof.reviewer_role || "",
        "Reviewer note": text(proof.reviewer_decision_note || proof.note)
      };
      proofReviewRows.push(base);
      if (proofStatus === "accepted" || proofStatus === "voided") paymentAuditRows.push(base);
      if (proofStatus === "voided" || proof.voided_at) {
        voidRows.push({
          ...base,
          "Voided at": dateOnly(proof.voided_at),
          "Void reason": text(proof.void_reason)
        });
      }
    }
  }

  const recoveryRows: CsvRow[] = input.modelCore.reconciliation.unresolvedBalances.map((item) => ({
    "Invoice number": item.invoiceNumber,
    "Client name": item.clientName,
    Status: item.status,
    "Remaining USD": item.amountUsd,
    "Remaining LBP": item.amountLbp,
    Explanation: item.explanation,
    Formula: item.formula
  }));

  const approvalRows: CsvRow[] = input.approvals
    .filter((approval) => inPeriod(approval.created_at, input.start, input.end) || inPeriod(approval.resolved_at, input.start, input.end))
    .map((approval) => ({
      Type: approval.type || "",
      Status: approval.status,
      "Reference type": approval.reference_type || "",
      "Requested by": approval.requested_by_name || "",
      "Resolved by": approval.approved_by_name || "",
      "Threshold USD": approval.threshold_usd || "",
      Note: approval.note || "",
      "Created at": dateOnly(approval.created_at),
      "Resolved at": dateOnly(approval.resolved_at)
    }));

  const reviewerMap = new Map<string, { accepted: number; rejected: number; voided: number; totalHours: number; samples: number }>();
  for (const invoice of input.invoices) {
    for (const proof of invoice.payment_proofs || []) {
      if (!inPeriod(proof.reviewed_at || proof.confirmed_at, input.start, input.end)) continue;
      const reviewer = proof.reviewer_name || proof.reviewer_role || "Unassigned reviewer";
      const row = reviewerMap.get(reviewer) || { accepted: 0, rejected: 0, voided: 0, totalHours: 0, samples: 0 };
      const status = text(proof.status).toLowerCase();
      if (status === "accepted") row.accepted += 1;
      if (status === "rejected") row.rejected += 1;
      if (status === "voided") row.voided += 1;
      const start = parseTime(proof.uploaded_at);
      const end = parseTime(proof.reviewed_at || proof.confirmed_at);
      if (start !== null && end !== null && end >= start) {
        row.totalHours += (end - start) / 3600000;
        row.samples += 1;
      }
      reviewerMap.set(reviewer, row);
    }
  }
  const reviewerRows: CsvRow[] = [...reviewerMap.entries()].map(([reviewer, row]) => ({
    Reviewer: reviewer,
    Accepted: row.accepted,
    Rejected: row.rejected,
    Voided: row.voided,
    "Median/avg review hours": row.samples ? Math.round((row.totalHours / row.samples) * 10) / 10 : "",
    "Reviewed proofs": row.accepted + row.rejected + row.voided
  }));

  const monthlyRows: CsvRow[] = [
    {
      Period: input.modelCore.periodLabel,
      "Issued USD": input.modelCore.summary.issuedUsd,
      "Issued LBP": input.modelCore.summary.issuedLbp,
      "Collected USD": input.modelCore.summary.collectedUsd,
      "Collected LBP": input.modelCore.summary.collectedLbp,
      "Unpaid USD": input.modelCore.summary.unpaidUsd,
      "Unpaid LBP": input.modelCore.summary.unpaidLbp,
      "Overdue USD": input.modelCore.summary.overdueUsd,
      "Overdue LBP": input.modelCore.summary.overdueLbp,
      "Pending proofs": input.modelCore.summary.pendingProofCount,
      "Void count": input.modelCore.summary.voidCount,
      "Unresolved items": input.modelCore.summary.unresolvedCount
    }
  ];

  const operatorRows: CsvRow[] = input.events
    .filter((event) => inPeriod(event.created_at, input.start, input.end))
    .filter((event) => event.actor_name || event.actor_role)
    .map((event) => {
      const invoice = invoiceById.get(event.invoice_id);
      return {
        Operator: event.actor_name || event.actor_role || "",
        Role: event.actor_role || "",
        Action: event.event_type,
        "Invoice number": invoice?.invoice_number || "",
        Message: event.message || "",
        "Created at": dateOnly(event.created_at)
      };
    });

  const snapshotRows: CsvRow[] = [
    ...monthlyRows,
    ...input.modelCore.reconciliation.items.map((item) => ({
      Period: input.modelCore.periodLabel,
      "Review type": item.type,
      Title: item.title,
      "Invoice number": item.invoiceNumber,
      "Client name": item.clientName,
      Status: item.status,
      "Amount USD": item.amountUsd,
      "Amount LBP": item.amountLbp,
      Explanation: item.explanation,
      Formula: item.formula
    }))
  ];

  return [
    {
      key: "monthly_collections",
      title: "Monthly collections",
      description: "Period totals for issued, collected, unpaid, overdue, pending proof, void, and unresolved finance signals.",
      filename: `qaffel-monthly-collections-${input.modelCore.periodMonth}`,
      rows: monthlyRows
    },
    {
      key: "payment_audit_history",
      title: "Payment audit history",
      description: "Accepted and voided proof/payment records with reviewer, method, amount, and review timestamps.",
      filename: `qaffel-payment-audit-${input.modelCore.periodMonth}`,
      rows: paymentAuditRows
    },
    {
      key: "void_history",
      title: "Void history",
      description: "Voided payment records with reason, reviewer context, and original proof amounts.",
      filename: `qaffel-void-history-${input.modelCore.periodMonth}`,
      rows: voidRows
    },
    {
      key: "recovery_activity",
      title: "Recovery activity",
      description: "Unresolved overdue/open balances with deterministic remaining-balance formulas.",
      filename: `qaffel-recovery-activity-${input.modelCore.periodMonth}`,
      rows: recoveryRows
    },
    {
      key: "approval_history",
      title: "Approval history",
      description: "Approval requests and resolution status without internal identifiers.",
      filename: `qaffel-approval-history-${input.modelCore.periodMonth}`,
      rows: approvalRows
    },
    {
      key: "reviewer_activity",
      title: "Reviewer activity",
      description: "Reviewer-level proof activity and review timing derived from proof timestamps.",
      filename: `qaffel-reviewer-activity-${input.modelCore.periodMonth}`,
      rows: reviewerRows
    },
    {
      key: "proof_review_logs",
      title: "Proof review logs",
      description: "Proof-level review log with amounts, method, status, reviewer, and notes.",
      filename: `qaffel-proof-review-logs-${input.modelCore.periodMonth}`,
      rows: proofReviewRows
    },
    {
      key: "operator_accountability",
      title: "Operator accountability",
      description: "Operational finance events grouped by actor, role, invoice number, and timestamp.",
      filename: `qaffel-operator-accountability-${input.modelCore.periodMonth}`,
      rows: operatorRows
    },
    {
      key: "finance_close_snapshot",
      title: "Finance close snapshot",
      description: "Summary plus unresolved reconciliation items for the close package.",
      filename: `qaffel-finance-close-snapshot-${input.modelCore.periodMonth}`,
      rows: snapshotRows
    }
  ];
}

export function buildFinanceClosingModel(input: {
  periodMonth?: string | null;
  invoices: FinanceInvoiceRow[];
  events: FinanceEventRow[];
  approvals?: FinanceApprovalRow[];
  closeState?: FinanceClosePeriodState | null;
  taskStates?: FinanceCloseTaskState[];
  exportRuns?: FinanceExportRunRow[];
  now?: Date;
}): FinanceClosingModel {
  const bounds = monthBounds(input.periodMonth || new Date().toISOString().slice(0, 7));
  const now = input.now || new Date();
  const approvals = input.approvals || [];
  const exportRuns = input.exportRuns || [];
  const billable = input.invoices.filter(isBillable);
  const invoiceById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));

  const summary: FinanceClosingModel["summary"] = {
    issuedUsd: 0,
    issuedLbp: 0,
    collectedUsd: 0,
    collectedLbp: 0,
    unpaidUsd: 0,
    unpaidLbp: 0,
    overdueUsd: 0,
    overdueLbp: 0,
    pendingProofUsd: 0,
    pendingProofLbp: 0,
    partialUsd: 0,
    partialLbp: 0,
    voidedUsd: 0,
    voidedLbp: 0,
    recoveryUsd: 0,
    recoveryLbp: 0,
    unresolvedCount: 0,
    pendingProofCount: 0,
    voidCount: 0,
    partialCount: 0,
    overpaymentCount: 0
  };

  const items: ReconciliationReviewItem[] = [];

  for (const invoice of billable) {
    const proofs = rowProofs(invoice);
    const status = displayStatus(invoice);
    const balance = getRemainingBalance(balanceInput(invoice), proofs);
    const createdInPeriod = inPeriod(invoice.created_at, bounds.start, bounds.end);

    if (createdInPeriod) {
      summary.issuedUsd += numberValue(invoice.amount_usd);
      summary.issuedLbp += numberValue(invoice.amount_lbp);
    }

    if (["sent", "unpaid", "partial", "overdue"].includes(status)) {
      summary.unpaidUsd += balance.usd;
      summary.unpaidLbp += balance.lbp;
      if (balance.usd > 0 || balance.lbp > 0) {
        summary.unresolvedCount += 1;
        items.push(
          reviewItem({
            id: `unresolved:${invoice.id}`,
            type: "unresolved_balance",
            title: "Unresolved balance",
            clientName: clientName(invoice),
            invoiceNumber: invoiceNumber(invoice),
            href: invoiceHref(invoice.id),
            amountUsd: balance.usd,
            amountLbp: balance.lbp,
            status,
            explanation: "Invoice is still open after subtracting accepted proof totals from invoice totals.",
            formula: "remaining = invoice total - accepted proof totals",
            evidence: [`status ${status}`, `${balance.totalPaidUsd} USD accepted`, `${balance.totalPaidLbp} LBP accepted`],
            occurredAt: invoice.due_date || invoice.created_at
          })
        );
      }
    }

    if (status === "overdue") {
      summary.overdueUsd += balance.usd;
      summary.overdueLbp += balance.lbp;
      summary.recoveryUsd += balance.usd;
      summary.recoveryLbp += balance.lbp;
    }

    if (status === "partial") {
      summary.partialCount += 1;
      summary.partialUsd += balance.usd;
      summary.partialLbp += balance.lbp;
      items.push(
        reviewItem({
          id: `partial:${invoice.id}`,
          type: "partial_payment",
          title: "Partial payment open",
          clientName: clientName(invoice),
          invoiceNumber: invoiceNumber(invoice),
          href: invoiceHref(invoice.id),
          amountUsd: balance.usd,
          amountLbp: balance.lbp,
          status,
          explanation: "Accepted proof totals cover part of the invoice, with a remaining balance still visible.",
          formula: "partial remaining = invoice total - accepted proof totals",
          evidence: [`paid ${balance.totalPaidUsd} USD`, `paid ${balance.totalPaidLbp} LBP`],
          occurredAt: invoice.created_at
        })
      );
    }

    if (balance.primaryOverpaid > 0) {
      summary.overpaymentCount += 1;
      items.push(
        reviewItem({
          id: `overpayment:${invoice.id}`,
          type: "overpayment",
          title: "Possible overpayment",
          clientName: clientName(invoice),
          invoiceNumber: invoiceNumber(invoice),
          href: invoiceHref(invoice.id),
          amountUsd: balance.overpaidUsd,
          amountLbp: balance.overpaidLbp,
          status,
          explanation: "Accepted proof totals are greater than the invoice total in at least one currency.",
          formula: "overpayment = accepted proof totals - invoice total",
          evidence: [`overpaid USD ${balance.overpaidUsd}`, `overpaid LBP ${balance.overpaidLbp}`],
          occurredAt: invoice.created_at
        })
      );
    }

    const depositRequest = getDepositRequest(invoice);
    const depositStatus = getDepositStatus(invoice, proofs);
    if (depositRequest && depositStatus?.label === "Not paid" && status !== "paid") {
      items.push(
        reviewItem({
          id: `deposit:${invoice.id}`,
          type: "deposit_coverage",
          title: "Deposit not covered",
          clientName: clientName(invoice),
          invoiceNumber: invoiceNumber(invoice),
          href: invoiceHref(invoice.id, "follow-up"),
          amountUsd: depositRequest.currency === "USD" ? depositStatus.remainingDeposit : 0,
          amountLbp: depositRequest.currency === "LBP" ? depositStatus.remainingDeposit : 0,
          status: "deposit pending",
          explanation: "Requested deposit remains below the configured deposit amount.",
          formula: "deposit remaining = deposit request - accepted proof totals",
          evidence: [`deposit request ${depositRequest.amount} ${depositRequest.currency}`],
          occurredAt: invoice.created_at
        })
      );
    }

    const plan = parsePaymentPlan(invoice.payment_plan);
    if (plan) {
      const progress = paymentPlanProgress(plan);
      if (progress.remaining > 0) {
        const nextDue = progress.next?.due_date || null;
        items.push(
          reviewItem({
            id: `plan:${invoice.id}`,
            type: "payment_plan_balance",
            title: "Payment-plan balance open",
            clientName: clientName(invoice),
            invoiceNumber: invoiceNumber(invoice),
            href: invoiceHref(invoice.id),
            amountUsd: plan.currency === "USD" ? progress.remaining : 0,
            amountLbp: plan.currency === "LBP" ? progress.remaining : 0,
            status: nextDue && daysSince(nextDue, now) ? "milestone overdue" : "open plan",
            explanation: "At least one payment-plan milestone is not marked satisfied.",
            formula: "plan remaining = milestone total - satisfied milestones",
            evidence: [`${progress.satisfied} satisfied`, `${progress.remaining} remaining`, nextDue ? `next due ${nextDue}` : "no next due date"],
            occurredAt: nextDue || invoice.created_at
          })
        );
      }
    }

    for (const proof of invoice.payment_proofs || []) {
      const proofStatus = text(proof.status).toLowerCase();
      if (proofStatus === "accepted" && inPeriod(acceptedProofTime(proof), bounds.start, bounds.end)) {
        summary.collectedUsd += proofAmountUsd(proof);
        summary.collectedLbp += proofAmountLbp(proof);
        items.push(
          reviewItem({
            id: `accepted:${proof.id || `${invoice.id}:${acceptedProofTime(proof)}`}`,
            type: "accepted_proof",
            title: "Accepted proof",
            clientName: clientName(invoice),
            invoiceNumber: invoiceNumber(invoice),
            href: invoiceHref(invoice.id, "proofs-review"),
            amountUsd: proofAmountUsd(proof),
            amountLbp: proofAmountLbp(proof),
            status: "accepted",
            explanation: "Accepted payment proof contributes to collected totals and invoice balance reconciliation.",
            formula: "collected = sum accepted proof amounts in period",
            evidence: [formatPaymentMethod(proof.method) || text(proof.method) || "method not specified", proof.reviewer_name || "reviewer not recorded"],
            occurredAt: acceptedProofTime(proof)
          })
        );
      }

      if (proofStatus === "pending") {
        summary.pendingProofCount += 1;
        summary.pendingProofUsd += proofAmountUsd(proof);
        summary.pendingProofLbp += proofAmountLbp(proof);
      }

      if ((proofStatus === "voided" || proof.voided_at) && inPeriod(proof.voided_at, bounds.start, bounds.end)) {
        summary.voidCount += 1;
        summary.voidedUsd += proofAmountUsd(proof);
        summary.voidedLbp += proofAmountLbp(proof);
        items.push(
          reviewItem({
            id: `void:${proof.id || `${invoice.id}:${proof.voided_at}`}`,
            type: "voided_receipt",
            title: "Voided receipt",
            clientName: clientName(invoice),
            invoiceNumber: invoiceNumber(invoice),
            href: invoiceHref(invoice.id, "proofs-review"),
            amountUsd: proofAmountUsd(proof),
            amountLbp: proofAmountLbp(proof),
            status: "voided",
            explanation: "Voided payment proof is excluded from accepted proof totals and remains visible for audit review.",
            formula: "voided proofs do not count toward collected totals",
            evidence: [proof.void_reason || "void reason not recorded", proof.reviewer_name || "reviewer not recorded"],
            occurredAt: proof.voided_at
          })
        );
      }
    }
  }

  const sortedItems = items.sort(sortReviewItems);
  const reconciliation = {
    items: sortedItems,
    acceptedProofs: sortedItems.filter((item) => item.type === "accepted_proof"),
    partialPayments: sortedItems.filter((item) => item.type === "partial_payment"),
    overpayments: sortedItems.filter((item) => item.type === "overpayment"),
    voidedReceipts: sortedItems.filter((item) => item.type === "voided_receipt"),
    unresolvedBalances: sortedItems.filter((item) => item.type === "unresolved_balance"),
    depositCoverage: sortedItems.filter((item) => item.type === "deposit_coverage"),
    paymentPlanBalances: sortedItems.filter((item) => item.type === "payment_plan_balance")
  };

  const taskStateRows = mergeTaskStates(input.taskStates || []);
  const completedTasks = taskStateRows.filter((task) => task.status === "completed").length;
  const closeState = input.closeState || emptyCloseState(bounds.month);
  const timeline = buildTimeline({
    invoices: input.invoices,
    events: input.events,
    approvals,
    exportRuns,
    start: bounds.start,
    end: bounds.end
  });

  const metrics: FinanceSummaryMetric[] = [
    {
      label: "Issued this month",
      value: `${moneyValue(summary.issuedUsd, "USD")} / ${moneyValue(summary.issuedLbp, "LBP")}`,
      detail: "Invoice totals created in the close period.",
      tone: "neutral"
    },
    {
      label: "Collected this month",
      value: `${moneyValue(summary.collectedUsd, "USD")} / ${moneyValue(summary.collectedLbp, "LBP")}`,
      detail: "Accepted proof amounts dated in the close period.",
      tone: "good"
    },
    {
      label: "Unpaid balance",
      value: `${moneyValue(summary.unpaidUsd, "USD")} / ${moneyValue(summary.unpaidLbp, "LBP")}`,
      detail: "Open sent, unpaid, partial, and overdue balances.",
      tone: summary.unresolvedCount ? "watch" : "good"
    },
    {
      label: "Overdue exposure",
      value: `${moneyValue(summary.overdueUsd, "USD")} / ${moneyValue(summary.overdueLbp, "LBP")}`,
      detail: "Open balances on invoices currently overdue.",
      tone: summary.overdueUsd || summary.overdueLbp ? "risk" : "good"
    },
    {
      label: "Pending proofs",
      value: summary.pendingProofCount.toLocaleString(),
      detail: `${moneyValue(summary.pendingProofUsd, "USD")} / ${moneyValue(summary.pendingProofLbp, "LBP")} awaiting review.`,
      tone: summary.pendingProofCount ? "watch" : "good"
    },
    {
      label: "Void activity",
      value: summary.voidCount.toLocaleString(),
      detail: `${moneyValue(summary.voidedUsd, "USD")} / ${moneyValue(summary.voidedLbp, "LBP")} voided in period.`,
      tone: summary.voidCount ? "watch" : "neutral"
    }
  ];

  const modelCore = {
    periodMonth: bounds.month,
    periodLabel: bounds.label,
    summary,
    reconciliation,
    timeline
  };
  const exports = rowsForExports({
    modelCore,
    invoices: input.invoices,
    events: input.events,
    approvals,
    start: bounds.start,
    end: bounds.end
  });

  const attention: FinanceClosingModel["attention"] = [];
  if (summary.pendingProofCount > 0) {
    attention.push({
      id: "pending-proofs",
      title: "Proof-review backlog",
      detail: `${summary.pendingProofCount} pending proof${summary.pendingProofCount === 1 ? "" : "s"} must be reviewed or carried forward.`,
      href: "/proofs",
      severity: "watch"
    });
  }
  if (summary.overdueUsd > 0 || summary.overdueLbp > 0) {
    attention.push({
      id: "overdue-exposure",
      title: "Aging overdue exposure",
      detail: `${moneyValue(summary.overdueUsd, "USD")} / ${moneyValue(summary.overdueLbp, "LBP")} remains overdue.`,
      href: "/recoveries",
      severity: "risk"
    });
  }
  if (approvals.some((approval) => approval.status === "pending")) {
    attention.push({
      id: "pending-approvals",
      title: "Pending finance approvals",
      detail: `${approvals.filter((approval) => approval.status === "pending").length} approval request${approvals.filter((approval) => approval.status === "pending").length === 1 ? "" : "s"} still pending.`,
      href: "/team",
      severity: "watch"
    });
  }
  if (summary.voidCount > 0) {
    attention.push({
      id: "void-verification",
      title: "Void verification needed",
      detail: `${summary.voidCount} voided payment record${summary.voidCount === 1 ? "" : "s"} in this period.`,
      href: "/finance",
      severity: "watch"
    });
  }

  return {
    periodMonth: bounds.month,
    periodLabel: bounds.label,
    periodStart: bounds.startIso,
    periodEnd: bounds.endIso,
    closeState,
    checklist: taskStateRows,
    completion: {
      completed: completedTasks,
      total: taskStateRows.length,
      percentage: taskStateRows.length ? Math.round((completedTasks / taskStateRows.length) * 100) : 0,
      readyForSignoff: completedTasks === taskStateRows.length && taskStateRows.length > 0
    },
    summary,
    metrics,
    reconciliation,
    exports,
    timeline,
    exportRuns,
    attention
  };
}

export function buildFinanceExportCsv(input: {
  datasetKey: string;
  model: FinanceClosingModel;
}) {
  const dataset = input.model.exports.find((row) => row.key === input.datasetKey);
  return dataset || null;
}
