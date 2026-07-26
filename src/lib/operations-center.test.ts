import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { todayIso } from "@/lib/format";
import { buildOperationsCenterModel, type OCInvoiceRow } from "@/lib/operations-center";

function previousDay(): string {
  const date = new Date(`${todayIso()}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function invoice(overrides: Partial<OCInvoiceRow> = {}): OCInvoiceRow {
  return {
    workspace_id: "workspace-a",
    id: "invoice-usd-partial",
    title: "Invoice",
    client_id: "client-usd",
    status: "partial",
    document_type: "invoice",
    amount_usd: 600,
    amount_lbp: 0,
    currency: "USD",
    due_date: todayIso(),
    created_at: `${todayIso()}T09:00:00.000Z`,
    public_token: "test-token",
    clients: { id: "client-usd", name: "USD client", phone: null, email: null },
    payment_proofs: [{ id: "proof-usd", status: "accepted", amount_usd: 200, amount_lbp: 0, uploaded_at: `${todayIso()}T10:00:00.000Z`, confirmed_at: `${todayIso()}T10:30:00.000Z` }],
    ...overrides
  };
}

describe("active Operations Center currency integration", () => {
  it("builds factual, separate currency summaries from authorized workspace invoices only", () => {
    const model = buildOperationsCenterModel({
      workspaceId: "workspace-a",
      invoices: [
        invoice(),
        invoice({
          id: "invoice-usd-open",
          client_id: "client-usd",
          amount_usd: 5_000,
          clients: { id: "client-usd", name: "USD client", phone: null, email: null },
          payment_proofs: []
        }),
        invoice({
          id: "invoice-lbp-overdue",
          client_id: "client-lbp",
          status: "overdue",
          amount_usd: 0,
          amount_lbp: 1_000_000,
          currency: "LBP",
          due_date: previousDay(),
          clients: { id: "client-lbp", name: "LBP client", phone: null, email: null },
          payment_proofs: []
        }),
        invoice({
          workspace_id: "workspace-b",
          id: "foreign-invoice",
          client_id: "foreign-client",
          amount_usd: 999_999,
          clients: { id: "foreign-client", name: "Foreign client", phone: null, email: null },
          payment_proofs: []
        })
      ],
      pendingProofQueue: [{ id: "foreign-proof", invoice_id: "foreign-invoice", uploaded_at: "2020-01-01T00:00:00.000Z" }],
      events: [{ id: "foreign-event", invoice_id: "foreign-invoice", event_type: "proof_uploaded", message: "Foreign", created_at: "2020-01-01T00:00:00.000Z" }],
      paymentMethods: [],
      profile: null,
      userEmail: null
    });

    expect(model.currencySummary.currencySummaries).toEqual([
      expect.objectContaining({ currency: "LBP", billed: 1_000_000, openBalance: 1_000_000, overdueRecoverable: 1_000_000, expectedIncomingWeek: 0, balanceRatio: 1, balancePoints: 0 }),
      expect.objectContaining({ currency: "USD", billed: 5_600, openBalance: 5_400, expectedIncomingWeek: 5_400, overdueRecoverable: 0, balanceRatio: 5_400 / 5_600, balancePoints: 1 })
    ]);
    expect(model.currencySummary.clientCurrencySummaries).toEqual([
      { clientId: "client-lbp", currency: "LBP", openAmount: 1_000_000, highOpenBalance: null },
      { clientId: "client-usd", currency: "USD", openAmount: 5_400, highOpenBalance: true }
    ]);
    expect(model.clientRisks.find((risk) => risk.clientId === "client-usd")?.tags).toContain("High open balance (USD)");
    expect(model.clientRisks.find((risk) => risk.clientId === "client-lbp")?.tags).toContain("Threshold not configured for LBP");
    expect(model.currencySummary.shared).toEqual(expect.objectContaining({ acceptedLast7: 1, acceptedPrevious7: 0, velocityLabel: "Payment velocity", velocityDetail: null }));
    expect("currency" in model.currencySummary.shared).toBe(false);
    expect(model.alerts.some((alert) => alert.id === "proof-wait-foreign-proof")).toBe(false);
    expect(model.timeline.some((item) => item.id === "foreign-event")).toBe(false);
    expect("cashFlow" in model).toBe(false);
  });

  it("keeps the active presentation currency-specific, stacked, and free of the retired combined USD snapshot", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/OperationsCenterView.tsx"), "utf8");

    expect(source).toContain("currencySummary.currencySummaries.map");
    expect(source).toContain("aria-labelledby={\`ops-money-\${summary.currency}\`}");
    expect(source).toContain("break-all");
    expect(source).toContain("space-y-4");
    expect(source).toContain("Balance health");
    expect(source).toContain("currencySummary.shared.velocityLabel");
    expect(source).not.toContain("cashFlow");
    expect(source).not.toContain("Financial snapshot Â· cash (USD)");
    expect(source).not.toContain("Financial snapshot · cash (USD)");
  });
});
