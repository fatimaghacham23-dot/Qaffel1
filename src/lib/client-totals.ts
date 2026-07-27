import { isOutstandingInvoice, isOverdueInvoice, isPaidInvoice, isPartiallyPaidInvoice, isUnpaidInvoice, remainingForInvoice } from "@/lib/collection";
import { filterCanonicalActiveWorkspaceInvoices, type WorkspaceInvoiceFact } from "@/lib/canonical-invoices";
import { getClientHealth, type ClientHealth } from "@/lib/operations";

export type ClientBalanceTotals = { billed: number; paid: number; balance: number; overpaid: number };
export type ClientCurrencyBalance = ClientBalanceTotals & { currency: "USD" | "LBP" };
export type ClientInvoiceSummary = { paid: number; partial: number; unpaid: number };
export type ClientTotals = {
  invoiceCount: number;
  invoiceSummary: ClientInvoiceSummary;
  balances: ClientCurrencyBalance[];
  health: ClientHealth;
};

export function deriveClientTotals(input: { workspaceId: string; clientId: string; invoices: WorkspaceInvoiceFact[] }): ClientTotals {
  const invoices = filterCanonicalActiveWorkspaceInvoices(input.invoices, input.workspaceId)
    .filter((invoice) => invoice.client_id === input.clientId);
  const invoiceSummary: ClientInvoiceSummary = { paid: 0, partial: 0, unpaid: 0 };
  const totalsByCurrency: Partial<Record<"USD" | "LBP", ClientBalanceTotals>> = {};

  for (const invoice of invoices) {
    if (isPaidInvoice(invoice)) invoiceSummary.paid += 1;
    else if (isPartiallyPaidInvoice(invoice)) invoiceSummary.partial += 1;
    else if (isUnpaidInvoice(invoice) || isOverdueInvoice(invoice)) invoiceSummary.unpaid += 1;

    const balance = remainingForInvoice(invoice);
    const currency = balance.primaryCurrency;
    const totals = totalsByCurrency[currency] || { billed: 0, paid: 0, balance: 0, overpaid: 0 };
    totals.billed += currency === "LBP" ? Number(invoice.amount_lbp || 0) : Number(invoice.amount_usd || 0);
    totals.paid += balance.primaryTotalPaid;
    totals.balance += balance.primaryBalance;
    totals.overpaid += balance.primaryOverpaid;
    totalsByCurrency[currency] = totals;
  }

  const balances = (["USD", "LBP"] as const)
    .flatMap((currency) => totalsByCurrency[currency] ? [{ currency, ...totalsByCurrency[currency] }] : []);
  const hasOverdueInvoice = invoices.some((invoice) => isOverdueInvoice(invoice));
  const hasOpenBalance = invoices.some((invoice) => isOutstandingInvoice(invoice));

  return {
    invoiceCount: invoices.length,
    invoiceSummary,
    balances,
    health: getClientHealth({ hasOverdueInvoice, hasOpenBalance })
  };
}
