import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildReminderAssistance, buildWorkflowAssistantModel, proofDuplicateKey } from "@/lib/workflow-assistant";
import type { OCEventRow, OCInvoiceRow } from "@/lib/operations-center";

const baseInvoice: OCInvoiceRow = {
  id: "inv-1",
  title: "Website sprint",
  invoice_number: "INV-1",
  status: "sent",
  amount_usd: 1200,
  amount_lbp: null,
  currency: "USD",
  due_date: "2026-05-01",
  valid_until: "2026-05-20",
  created_at: "2026-04-20T09:00:00.000Z",
  public_token: "tok",
  clients: { id: "client-1", name: "Maya", phone: "03123456", email: "m@example.com" },
  client_id: "client-1",
  payment_proofs: []
};

function event(row: Partial<OCEventRow>): OCEventRow {
  return {
    id: row.id || `${row.event_type || "event"}-1`,
    invoice_id: row.invoice_id || "inv-1",
    event_type: row.event_type || "reminder_copied",
    message: row.message || "Event",
    created_at: row.created_at || "2026-05-10T09:00:00.000Z",
    metadata: row.metadata || null
  };
}

describe("workflow assistant", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prioritizes manual proof review before reminder recommendations", () => {
    vi.setSystemTime(new Date("2026-05-14T12:00:00.000Z"));
    const model = buildWorkflowAssistantModel({
      invoices: [
        {
          ...baseInvoice,
          payment_proofs: [
            {
              id: "proof-1",
              status: "pending",
              amount_usd: 1200,
              amount_lbp: null,
              uploaded_at: "2026-05-12T08:00:00.000Z"
            }
          ]
        }
      ],
      events: []
    });

    expect(model.actions[0]?.kind).toBe("review_pending_proof");
    expect(model.actions.some((action) => action.kind === "send_recovery_reminder")).toBe(false);
  });

  it("uses recent reminder events to avoid duplicate pressure", () => {
    vi.setSystemTime(new Date("2026-05-14T12:00:00.000Z"));
    const model = buildWorkflowAssistantModel({
      invoices: [baseInvoice],
      events: [event({ event_type: "reminder_copied", created_at: "2026-05-13T10:00:00.000Z" })]
    });

    expect(model.actions.some((action) => action.kind === "wait_recent_reminder")).toBe(true);
    expect(model.actions.some((action) => action.kind === "send_recovery_reminder")).toBe(false);
  });

  it("explains reminder assistance from real state", () => {
    vi.setSystemTime(new Date("2026-05-14T12:00:00.000Z"));
    const items = buildReminderAssistance({
      invoice: {
        ...baseInvoice,
        status: "partial",
        payment_proofs: [{ id: "paid-1", status: "accepted", amount_usd: 300, amount_lbp: null, uploaded_at: "2026-05-13T09:00:00.000Z" }]
      },
      proofs: [{ status: "accepted", amount_usd: 300, amount_lbp: null }],
      events: []
    });

    expect(items.map((item) => item.id)).toContain("partial-detected");
  });

  it("keeps overdue concentration and amount priority in their native currencies", () => {
    vi.setSystemTime(new Date("2026-05-14T12:00:00.000Z"));
    const model = buildWorkflowAssistantModel({
      invoices: [
        { ...baseInvoice, id: "usd-concentrated", public_token: "secret-usd", client_id: "client-usd", currency: "USD", amount_usd: 1_500, amount_lbp: null, due_date: "2026-05-01" },
        { ...baseInvoice, id: "usd-other", public_token: "secret-usd-other", client_id: "client-other", currency: "USD", amount_usd: 500, amount_lbp: null, due_date: "2026-05-01" },
        { ...baseInvoice, id: "lbp-concentrated", public_token: "secret-lbp", client_id: "client-lbp", currency: "LBP", amount_usd: null, amount_lbp: 9_000_000, due_date: "2026-05-01" },
        { ...baseInvoice, id: "unsupported", public_token: "secret-unsupported", client_id: "client-unsupported", currency: "EUR", amount_usd: 500, amount_lbp: null, due_date: "2026-05-01" }
      ],
      events: []
    });

    const usdConcentration = model.workload.find((item) => item.id === "large-overdue-concentration-usd");
    const lbpConcentration = model.workload.find((item) => item.id === "overdue-concentration-lbp-not-configured");
    const usdAction = model.actions.find((item) => item.invoiceId === "usd-concentrated" && item.kind === "send_recovery_reminder");
    const lbpAction = model.actions.find((item) => item.invoiceId === "lbp-concentrated" && item.kind === "send_recovery_reminder");
    const unsupportedAction = model.actions.find((item) => item.invoiceId === "unsupported" && item.kind === "send_recovery_reminder");

    expect(usdConcentration?.detail).toContain("overdue USD balance");
    expect(lbpConcentration?.detail).toContain("No native LBP amount threshold is configured.");
    expect(model.workload.some((item) => item.detail.includes("USD-equivalent"))).toBe(false);
    expect(usdAction?.internalSort).toBeGreaterThan(lbpAction?.internalSort || 0);
    expect(lbpAction?.tier).not.toBe("cleanup");
    expect(unsupportedAction?.amountLabel).toBe("Amount unavailable (EUR is not configured)");
    expect(unsupportedAction?.tier).not.toBe("cleanup");
    expect(JSON.stringify(model)).not.toContain("secret-usd");
    expect(JSON.stringify(model)).not.toContain("secret-lbp");
    expect(JSON.stringify(model)).not.toContain("secret-unsupported");
  });
  it("builds duplicate keys only for active proofs with amount, date, and method", () => {
    expect(
      proofDuplicateKey({
        status: "pending",
        method: "Whish",
        payment_date: "2026-05-10",
        amount_usd: 50,
        amount_lbp: null
      })
    ).toBe("whish|2026-05-10|usd:50");
    expect(proofDuplicateKey({ status: "rejected", method: "Whish", payment_date: "2026-05-10", amount_usd: 50 })).toBeNull();
  });
});
