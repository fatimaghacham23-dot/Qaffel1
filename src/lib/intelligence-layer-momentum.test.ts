import { describe, expect, it } from "vitest";
import { buildIntelligenceBundle } from "@/lib/intelligence-layer";
import type { OCInvoiceProof, OCInvoiceRow } from "@/lib/operations-center";

const DAY = 86_400_000;
const now = Date.now();
const isoAgo = (days: number) => new Date(now - days * DAY).toISOString();
const isoAhead = (days: number) => new Date(now + days * DAY).toISOString().slice(0, 10);
const yesterday = new Date(now - DAY).toISOString().slice(0, 10);

function proof(id: string, overrides: Partial<OCInvoiceProof> = {}): OCInvoiceProof {
  return {
    id,
    status: "accepted",
    amount_usd: 0,
    amount_lbp: 0,
    uploaded_at: isoAgo(10),
    confirmed_at: isoAgo(10),
    ...overrides
  };
}

function invoice(
  id: string,
  currency: "USD" | "LBP",
  proofs: OCInvoiceProof[],
  overrides: Partial<OCInvoiceRow> = {}
): OCInvoiceRow {
  return {
    id,
    workspace_id: "workspace-a",
    title: "Invoice",
    client_id: "client-a",
    status: "sent",
    document_type: "invoice",
    currency,
    amount_usd: currency === "USD" ? 100 : null,
    amount_lbp: currency === "LBP" ? 1_000_000 : null,
    due_date: isoAhead(7),
    created_at: isoAgo(10),
    public_token: `token-${id}`,
    payment_proofs: proofs,
    ...overrides
  };
}

describe("active currency-safe momentum derivation", () => {
  it("derives current and prior collections per currency while excluding foreign and quote records", () => {
    const bundle = buildIntelligenceBundle({
      workspaceId: "workspace-a",
      invoices: [
        invoice("usd-current", "USD", [proof("usd-proof", { amount_usd: 40, voided_at: isoAgo(5) })], { due_date: yesterday }),
        invoice("usd-repeat", "USD", [proof("usd-repeat-proof", { amount_usd: 100, confirmed_at: isoAgo(70), uploaded_at: isoAgo(70) })], { status: "paid" }),
        invoice("lbp-prior", "LBP", [proof("lbp-proof", { amount_lbp: 250_000, confirmed_at: isoAgo(40), uploaded_at: isoAgo(40) })], { client_id: "client-b", created_at: isoAgo(45) }),
        invoice("quote", "USD", [proof("quote-proof", { amount_usd: 900 })], { document_type: "quote" }),
        invoice("cancelled", "USD", [], { status: "rejected", amount_usd: 500 }),
        invoice("foreign", "USD", [proof("foreign-proof", { amount_usd: 600 })], { workspace_id: "workspace-b" })
      ],
      events: [],
      clients: []
    });

    expect(bundle.momentum.currencyIndicators.map((indicator) => indicator.currency)).toEqual(["LBP", "USD"]);
    expect(bundle.momentum.currencyIndicators).toEqual(expect.arrayContaining([
      expect.objectContaining({
        currency: "USD",
        outstandingGrowth: 100,
        velocity: expect.objectContaining({ currentAmount: 40, previousAmount: 0, direction: "unavailable" })
      }),
      expect.objectContaining({
        currency: "LBP",
        outstandingGrowth: 0,
        velocity: expect.objectContaining({ currentAmount: 0, previousAmount: 250_000, direction: "unavailable" })
      })
    ]));
  });

  it("uses canonical outstanding facts for voided payments, partial balances, paid records, quotes, and cancelled records", () => {
    const bundle = buildIntelligenceBundle({
      workspaceId: "workspace-a",
      invoices: [
        invoice("voided-proof", "USD", [proof("voided-proof", { amount_usd: 40, voided_at: isoAgo(5) })], { due_date: yesterday }),
        invoice("paid", "USD", [proof("paid-proof", { amount_usd: 100 })], { status: "paid", amount_usd: 100 }),
        invoice("partial", "USD", [proof("partial-proof", { amount_usd: 40 })], { status: "partial", amount_usd: 100 }),
        invoice("quote", "USD", [], { document_type: "quote", amount_usd: 900 }),
        invoice("cancelled", "USD", [], { status: "rejected", amount_usd: 500 })
      ],
      events: [],
      clients: []
    });

    expect(bundle.momentum.currencyIndicators).toEqual([
      expect.objectContaining({ currency: "USD", outstandingGrowth: 160 })
    ]);
    expect(bundle.momentum.shared.overdueCountNow).toBe(1);
    expect(bundle.momentum.shared.repeatClientRate).toBe(1);
  });
});