import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildIntelligenceBundle } from "@/lib/intelligence-layer";
import type { OCInvoiceProof, OCInvoiceRow } from "@/lib/operations-center";

const now = new Date();
const overdueDate = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
const createdAt = new Date(now.getTime() - 12 * 86_400_000).toISOString();

function proof(id: string, amountUsd: number): OCInvoiceProof {
  return { id, status: "accepted", amount_usd: amountUsd, amount_lbp: null, uploaded_at: createdAt, confirmed_at: createdAt };
}

function invoice(id: string, overrides: Partial<OCInvoiceRow> = {}): OCInvoiceRow {
  return {
    id,
    workspace_id: "workspace-a",
    title: "Invoice",
    invoice_number: id,
    client_id: "client-usd",
    status: "partial",
    document_type: "invoice",
    currency: "USD",
    amount_usd: 9_000,
    amount_lbp: null,
    due_date: overdueDate,
    created_at: createdAt,
    public_token: `token-${id}`,
    clients: { id: "client-usd", name: "Client", phone: null, email: null },
    payment_proofs: [proof(`proof-${id}`, 1_000)],
    ...overrides
  };
}

describe("currency-safe operational intelligence", () => {
  it("uses remaining native USD balances for configured high-value rules and never converts LBP", () => {
    const bundle = buildIntelligenceBundle({
      workspaceId: "workspace-a",
      invoices: [
        invoice("usd-partial"),
        invoice("lbp-open", {
          client_id: "client-lbp",
          currency: "LBP",
          amount_usd: null,
          amount_lbp: 900_000_000,
          payment_proofs: [],
          clients: { id: "client-lbp", name: "LBP Client", phone: null, email: null }
        }),
        invoice("paid", { status: "paid", amount_usd: 9_000, payment_proofs: [proof("paid-proof", 9_000)] }),
        invoice("quote", { document_type: "quote", amount_usd: 12_000, payment_proofs: [] }),
        invoice("cancelled", { status: "rejected", amount_usd: 12_000, payment_proofs: [] }),
        invoice("foreign", { workspace_id: "workspace-b", amount_usd: 12_000, payment_proofs: [] }),
        invoice("legacy", { workspace_id: null, amount_usd: 12_000, payment_proofs: [] })
      ],
      events: [],
      clients: []
    });

    expect(bundle.operational.highValueInvoices.map((item) => item.id)).toEqual(["usd-partial"]);
    expect(bundle.operational.highValueInvoices[0]?.meta).toContain("8,000");
    expect(bundle.operational.riskyClients.map((item) => item.id)).toContain("client-usd");
    expect(bundle.operational.riskyClients.map((item) => item.id)).not.toContain("client-lbp");
    expect(bundle.clientSegmentation.find((item) => item.clientId === "client-usd")?.segments).toContain("high_value");
    expect(bundle.clientSegmentation.find((item) => item.clientId === "client-lbp")?.segments || []).not.toContain("high_value");
  });

  it("contains no active approximate conversion helper or mixed-currency high-value field", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/intelligence-layer.ts"), "utf8");

    expect(source).not.toContain("toApproxUsd");
    expect(source).not.toContain("openUsd");
    expect(source).not.toContain("approxBilled");
    expect(source).not.toContain("exchange_rate_lbp_per_usd");
  });
});
