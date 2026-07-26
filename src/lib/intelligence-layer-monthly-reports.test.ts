import { describe, expect, it } from "vitest";
import {
  buildIntelligenceBundle,
  buildMonthlyIntelligenceSummaries,
  buildMonthlyReportCsv,
  type MonthlyIntelligenceClient,
  type MonthlyIntelligenceInvoice
} from "@/lib/intelligence-layer";
import type { MonthlyIntelligenceCurrencySummaryResult } from "@/lib/monthly-intelligence-currency-summaries";
import type { OCInvoiceRow } from "@/lib/operations-center";

const currentMonth = new Date().toISOString().slice(0, 7);
const occurredAt = `${currentMonth}-15T12:00:00.000Z`;
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function invoice(id: string, workspaceId: string | null, currency: "USD" | "LBP", overrides: Partial<MonthlyIntelligenceInvoice> = {}): MonthlyIntelligenceInvoice {
  return {
    id,
    workspace_id: workspaceId,
    status: "sent",
    document_type: "invoice",
    currency,
    amount_usd: currency === "USD" ? 100 : null,
    amount_lbp: currency === "LBP" ? 1_000_000 : null,
    due_date: yesterday,
    created_at: occurredAt,
    payment_proofs: [],
    ...overrides
  };
}

function summary(overrides: Partial<MonthlyIntelligenceCurrencySummaryResult> = {}): MonthlyIntelligenceCurrencySummaryResult {
  return { currencySummaries: [], sharedSummaries: [], ...overrides };
}

describe("active currency-safe monthly intelligence derivation", () => {
  it("keeps accepted USD and LBP collections and canonical partial overdue balances separate", () => {
    const result = buildMonthlyIntelligenceSummaries({
      workspaceId: "workspace-a",
      reportingMonths: [currentMonth],
      invoices: [
        invoice("usd-partial", "workspace-a", "USD", {
          status: "partial",
          payment_proofs: [{ status: "accepted", amount_usd: 40, amount_lbp: 0, confirmed_at: occurredAt, uploaded_at: occurredAt, method: "Cash" }]
        }),
        invoice("usd-paid", "workspace-a", "USD", {
          status: "paid",
          payment_proofs: [{ status: "accepted", amount_usd: 100, amount_lbp: 0, confirmed_at: occurredAt, uploaded_at: occurredAt, method: "Bank" }]
        }),
        invoice("lbp-partial", "workspace-a", "LBP", {
          status: "partial",
          payment_proofs: [{ status: "accepted", amount_usd: 0, amount_lbp: 400_000, confirmed_at: occurredAt, uploaded_at: occurredAt, method: "Cash" }]
        })
      ],
      clients: [{ workspace_id: "workspace-a", created_at: occurredAt }]
    });

    expect(result.currencySummaries).toEqual([
      { month: currentMonth, currency: "LBP", collected: 400_000, overdue: 600_000 },
      { month: currentMonth, currency: "USD", collected: 140, overdue: 60 }
    ]);
    expect(result.sharedSummaries).toEqual([
      { month: currentMonth, invoicesCreated: 3, newClients: 1, topMethod: "Cash", operationalIssues: 1 }
    ]);
  });

  it("excludes quotes, cancelled records, foreign workspaces, null-workspace records, and mismatched clients from the required facts", () => {
    const result = buildMonthlyIntelligenceSummaries({
      workspaceId: "workspace-a",
      reportingMonths: [currentMonth],
      invoices: [
        invoice("quote", "workspace-a", "USD", { document_type: "quote", payment_proofs: [{ status: "accepted", amount_usd: 90, confirmed_at: occurredAt, uploaded_at: occurredAt }] }),
        invoice("cancelled", "workspace-a", "USD", { status: "rejected" }),
        invoice("foreign", "workspace-b", "USD", { payment_proofs: [{ status: "accepted", amount_usd: 80, confirmed_at: occurredAt, uploaded_at: occurredAt }] }),
        invoice("legacy", null, "USD", { payment_proofs: [{ status: "accepted", amount_usd: 70, confirmed_at: occurredAt, uploaded_at: occurredAt }] })
      ],
      clients: [
        { workspace_id: "workspace-a", created_at: occurredAt },
        { workspace_id: "workspace-b", created_at: occurredAt },
        { workspace_id: null, created_at: occurredAt }
      ]
    });

    expect(result.currencySummaries).toEqual([]);
    expect(result.sharedSummaries).toEqual([
      { month: currentMonth, invoicesCreated: 1, newClients: 1, topMethod: null, operationalIssues: 0 }
    ]);
  });

  it("preserves the legacy accepted-proof collection rule while canonical balances ignore voided proofs", () => {
    const result = buildMonthlyIntelligenceSummaries({
      workspaceId: "workspace-a",
      reportingMonths: [currentMonth],
      invoices: [
        invoice("voided-accepted", "workspace-a", "USD", {
          payment_proofs: [{ status: "accepted", amount_usd: 40, confirmed_at: occurredAt, uploaded_at: occurredAt, voided_at: occurredAt, method: "Bank" }]
        }),
        invoice("pending", "workspace-a", "USD", {
          payment_proofs: [{ status: "pending", amount_usd: 80, confirmed_at: occurredAt, uploaded_at: occurredAt, method: "Cash" }]
        })
      ],
      clients: []
    });

    expect(result.currencySummaries).toEqual([
      { month: currentMonth, currency: "USD", collected: 40, overdue: 200 }
    ]);
    expect(result.sharedSummaries[0]).toMatchObject({ topMethod: "Bank", operationalIssues: 1 });
  });

  it("keeps top-method source ordering stable and zero-fills only the observed currency", () => {
    const result = buildMonthlyIntelligenceSummaries({
      workspaceId: "workspace-a",
      reportingMonths: ["2026-01", "2026-02"],
      invoices: [
        invoice("first", "workspace-a", "USD", {
          created_at: "2026-01-01T00:00:00.000Z",
          due_date: "2099-02-20",
          payment_proofs: [{ status: "accepted", amount_usd: 10, confirmed_at: "2026-01-02T00:00:00.000Z", uploaded_at: "2026-01-02T00:00:00.000Z", method: "Card" }]
        }),
        invoice("second", "workspace-a", "USD", {
          created_at: "2026-01-01T00:00:00.000Z",
          due_date: "2099-02-20",
          payment_proofs: [{ status: "accepted", amount_usd: 10, confirmed_at: "2026-01-02T00:00:00.000Z", uploaded_at: "2026-01-02T00:00:00.000Z", method: "Bank" }]
        })
      ],
      clients: []
    });

    expect(result.currencySummaries).toEqual([
      { month: "2026-01", currency: "USD", collected: 20, overdue: 0 },
      { month: "2026-02", currency: "USD", collected: 0, overdue: 0 }
    ]);
    expect(result.sharedSummaries[0]).toMatchObject({ invoicesCreated: 2, topMethod: "Card" });
    expect(result.sharedSummaries[1]).toMatchObject({ invoicesCreated: 0, topMethod: null });
  });

  it("uses the migrated result type in the active bundle without approximate monthly fields", () => {
    const bundleInvoice: OCInvoiceRow = {
      id: "bundle-usd",
      workspace_id: "workspace-a",
      title: "Invoice",
      status: "sent",
      document_type: "invoice",
      currency: "USD",
      amount_usd: 100,
      amount_lbp: null,
      due_date: yesterday,
      created_at: occurredAt,
      public_token: "test-token",
      payment_proofs: [{ id: "proof", status: "accepted", amount_usd: 40, amount_lbp: 0, confirmed_at: occurredAt, uploaded_at: occurredAt }]
    };
    const bundle = buildIntelligenceBundle({ workspaceId: "workspace-a", invoices: [bundleInvoice], events: [], clients: [] });

    expect(bundle.monthlyReports.currencySummaries).toEqual(expect.arrayContaining([
      expect.objectContaining({ month: currentMonth, currency: "USD", collected: 40, overdue: 60 })
    ]));
    expect("paidTotalUsd" in bundle.monthlyReports).toBe(false);
    expect("overdueTotalUsd" in bundle.monthlyReports).toBe(false);
  });

  it("emits deterministic explicit-currency CSV rows without a fabricated currency for empty periods", () => {
    const mixed = summary({
      currencySummaries: [
        { month: "2026-02", currency: "USD", collected: 12.5, overdue: 0 },
        { month: "2026-02", currency: "LBP", collected: 500_000, overdue: 25_000 }
      ],
      sharedSummaries: [{ month: "2026-02", invoicesCreated: 2, newClients: 1, topMethod: "تحويل, بنكي", operationalIssues: 1 }]
    });

    const csv = buildMonthlyReportCsv("2026-02", mixed);
    expect(csv).toBe([
      "month,currency,collected,overdue,invoices_created,new_clients,top_payment_method,operational_issue_flag",
      '2026-02,LBP,500000.00,25000.00,2,1,"\u062A\u062D\u0648\u064A\u0644, \u0628\u0646\u0643\u064A",1',
      '2026-02,USD,12.50,0.00,2,1,"\u062A\u062D\u0648\u064A\u0644, \u0628\u0646\u0643\u064A",1',
      ""
    ].join("\n"));
    expect(buildMonthlyReportCsv("2026-02", mixed)).toBe(csv);
    expect(buildMonthlyReportCsv("2026-03", summary())).toBe("month,currency,collected,overdue,invoices_created,new_clients,top_payment_method,operational_issue_flag\n");
    expect(csv).not.toContain("usd_equivalent");
    expect(csv).not.toContain("paid_total_usd");
  });

  it("retains the explicit workspace identifier on shared client facts", () => {
    const client: MonthlyIntelligenceClient = { workspace_id: "workspace-a", created_at: occurredAt };
    const result = buildMonthlyIntelligenceSummaries({ workspaceId: "workspace-a", invoices: [], clients: [client], reportingMonths: [currentMonth] });
    expect(result.sharedSummaries[0]).toMatchObject({ newClients: 1 });
  });
});
