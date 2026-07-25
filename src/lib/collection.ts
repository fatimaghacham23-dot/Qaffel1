import { isQuoteDocument } from "@/lib/documents";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import type { InvoiceStatus } from "@/lib/types";

export type CollectionInvoice = {
  id: string;
  status: InvoiceStatus;
  document_type?: string | null;
  currency?: string | null;
  amount_usd?: number | null;
  amount_lbp?: number | null;
  due_date?: string | null;
  created_at?: string | null;
  payment_proofs?: MinimalProof[] | null;
};

export type CurrencyTotals = Record<"USD" | "LBP", number>;
export const emptyCurrencyTotals = (): CurrencyTotals => ({ USD: 0, LBP: 0 });

/**
 * Collection metric rules: quotes and drafts do not count; cancelled/rejected
 * invoices do not count; only accepted, non-voided proofs reduce an outstanding balance.
 * Dates use the application's established date-only comparison.
 */
export function collectionStatus(invoice: CollectionInvoice) {
  const proofs = invoice.payment_proofs || [];
  return getDisplayInvoiceStatus({ ...invoice, status: reconcileInvoiceStatus(invoice, proofs) });
}

export function proofDisplayStatus(status: string | null | undefined) {
  if (status === "accepted") return "approved" as const;
  if (status === "rejected" || status === "voided") return "rejected" as const;
  return "awaiting_review" as const;
}

export function isOutstandingInvoice(invoice: CollectionInvoice) {
  if (isQuoteDocument(invoice) || invoice.status === "draft" || invoice.status === "rejected") return false;
  return ["sent", "unpaid", "partial", "overdue"].includes(collectionStatus(invoice));
}

export function isOverdueInvoice(invoice: CollectionInvoice) {
  return isOutstandingInvoice(invoice) && collectionStatus(invoice) === "overdue";
}

export function remainingForInvoice(invoice: CollectionInvoice) {
  return getRemainingBalance(invoice, invoice.payment_proofs || []);
}

export function addInvoiceBalance(totals: CurrencyTotals, invoice: CollectionInvoice) {
  const remaining = remainingForInvoice(invoice);
  const currency = (invoice.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
  totals[currency] += remaining.primaryBalance;
  return totals;
}

export function collectionTotals(invoices: CollectionInvoice[]) {
  const outstanding = emptyCurrencyTotals();
  const overdue = emptyCurrencyTotals();
  for (const invoice of invoices) {
    if (isOutstandingInvoice(invoice)) addInvoiceBalance(outstanding, invoice);
    if (isOverdueInvoice(invoice)) addInvoiceBalance(overdue, invoice);
  }
  return { outstanding, overdue };
}
