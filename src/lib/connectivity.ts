import { formatPaymentMethod, money, shortDate } from "@/lib/format";
import { buildSharedReportUrl, getCanonicalAppUrl } from "@/lib/urls";
import { buildWorkspaceMonthlyReports, type WorkspaceReportInvoice } from "@/lib/workspace-monthly-report";
import type { OCEventRow, OCInvoiceRow } from "@/lib/operations-center";
import { parsePaymentPlan } from "@/lib/payment-plan";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import type { CsvRow } from "@/lib/csv";

export type ConnectivityFilters = {
  from?: string | null;
  to?: string | null;
  status?: string | null;
  client?: string | null;
};

export type ExportDatasetKey =
  | "invoices"
  | "clients"
  | "payments"
  | "proofs"
  | "recoveries"
  | "payment_plans"
  | "reminders"
  | "receipts"
  | "client_timeline"
  | "intelligence"
  | "workspace_archive";

export type ExportDataset = {
  key: ExportDatasetKey;
  title: string;
  description: string;
  filename: string;
  rows: CsvRow[];
};

export type ConnectivityModel = {
  datasets: ExportDataset[];
  stats: {
    invoices: number;
    clients: number;
    payments: number;
    proofs: number;
    reminders: number;
    openRecoveries: number;
  };
  snapshot: {
    collectedUsd: number;
    collectedLbp: number;
    openUsd: number;
    openLbp: number;
    overdueCount: number;
    proofReviewQueue: number;
    remindersCopied: number;
  };
  reportPresets: {
    key: string;
    title: string;
    description: string;
    rows: number;
  }[];
  whatsappSuggestions: {
    title: string;
    body: string;
  }[];
};

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
  if (!raw) return "";
  return raw.slice(0, 10);
}

function inRange(value: unknown, filters: ConnectivityFilters) {
  const d = dateOnly(value);
  if (!d) return true;
  if (filters.from && d < filters.from) return false;
  if (filters.to && d > filters.to) return false;
  return true;
}

function rowProofs(invoice: {
  payment_proofs?: Array<{
    status: string;
    amount_usd?: number | string | null;
    amount_lbp?: number | string | null;
  }> | null;
}): MinimalProof[] {
  return (invoice.payment_proofs || []).map((proof) => ({
    status: proof.status || "",
    amount_usd: proof.amount_usd === null || proof.amount_usd === undefined ? null : Number(proof.amount_usd),
    amount_lbp: proof.amount_lbp === null || proof.amount_lbp === undefined ? null : Number(proof.amount_lbp)
  }));
}

function displayStatus(invoice: OCInvoiceRow) {
  const reconciled = reconcileInvoiceStatus(invoice as never, rowProofs(invoice));
  return getDisplayInvoiceStatus({ ...invoice, status: reconciled });
}

function invoiceLabel(invoice: { invoice_number?: string | null; title?: string | null }) {
  return invoice.invoice_number ? `${invoice.invoice_number} - ${invoice.title || "Invoice"}` : invoice.title || "Invoice";
}

function clientNameFromInvoice(invoice: { clients?: { name?: string | null } | { name?: string | null }[] | null }) {
  const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
  return client?.name || "";
}

function matchesFilters(invoice: OCInvoiceRow, filters: ConnectivityFilters) {
  const status = (filters.status || "all").toLowerCase();
  const client = (filters.client || "").trim().toLowerCase();
  if (status !== "all" && displayStatus(invoice).toLowerCase() !== status) return false;
  if (client && !clientNameFromInvoice(invoice).toLowerCase().includes(client)) return false;
  return inRange(invoice.created_at, filters);
}

export function buildConnectivityModel(input: {
  invoices: OCInvoiceRow[];
  clients: Array<Record<string, unknown>>;
  events: OCEventRow[];
  filters?: ConnectivityFilters;
}): ConnectivityModel {
  const filters = input.filters || {};
  const invoices = input.invoices.filter((invoice) => matchesFilters(invoice, filters));
  const invoiceById = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  const clients = input.clients.filter((client) => inRange(client.created_at, filters));
  const events = input.events.filter((event) => inRange(event.created_at, filters));
  const billable = invoices.filter((invoice) => (invoice.document_type || "invoice") !== "quote");

  const invoiceRows: CsvRow[] = invoices.map((invoice) => {
    const balance = getRemainingBalance(invoice as never, rowProofs(invoice));
    return {
      "Document type": invoice.document_type || "invoice",
      "Invoice number": invoice.invoice_number || "",
      "Client name": clientNameFromInvoice(invoice),
      Title: invoice.title || "",
      Status: displayStatus(invoice),
      Currency: invoice.currency || "USD",
      "Amount USD": invoice.amount_usd || "",
      "Amount LBP": invoice.amount_lbp || "",
      "Confirmed paid USD": balance.totalPaidUsd,
      "Confirmed paid LBP": balance.totalPaidLbp,
      "Remaining USD": balance.usd,
      "Remaining LBP": balance.lbp,
      "Deposit enabled": invoice.deposit_enabled ? "yes" : "no",
      "Due date": dateOnly(invoice.due_date),
      "Created date": dateOnly(invoice.created_at),
      "Valid until": dateOnly(invoice.valid_until)
    };
  });

  const clientRows: CsvRow[] = clients.map((client) => ({
    "Client name": text(client.name),
    Email: text(client.email),
    Phone: text(client.phone),
    Notes: text(client.notes),
    "Created date": dateOnly(client.created_at)
  }));

  const proofRows: CsvRow[] = [];
  const paymentRows: CsvRow[] = [];
  for (const invoice of invoices) {
    for (const proof of invoice.payment_proofs || []) {
      if (!inRange(proof.uploaded_at || proof.payment_date, filters)) continue;
      const status = text(proof.status).toLowerCase();
      const row: CsvRow = {
        "Invoice number": invoice.invoice_number || "",
        "Client name": clientNameFromInvoice(invoice),
        Status: proof.status || "",
        Method: formatPaymentMethod(proof.method) || text(proof.method),
        "Amount USD": proof.amount_usd || "",
        "Amount LBP": proof.amount_lbp || "",
        "Payment date": dateOnly(proof.payment_date),
        "Uploaded at": dateOnly(proof.uploaded_at),
        "Confirmed at": dateOnly(proof.confirmed_at),
        "Voided at": dateOnly(proof.voided_at),
        "Void reason": text((proof as { void_reason?: string | null }).void_reason),
        Note: text((proof as { note?: string | null }).note)
      };
      proofRows.push(row);
      if (status === "accepted" || status === "voided") {
        paymentRows.push(row);
      }
    }
  }

  const recoveryRows: CsvRow[] = billable
    .filter((invoice) => ["sent", "unpaid", "partial", "overdue"].includes(displayStatus(invoice)))
    .map((invoice) => {
      const balance = getRemainingBalance(invoice as never, rowProofs(invoice));
      const lastReminder = events.find((event) => event.invoice_id === invoice.id && event.event_type === "reminder_copied");
      return {
        "Invoice number": invoice.invoice_number || "",
        "Client name": clientNameFromInvoice(invoice),
        Title: invoice.title || "",
        Status: displayStatus(invoice),
        "Remaining USD": balance.usd,
        "Remaining LBP": balance.lbp,
        "Due date": dateOnly(invoice.due_date),
        "Last reminder": dateOnly(lastReminder?.created_at),
        "Next action": displayStatus(invoice) === "overdue" ? "Review recovery follow-up" : "Monitor open balance"
      };
    });

  const paymentPlanRows: CsvRow[] = [];
  for (const invoice of invoices) {
    const plan = parsePaymentPlan(invoice.payment_plan);
    if (!plan) continue;
    for (const [index, milestone] of plan.milestones.entries()) {
      paymentPlanRows.push({
        "Invoice number": invoice.invoice_number || "",
        "Client name": clientNameFromInvoice(invoice),
        Title: invoice.title || "",
        "Milestone label": `Milestone ${index + 1}`,
        "Amount USD": milestone.amount_usd || "",
        "Amount LBP": milestone.amount_lbp || "",
        "Due date": dateOnly(milestone.due_date),
        "Satisfied at": dateOnly(milestone.satisfied_at),
        Status: milestone.satisfied_at ? "received" : "open"
      });
    }
  }

  const reminderRows: CsvRow[] = events
    .filter((event) => event.event_type === "reminder_copied")
    .map((event) => {
      const invoice = invoiceById.get(event.invoice_id);
      const metadata = event.metadata || {};
      return {
        "Invoice number": invoice?.invoice_number || "",
        "Client name": invoice ? clientNameFromInvoice(invoice) : "",
        Message: event.message || "",
        Channel: text((metadata as { channel?: unknown }).channel),
        Stage: text((metadata as { stage?: unknown }).stage),
        "Copied at": dateOnly(event.created_at)
      };
    });

  const timelineRows: CsvRow[] = events
    .filter((event) =>
      [
        "reminder_copied",
        "receipt_viewed",
        "proof_uploaded",
        "proof_accepted",
        "proof_rejected",
        "payment_voided",
        "manual_payment",
        "client_approved",
        "client_rejected",
        "payment_link_extended",
        "pay_link_regenerated",
        "payment_plan_saved",
        "payment_plan_milestone_updated"
      ].includes(event.event_type)
    )
    .map((event) => {
      const invoice = invoiceById.get(event.invoice_id);
      return {
        "Invoice number": invoice?.invoice_number || "",
        "Client name": invoice ? clientNameFromInvoice(invoice) : "",
        "Event type": event.event_type,
        Message: event.message || "",
        "Created at": dateOnly(event.created_at)
      };
    });

  const receiptRows: CsvRow[] = paymentRows.map((row) => ({
    "Invoice number": row["Invoice number"],
    "Client name": row["Client name"],
    Status: row.Status,
    Method: row.Method,
    "Amount USD": row["Amount USD"],
    "Amount LBP": row["Amount LBP"],
    "Payment date": row["Payment date"],
    "Confirmed at": row["Confirmed at"],
    "Voided at": row["Voided at"],
    "Receipt note": row.Note
  }));

  const intelligenceRows: CsvRow[] = buildWorkspaceMonthlyReports({
    invoices: invoices as WorkspaceReportInvoice[],
    clients: input.clients.map((client) => ({ created_at: text(client.created_at) }))
  }).map((row) => ({
    Month: row.monthLabel,
    Currency: row.currency,
    Metric: "collection_summary",
    "Invoices created": row.invoicesCreated,
    Amount: row.collected,
    "Overdue amount": row.overdue,
    "New clients": row.newClients,
    "Top payment method": row.topMethod || ""
  }));
  let collectedUsd = 0;
  let collectedLbp = 0;
  let openUsd = 0;
  let openLbp = 0;
  let overdueCount = 0;
  let proofReviewQueue = 0;
  for (const invoice of billable) {
    const balance = getRemainingBalance(invoice as never, rowProofs(invoice));
    collectedUsd += balance.totalPaidUsd;
    collectedLbp += balance.totalPaidLbp;
    if (["sent", "unpaid", "partial", "overdue"].includes(displayStatus(invoice))) {
      openUsd += balance.usd;
      openLbp += balance.lbp;
    }
    if (displayStatus(invoice) === "overdue") overdueCount += 1;
    proofReviewQueue += (invoice.payment_proofs || []).filter((proof) => text(proof.status).toLowerCase() === "pending").length;
  }

  const workspaceArchiveRows: CsvRow[] = [
    ...invoiceRows.map((row) => ({ Record: "invoice", ...row })),
    ...paymentRows.map((row) => ({ Record: "payment", ...row })),
    ...clientRows.map((row) => ({ Record: "client", ...row })),
    ...recoveryRows.map((row) => ({ Record: "recovery", ...row })),
    ...paymentPlanRows.map((row) => ({ Record: "payment_plan", ...row })),
    ...reminderRows.map((row) => ({ Record: "reminder", ...row })),
    ...receiptRows.map((row) => ({ Record: "receipt", ...row })),
    ...timelineRows.map((row) => ({ Record: "client_timeline", ...row }))
  ];

  const datasets: ExportDataset[] = [
    {
      key: "invoices",
      title: "Invoices and quotes",
      description: "Document totals, statuses, dates, deposits, confirmed paid amounts, and remaining balances.",
      filename: "qaffel-invoices",
      rows: invoiceRows
    },
    {
      key: "payments",
      title: "Accepted and voided payments",
      description: "Payment records suitable for reconciliation, including void reasons when present.",
      filename: "qaffel-payments",
      rows: paymentRows
    },
    {
      key: "proofs",
      title: "Proof review log",
      description: "All proof statuses and review timestamps without storage paths or private file URLs.",
      filename: "qaffel-proof-review",
      rows: proofRows
    },
    {
      key: "recoveries",
      title: "Recovery workbook",
      description: "Open balances, overdue status, last reminder date, and suggested manual follow-up area.",
      filename: "qaffel-recoveries",
      rows: recoveryRows
    },
    {
      key: "payment_plans",
      title: "Payment plans",
      description: "Milestone-level export for installment and deposit follow-through.",
      filename: "qaffel-payment-plans",
      rows: paymentPlanRows
    },
    {
      key: "clients",
      title: "Clients",
      description: "Client contact list for operational continuity and accountant coordination.",
      filename: "qaffel-clients",
      rows: clientRows
    },
    {
      key: "reminders",
      title: "Reminder history",
      description: "Manual reminder copy activity by invoice, stage, and channel.",
      filename: "qaffel-reminders",
      rows: reminderRows
    },
    {
      key: "receipts",
      title: "Receipt records",
      description: "Accepted and voided receipt-facing payment records without public tokens or file paths.",
      filename: "qaffel-receipt-records",
      rows: receiptRows
    },
    {
      key: "client_timeline",
      title: "Client communication timeline",
      description: "Operational history for reminders, receipts, proof review, recovery, and payment-plan interactions.",
      filename: "qaffel-client-timeline",
      rows: timelineRows
    },
    {
      key: "intelligence",
      title: "Intelligence reports",
      description: "Monthly operational metrics generated from real workspace records.",
      filename: "qaffel-intelligence",
      rows: intelligenceRows
    },
    {
      key: "workspace_archive",
      title: "Workspace archive",
      description: "Combined operational archive for long-term ownership of business history.",
      filename: "qaffel-workspace-archive",
      rows: workspaceArchiveRows
    }
  ];

  const appUrl = getCanonicalAppUrl();
  const whatsappSuggestions = recoveryRows.slice(0, 3).map((row) => ({
    title: `${row["Client name"] || "Client"} - ${row["Invoice number"] || "invoice"}`,
    body: `Hi ${row["Client name"] || ""}, sharing a quick update on ${row["Invoice number"] || "your invoice"}. The current remaining balance is ${row["Remaining USD"] ? money(row["Remaining USD"], "USD") : money(row["Remaining LBP"], "LBP")}. You can review the payment link from the invoice message or reply here if anything needs clarification.`
  }));
  if (whatsappSuggestions.length === 0) {
    whatsappSuggestions.push({
      title: "Receipt follow-up",
      body: `Hi, payment records are available in Qaffel when receipts are issued. I can share the relevant invoice or receipt link from ${appUrl} when needed.`
    });
  }

  return {
    datasets,
    stats: {
      invoices: invoiceRows.length,
      clients: clientRows.length,
      payments: paymentRows.length,
      proofs: proofRows.length,
      reminders: reminderRows.length,
      openRecoveries: recoveryRows.length
    },
    snapshot: {
      collectedUsd,
      collectedLbp,
      openUsd,
      openLbp,
      overdueCount,
      proofReviewQueue,
      remindersCopied: reminderRows.length
    },
    reportPresets: [
      {
        key: "monthly_collections",
        title: "Monthly collections report",
        description: "Collected, overdue, new client, and payment-method summary by month.",
        rows: intelligenceRows.length
      },
      {
        key: "overdue_summary",
        title: "Overdue summary",
        description: "Open overdue invoices with remaining balances and follow-up context.",
        rows: recoveryRows.filter((row) => row.Status === "overdue").length
      },
      {
        key: "proof_review_summary",
        title: "Proof review summary",
        description: "Proof status and method activity for manual payment environments.",
        rows: proofRows.length
      },
      {
        key: "recovery_progress",
        title: "Recovery progress summary",
        description: "Recovery workload and reminder continuity.",
        rows: recoveryRows.length
      }
    ],
    whatsappSuggestions
  };
}

export function humanReportType(type: string) {
  const map: Record<string, string> = {
    monthly_collections: "Monthly collections report",
    overdue_summary: "Overdue summary",
    client_payment_history: "Client payment history",
    proof_review_summary: "Proof review summary",
    recovery_progress: "Recovery progress summary",
    payment_summary: "Payment summary",
    invoice_summary: "Invoice summary"
  };
  return map[type] || "Business report";
}

export function sharedReportUrl(tokenValue: string) {
  return buildSharedReportUrl(tokenValue);
}

export function formatShareExpiration(value: string | null | undefined) {
  if (!value) return "No expiration set";
  return shortDate(value);
}
