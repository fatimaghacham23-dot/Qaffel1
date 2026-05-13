import { todayIso } from "./format";
import type { InvoiceStatus } from "./types";

export function getDisplayInvoiceStatus(invoice: { status: InvoiceStatus; due_date?: string | null }): string {
  if (invoice.status === "paid") return "paid";
  if (invoice.status === "partial") return "partial";
  if (invoice.status === "rejected") return "rejected";

  if (invoice.due_date && invoice.due_date < todayIso()) {
    if (invoice.status === "unpaid" || invoice.status === "sent") {
      return "overdue";
    }
  }

  return invoice.status;
}

export interface MinimalProof {
  status: string;
  amount_usd?: number | null;
  amount_lbp?: number | null;
}

export function getAcceptedProofTotals(proofs: MinimalProof[]) {
  const accepted = proofs.filter((p) => p.status === "accepted");
  return {
    totalUsd: accepted.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0),
    totalLbp: accepted.reduce((sum, p) => sum + Number(p.amount_lbp || 0), 0),
    hasMissingAmounts: accepted.some((p) => p.amount_usd === null && p.amount_lbp === null)
  };
}

export function getRemainingBalance(
  invoice: { amount_usd?: number | null; amount_lbp?: number | null; status: InvoiceStatus; currency?: string | null },
  proofs: MinimalProof[]
) {
  const totals = getAcceptedProofTotals(proofs);
  const currency = (invoice.currency || "USD").toUpperCase();
  
  const rawRemainingUsd = Number(invoice.amount_usd || 0) - totals.totalUsd;
  const rawRemainingLbp = Number(invoice.amount_lbp || 0) - totals.totalLbp;

  const overpaidUsd = Math.max(0, totals.totalUsd - Number(invoice.amount_usd || 0));
  const overpaidLbp = Math.max(0, totals.totalLbp - Number(invoice.amount_lbp || 0));

  // If partial and we have missing amounts in accepted proofs, balance is unknown
  const unknown = (invoice.status === "partial" || invoice.status === "paid") && totals.hasMissingAmounts;

  const res = {
    usd: Math.max(0, rawRemainingUsd),
    lbp: Math.max(0, rawRemainingLbp),
    totalPaidUsd: totals.totalUsd,
    totalPaidLbp: totals.totalLbp,
    overpaidUsd,
    overpaidLbp,
    unknown,
    // Add primary currency flags for display
    primaryCurrency: currency as "USD" | "LBP",
    primaryBalance: currency === "USD" ? Math.max(0, rawRemainingUsd) : Math.max(0, rawRemainingLbp),
    primaryOverpaid: currency === "USD" ? overpaidUsd : overpaidLbp,
    primaryTotalPaid: currency === "USD" ? totals.totalUsd : totals.totalLbp
  };

  return res;
}

export function reconcileInvoiceStatus(
  invoice: { amount_usd?: number | null; amount_lbp?: number | null; currency?: string | null; status: InvoiceStatus },
  proofs: MinimalProof[]
): InvoiceStatus {
  const { totalUsd, totalLbp } = getAcceptedProofTotals(proofs);
  const currency = (invoice.currency || "USD").toUpperCase();

  if (currency === "USD" && invoice.amount_usd && invoice.amount_usd > 0) {
    if (totalUsd >= invoice.amount_usd) return "paid";
    if (totalUsd > 0) return "partial";
  } else if (currency === "LBP" && invoice.amount_lbp && invoice.amount_lbp > 0) {
    if (totalLbp >= invoice.amount_lbp) return "paid";
    if (totalLbp > 0) return "partial";
  } else {
    // Fallback logic
    if (invoice.amount_usd && invoice.amount_usd > 0) {
      if (totalUsd >= invoice.amount_usd) return "paid";
      if (totalUsd > 0) return "partial";
    } else if (invoice.amount_lbp && invoice.amount_lbp > 0) {
      if (totalLbp >= invoice.amount_lbp) return "paid";
      if (totalLbp > 0) return "partial";
    }
  }

  return invoice.status === "paid" || invoice.status === "partial" ? "partial" : invoice.status;
}
