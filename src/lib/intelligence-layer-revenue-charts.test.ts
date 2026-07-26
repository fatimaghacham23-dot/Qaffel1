import { describe, expect, it } from "vitest";
import { buildIntelligenceBundle, deriveRevenueCurrencyFacts } from "@/lib/intelligence-layer";
import type { OCInvoiceProof, OCInvoiceRow } from "@/lib/operations-center";

const month = new Date().toISOString().slice(0, 7);
const occurredAt = `${month}-15T12:00:00.000Z`;
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function proof(id: string, overrides: Partial<OCInvoiceProof> = {}): OCInvoiceProof {
  return {
    id,
    status: "accepted",
    amount_usd: 0,
    amount_lbp: 0,
    uploaded_at: occurredAt,
    confirmed_at: occurredAt,
    method: "Cash",
    ...overrides
  };
}

function invoice(
  id: string,
  workspaceId: string | null,
  currency: "USD" | "LBP",
  proofs: OCInvoiceProof[],
  overrides: Partial<OCInvoiceRow> = {}
): OCInvoiceRow {
  return {
    id,
    workspace_id: workspaceId,
    title: "Invoice",
    status: "sent",
    document_type: "invoice",
    currency,
    amount_usd: currency === "USD" ? 100 : null,
    amount_lbp: currency === "LBP" ? 1_000_000 : null,
    due_date: yesterday,
    created_at: occurredAt,
    public_token: `token-${id}`,
    payment_proofs: proofs,
    ...overrides
  };
}

function value(bundle: ReturnType<typeof buildIntelligenceBundle>, currency: string, metric: string) {
  const chart = bundle.revenue.currencyCharts.find((candidate) => candidate.currency === currency);
  const row = chart?.rows.find((candidate) => candidate.month === month);
  return row?.values[`${currency}:${metric}`];
}

describe("currency-safe revenue facts", () => {
  it("keeps collected, billed, and remaining overdue values separate by currency", () => {
    const bundle = buildIntelligenceBundle({
      workspaceId: "workspace-a",
      invoices: [
        invoice("usd", "workspace-a", "USD", [proof("accepted", { amount_usd: 40 })]),
        invoice("lbp", "workspace-a", "LBP", [proof("lbp-accepted", { amount_lbp: 250_000 })])
      ],
      events: [],
      clients: []
    });

    expect(bundle.revenue.currencyCharts.map((chart) => chart.currency)).toEqual(["LBP", "USD"]);
    expect(value(bundle, "USD", "collected")).toBe(40);
    expect(value(bundle, "USD", "billed")).toBe(100);
    expect(value(bundle, "USD", "overdue")).toBe(60);
    expect(value(bundle, "LBP", "collected")).toBe(250_000);
    expect(value(bundle, "LBP", "billed")).toBe(1_000_000);
    expect(value(bundle, "LBP", "overdue")).toBe(750_000);
    expect(bundle.revenue.currencyCharts.every((chart) => chart.rows.length === 12)).toBe(true);
    expect(bundle.revenue.currencyCharts.every((chart) => chart.series.every((series) => series.currency === chart.currency))).toBe(true);
  });

  it("excludes pending, rejected, voided, quote, inactive, foreign, and null-workspace records", () => {
    const bundle = buildIntelligenceBundle({
      workspaceId: "workspace-a",
      invoices: [
        invoice("pending", "workspace-a", "USD", [proof("pending", { status: "pending", amount_usd: 10 })]),
        invoice("rejected-proof", "workspace-a", "USD", [proof("rejected", { status: "rejected", amount_usd: 20 })]),
        invoice("voided", "workspace-a", "USD", [proof("voided", { amount_usd: 30, voided_at: occurredAt })]),
        invoice("quote", "workspace-a", "USD", [proof("quote", { amount_usd: 40 })], { document_type: "quote" }),
        invoice("inactive", "workspace-a", "USD", [proof("inactive", { amount_usd: 50 })], { status: "rejected" }),
        invoice("foreign", "workspace-b", "USD", [proof("foreign", { amount_usd: 60 })]),
        invoice("legacy", null, "USD", [proof("legacy", { amount_usd: 70 })])
      ],
      events: [],
      clients: []
    });

    expect(value(bundle, "USD", "collected")).toBe(0);
    expect(value(bundle, "USD", "billed")).toBe(300);
    expect(value(bundle, "USD", "overdue")).toBe(300);
  });

  it("preserves the continuous 12-month reporting period and legacy KPI fields", () => {
    const bundle = buildIntelligenceBundle({
      workspaceId: "workspace-a",
      invoices: [invoice("paid", "workspace-a", "USD", [proof("paid", { amount_usd: 100 })])],
      events: [],
      clients: []
    });

    expect(bundle.revenue.currencyCharts).toHaveLength(1);
    expect(bundle.revenue.currencyCharts[0].rows).toHaveLength(12);
    expect(bundle.revenue.currencyCharts[0].rows.map((row) => row.month)).toEqual([...bundle.revenue.currencyCharts[0].rows.map((row) => row.month)].sort());
    expect(bundle.revenue.bestEarningMonthUsd).toBe(100);
    expect(bundle.revenue.averageInvoiceUsd).toBe(100);
    expect(value(bundle, "USD", "overdue")).toBe(0);
  });

  it("returns factual inputs only for supplied active invoices and reporting months", () => {
    const facts = deriveRevenueCurrencyFacts({
      invoices: [invoice("outside", "workspace-a", "USD", [proof("accepted", { amount_usd: 100 })])],
      reportingMonths: ["2020-01"]
    });
    expect(facts).toEqual([]);
  });
});