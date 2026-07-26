import { isQuoteDocument } from "@/lib/documents";
import { getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import { todayIso } from "@/lib/format";
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
export function collectionStatus(invoice: CollectionInvoice, today = todayIso()) {
  const status = reconcileInvoiceStatus(invoice, invoice.payment_proofs || []);
  if ((status === "sent" || status === "unpaid") && invoice.due_date && invoice.due_date < today) return "overdue";
  return status;
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

export function isOverdueInvoice(invoice: CollectionInvoice, today = todayIso()) {
  return isOutstandingInvoice(invoice) && collectionStatus(invoice, today) === "overdue";
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


/** Canonical financial predicates: quotes, drafts and rejected/voided records never contribute to operational balances. */
export function isQuote(invoice: CollectionInvoice) { return isQuoteDocument(invoice); }
export function isVoidedInvoice(invoice: CollectionInvoice) { return invoice.status === "rejected"; }
export function isCancelledInvoice(invoice: CollectionInvoice) { return invoice.status === "rejected"; }
export function isActiveInvoice(invoice: CollectionInvoice) { return !isQuote(invoice) && !["draft", "rejected"].includes(invoice.status); }
export function isPaidInvoice(invoice: CollectionInvoice) { return isActiveInvoice(invoice) && collectionStatus(invoice) === "paid"; }
export function isPartiallyPaidInvoice(invoice: CollectionInvoice) { return isActiveInvoice(invoice) && collectionStatus(invoice) === "partial" && remainingForInvoice(invoice).primaryBalance > 0; }
export function isUnpaidInvoice(invoice: CollectionInvoice) { return isActiveInvoice(invoice) && ["sent", "unpaid"].includes(collectionStatus(invoice)) && remainingForInvoice(invoice).primaryBalance > 0; }
export function getOutstandingBalance(invoice: CollectionInvoice) { return isOutstandingInvoice(invoice) ? remainingForInvoice(invoice) : { ...remainingForInvoice(invoice), primaryBalance: 0, usd: 0, lbp: 0 }; }
export function isAcceptedNonVoidedPayment(payment: Pick<MinimalProof, "voided_at"> & { status?: string | null }) { return payment.status === "accepted" && !payment.voided_at; }
export function isDueWithinSevenDays(invoice: CollectionInvoice, today: string, sevenDays: string) { return isOutstandingInvoice(invoice) && !isOverdueInvoice(invoice, today) && Boolean(invoice.due_date) && invoice.due_date! >= today && invoice.due_date! <= sevenDays; }
