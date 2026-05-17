import { describe, expect, it } from "vitest";
import { buildFinanceClosingModel, type FinanceInvoiceRow } from "@/lib/finance-closing";

function invoice(overrides: Partial<FinanceInvoiceRow> = {}): FinanceInvoiceRow {
  return {
    id: "inv-1",
    invoice_number: "INV-001",
    title: "May retainer",
    status: "sent",
    document_type: "invoice",
    amount_usd: 1000,
    amount_lbp: 0,
    currency: "USD",
    due_date: "2026-05-10",
    created_at: "2026-05-01T09:00:00.000Z",
    clients: { id: "client-1", name: "Cedar Studio" },
    payment_proofs: [],
    ...overrides
  };
}

describe("buildFinanceClosingModel", () => {
  it("calculates collected, remaining, partial, and unresolved balances from accepted proofs only", () => {
    const model = buildFinanceClosingModel({
      periodMonth: "2026-05",
      invoices: [
        invoice({
          status: "partial",
          payment_proofs: [
            {
              id: "proof-accepted",
              status: "accepted",
              amount_usd: 400,
              uploaded_at: "2026-05-05T10:00:00.000Z",
              confirmed_at: "2026-05-05T12:00:00.000Z",
              reviewer_name: "Finance Reviewer"
            },
            {
              id: "proof-pending",
              status: "pending",
              amount_usd: 200,
              uploaded_at: "2026-05-06T10:00:00.000Z"
            }
          ]
        })
      ],
      events: [],
      now: new Date("2026-05-15T12:00:00.000Z")
    });

    expect(model.summary.collectedUsd).toBe(400);
    expect(model.summary.unpaidUsd).toBe(600);
    expect(model.summary.partialCount).toBe(1);
    expect(model.summary.pendingProofUsd).toBe(200);
    expect(model.reconciliation.acceptedProofs).toHaveLength(1);
    expect(model.reconciliation.partialPayments).toHaveLength(1);
    expect(model.reconciliation.unresolvedBalances[0].formula).toBe("remaining = invoice total - accepted proof totals");
  });

  it("keeps voided proofs out of collected totals while surfacing void review rows", () => {
    const model = buildFinanceClosingModel({
      periodMonth: "2026-05",
      invoices: [
        invoice({
          payment_proofs: [
            {
              id: "proof-voided",
              status: "voided",
              amount_usd: 500,
              uploaded_at: "2026-05-04T10:00:00.000Z",
              voided_at: "2026-05-07T10:00:00.000Z",
              void_reason: "Duplicate payment record"
            }
          ]
        })
      ],
      events: [],
      now: new Date("2026-05-15T12:00:00.000Z")
    });

    expect(model.summary.collectedUsd).toBe(0);
    expect(model.summary.voidedUsd).toBe(500);
    expect(model.reconciliation.voidedReceipts).toHaveLength(1);
    expect(model.reconciliation.voidedReceipts[0].formula).toBe("voided proofs do not count toward collected totals");
  });

  it("creates accountant exports without internal invoice or proof IDs", () => {
    const model = buildFinanceClosingModel({
      periodMonth: "2026-05",
      invoices: [
        invoice({
          id: "internal-invoice-id",
          payment_proofs: [
            {
              id: "internal-proof-id",
              status: "accepted",
              amount_usd: 1000,
              uploaded_at: "2026-05-04T10:00:00.000Z",
              confirmed_at: "2026-05-04T11:00:00.000Z"
            }
          ]
        })
      ],
      events: [],
      now: new Date("2026-05-15T12:00:00.000Z")
    });

    const exportedText = JSON.stringify(model.exports.flatMap((dataset) => dataset.rows));
    expect(exportedText).not.toContain("internal-invoice-id");
    expect(exportedText).not.toContain("internal-proof-id");
    expect(exportedText).toContain("INV-001");
  });
});

