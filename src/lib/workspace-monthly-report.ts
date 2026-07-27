import {
  getOutstandingBalance,
  isAcceptedNonVoidedPayment,
  isActiveInvoice,
  isOverdueInvoice,
  type CollectionInvoice
} from "@/lib/collection";

export type WorkspaceReportInvoice = CollectionInvoice & {
  created_at?: string | null;
  payment_proofs?: Array<{
    status?: string | null;
    amount_usd?: number | null;
    amount_lbp?: number | null;
    confirmed_at?: string | null;
    reviewed_at?: string | null;
    uploaded_at?: string | null;
    method?: string | null;
    voided_at?: string | null;
  }> | null;
};

export type WorkspaceMonthlyReportRow = {
  monthKey: string;
  monthLabel: string;
  currency: "USD" | "LBP";
  invoicesCreated: number;
  collected: number;
  overdue: number;
  newClients: number;
  topMethod: string | null;
};

type ClientCreatedAt = { created_at?: string | null };

type MutableRow = WorkspaceMonthlyReportRow & { methods: Map<string, number> };

function monthKey(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : null;
}

function currencyFor(invoice: CollectionInvoice): "USD" | "LBP" {
  return (invoice.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
}

function rowKey(month: string, currency: "USD" | "LBP") {
  return `${month}:${currency}`;
}

function labelFor(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, value - 1, 1)));
}

function safeNumber(value: number | null | undefined) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

/**
 * Currency-safe monthly reporting. Every payment is counted only through its
 * invoice, so a workspace-scoped invoice query cannot import foreign proofs.
 */
export function buildWorkspaceMonthlyReports(input: { invoices: WorkspaceReportInvoice[]; clients?: ClientCreatedAt[]; today?: string }): WorkspaceMonthlyReportRow[] {
  const rows = new Map<string, MutableRow>();
  const clientMonths = new Map<string, number>();
  for (const client of input.clients || []) {
    const month = monthKey(client.created_at);
    if (month) clientMonths.set(month, (clientMonths.get(month) || 0) + 1);
  }
  const ensure = (month: string, currency: "USD" | "LBP") => {
    const key = rowKey(month, currency);
    const existing = rows.get(key);
    if (existing) return existing;
    const created: MutableRow = { monthKey: month, monthLabel: labelFor(month), currency, invoicesCreated: 0, collected: 0, overdue: 0, newClients: clientMonths.get(month) || 0, topMethod: null, methods: new Map() };
    rows.set(key, created);
    return created;
  };

  for (const invoice of input.invoices) {
    if (!isActiveInvoice(invoice)) continue;
    const currency = currencyFor(invoice);
    const createdMonth = monthKey(invoice.created_at);
    if (createdMonth) ensure(createdMonth, currency).invoicesCreated += 1;
    if (isOverdueInvoice(invoice, input.today) && invoice.due_date) {
      const dueMonth = monthKey(invoice.due_date);
      if (dueMonth) ensure(dueMonth, currency).overdue += getOutstandingBalance(invoice).primaryBalance;
    }
    for (const payment of invoice.payment_proofs || []) {
      if (!isAcceptedNonVoidedPayment(payment)) continue;
      const paidMonth = monthKey(payment.confirmed_at || payment.reviewed_at || payment.uploaded_at);
      if (!paidMonth) continue;
      const row = ensure(paidMonth, currency);
      row.collected += currency === "LBP" ? safeNumber(payment.amount_lbp) : safeNumber(payment.amount_usd);
      const method = payment.method?.trim() || "Unspecified";
      row.methods.set(method, (row.methods.get(method) || 0) + 1);
    }
  }

  return [...rows.values()]
    .map(({ methods, ...row }) => ({ ...row, topMethod: [...methods.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey) || a.currency.localeCompare(b.currency));
}

export function buildWorkspaceMonthlyReportCsv(month: string, rows: WorkspaceMonthlyReportRow[]) {
  const selected = rows.filter((row) => row.monthKey === month);
  const header = "month,currency,invoices_created,collected,overdue,new_clients,top_method";
  const body = selected.map((row) => [row.monthKey, row.currency, row.invoicesCreated, row.collected, row.overdue, row.newClients, row.topMethod || ""].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  return [header, ...body].join("\n");
}