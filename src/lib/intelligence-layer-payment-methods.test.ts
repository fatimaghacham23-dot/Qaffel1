import { describe, expect, it } from "vitest";
import { buildIntelligenceBundle } from "@/lib/intelligence-layer";
import type { OCInvoiceProof, OCInvoiceRow } from "@/lib/operations-center";

const activeMonth = new Date().toISOString().slice(0, 7);
const occurredAt = `${activeMonth}-15T12:00:00.000Z`;

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

function invoice(id: string, workspaceId: string | null, currency: "USD" | "LBP", proofs: OCInvoiceProof[]): OCInvoiceRow {
  return {
    id,
    workspace_id: workspaceId,
    title: "Invoice",
    status: "sent",
    document_type: "invoice",
    currency,
    amount_usd: currency === "USD" ? 100 : null,
    amount_lbp: currency === "LBP" ? 1_000_000 : null,
    created_at: occurredAt,
    public_token: `token-${id}`,
    payment_proofs: proofs
  };
}

describe("payment-method intelligence facts", () => {
  it("keeps accepted, non-voided workspace payments factual and separate by currency", () => {
    const bundle = buildIntelligenceBundle({
      workspaceId: "workspace-a",
      invoices: [
        invoice("usd", "workspace-a", "USD", [proof("usd-accepted", { amount_usd: 25, method: "Bank" })]),
        invoice("lbp", "workspace-a", "LBP", [proof("lbp-accepted", { amount_lbp: 2_000_000, method: "Cash" })]),
        invoice("pending", "workspace-a", "USD", [proof("pending", { status: "pending", amount_usd: 80 })]),
        invoice("rejected", "workspace-a", "USD", [proof("rejected", { status: "rejected", amount_usd: 80 })]),
        invoice("voided", "workspace-a", "USD", [proof("voided", { amount_usd: 80, voided_at: occurredAt })]),
        invoice("foreign", "workspace-b", "USD", [proof("foreign", { amount_usd: 90 })]),
        invoice("legacy", null, "USD", [proof("legacy", { amount_usd: 90 })])
      ],
      events: [],
      clients: []
    });

    expect(bundle.paymentMethodCurrencyCharts.map((chart) => chart.currency)).toEqual(["LBP", "USD"]);
    expect(bundle.paymentMethodCurrencyCharts[0]).toMatchObject({
      currency: "LBP",
      series: [{ key: "LBP:Cash", stackId: "method:LBP" }]
    });
    expect(bundle.paymentMethodCurrencyCharts[1]).toMatchObject({
      currency: "USD",
      series: [{ key: "USD:Bank", stackId: "method:USD" }]
    });
    expect(bundle.paymentMethodCurrencyCharts[0].rows[0].values["LBP:Cash"]).toBe(2_000_000);
    expect(bundle.paymentMethodCurrencyCharts[1].rows[0].values["USD:Bank"]).toBe(25);
  });

  it("returns no chart facts when no accepted non-voided payment belongs to the active workspace", () => {
    const bundle = buildIntelligenceBundle({
      workspaceId: "workspace-a",
      invoices: [
        invoice("foreign", "workspace-b", "USD", [proof("foreign", { amount_usd: 90 })]),
        invoice("legacy", null, "LBP", [proof("legacy", { amount_lbp: 9_000_000 })]),
        invoice("pending", "workspace-a", "USD", [proof("pending", { status: "pending", amount_usd: 80 })])
      ],
      events: [],
      clients: []
    });

    expect(bundle.paymentMethodCurrencyCharts).toEqual([]);
  });
});