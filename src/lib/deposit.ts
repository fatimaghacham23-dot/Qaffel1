import { getAcceptedProofTotals, type MinimalProof } from "./status";
import type { InvoiceStatus } from "./types";

export type DepositType = "percent" | "fixed";
export type DepositCurrency = "USD" | "LBP";

export interface DepositInvoice {
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  currency?: string | null;
  status?: InvoiceStatus | string | null;
  deposit_enabled?: boolean | null;
  deposit_type?: string | null;
  deposit_percent?: number | string | null;
  deposit_amount_usd?: number | string | null;
  deposit_amount_lbp?: number | string | null;
  deposit_note?: string | null;
}

export interface DepositRequest {
  amount: number;
  amountUsd: number | null;
  amountLbp: number | null;
  currency: DepositCurrency;
  invoiceTotal: number;
  remainingAfterDeposit: number;
  type: DepositType;
  percent: number | null;
  note: string | null;
}

export interface DepositStatus {
  label: "Not paid" | "Paid / partially satisfied" | "Fully paid invoice";
  paidPrimary: number;
  remainingDeposit: number;
  request: DepositRequest;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getPrimaryCurrency(invoice: DepositInvoice): DepositCurrency {
  return (invoice.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
}

export function roundCurrencyAmount(amount: number, currency: DepositCurrency) {
  if (!Number.isFinite(amount)) return 0;
  return currency === "LBP" ? Math.round(amount) : Math.round(amount * 100) / 100;
}

export function getPrimaryInvoiceTotal(invoice: DepositInvoice) {
  const currency = getPrimaryCurrency(invoice);
  return currency === "USD" ? toNumber(invoice.amount_usd) : toNumber(invoice.amount_lbp);
}

export function getDepositRequest(invoice: DepositInvoice): DepositRequest | null {
  if (!invoice.deposit_enabled) return null;

  const currency = getPrimaryCurrency(invoice);
  const invoiceTotal = getPrimaryInvoiceTotal(invoice);
  const type = invoice.deposit_type === "fixed" ? "fixed" : "percent";
  const percent = invoice.deposit_percent === null || invoice.deposit_percent === undefined || invoice.deposit_percent === ""
    ? null
    : toNumber(invoice.deposit_percent);

  let amount = 0;
  if (type === "fixed") {
    amount = currency === "USD" ? toNumber(invoice.deposit_amount_usd) : toNumber(invoice.deposit_amount_lbp);
  } else if (percent !== null) {
    amount = roundCurrencyAmount((invoiceTotal * percent) / 100, currency);
  }

  if (amount <= 0) return null;

  const amountUsd = currency === "USD" ? amount : toNumber(invoice.deposit_amount_usd) || null;
  const amountLbp = currency === "LBP" ? amount : toNumber(invoice.deposit_amount_lbp) || null;

  return {
    amount,
    amountUsd,
    amountLbp,
    currency,
    invoiceTotal,
    remainingAfterDeposit: Math.max(0, roundCurrencyAmount(invoiceTotal - amount, currency)),
    type,
    percent,
    note: invoice.deposit_note || null
  };
}

export function getPrimaryPaidForDeposit(invoice: DepositInvoice, proofs: MinimalProof[]) {
  const totals = getAcceptedProofTotals(proofs);
  return getPrimaryCurrency(invoice) === "USD" ? totals.totalUsd : totals.totalLbp;
}

export function getDepositStatus(invoice: DepositInvoice, proofs: MinimalProof[]): DepositStatus | null {
  const request = getDepositRequest(invoice);
  if (!request) return null;

  const paidPrimary = getPrimaryPaidForDeposit(invoice, proofs);
  const invoiceIsPaid = invoice.status === "paid" || paidPrimary >= request.invoiceTotal;

  if (invoiceIsPaid) {
    return {
      label: "Fully paid invoice",
      paidPrimary,
      remainingDeposit: 0,
      request
    };
  }

  const remainingDeposit = Math.max(0, roundCurrencyAmount(request.amount - paidPrimary, request.currency));

  return {
    label: paidPrimary >= request.amount ? "Paid / partially satisfied" : "Not paid",
    paidPrimary,
    remainingDeposit,
    request
  };
}

export function didSatisfyDeposit(
  invoice: DepositInvoice,
  beforeProofs: MinimalProof[],
  afterProofs: MinimalProof[]
) {
  const before = getDepositStatus(invoice, beforeProofs);
  const after = getDepositStatus(invoice, afterProofs);
  return Boolean(before && after && before.label === "Not paid" && after.label !== "Not paid");
}
