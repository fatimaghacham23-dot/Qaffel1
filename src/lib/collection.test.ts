import { describe, expect, it } from "vitest";
import { collectionTotals, isOutstandingInvoice, proofDisplayStatus, remainingForInvoice } from "@/lib/collection";

const invoice = (overrides = {}) => ({ id: "i1", status: "sent" as const, document_type: "invoice", currency: "USD", amount_usd: 100, due_date: "2099-01-01", payment_proofs: [], ...overrides });

describe("collection domain", () => {
  it("excludes drafts, quotes, and rejected invoices from outstanding", () => {
    expect(isOutstandingInvoice(invoice({ status: "draft" }))).toBe(false);
    expect(isOutstandingInvoice(invoice({ document_type: "quote" }))).toBe(false);
    expect(isOutstandingInvoice(invoice({ status: "rejected" }))).toBe(false);
  });
  it("reduces balances only using accepted proofs", () => {
    expect(remainingForInvoice(invoice({ payment_proofs: [{ status: "accepted", amount_usd: 40 }, { status: "pending", amount_usd: 60 }] })).primaryBalance).toBe(60);
  });
  it("groups totals by currency", () => {
    expect(collectionTotals([invoice(), invoice({ id: "i2", currency: "LBP", amount_usd: null, amount_lbp: 500000 })]).outstanding).toEqual({ USD: 100, LBP: 500000 });
  });
  it("maps proof states to a concise user-facing set", () => {
    expect(proofDisplayStatus("pending")).toBe("awaiting_review");
    expect(proofDisplayStatus("accepted")).toBe("approved");
    expect(proofDisplayStatus("voided")).toBe("rejected");
  });
});
