import { describe, expect, it } from "vitest";
import { deriveClientTotals } from "@/lib/client-totals";
import { filterCanonicalWorkspaceInvoices } from "@/lib/canonical-invoices";
import { dashboardMetrics, type DashboardInvoice } from "@/lib/dashboard";
import { buildWorkspaceMonthlyReports } from "@/lib/workspace-monthly-report";

const workspaceId = "workspace-a";
const clientId = "client-a";

type DashboardWorkspaceInvoice = DashboardInvoice & { workspace_id: string | null; client_id: string | null; clients: { workspace_id: string | null } };

function invoice(overrides: Partial<DashboardWorkspaceInvoice> = {}): DashboardWorkspaceInvoice {
  return {
    id: "invoice-default",
    workspace_id: workspaceId,
    client_id: clientId,
    clients: { workspace_id: workspaceId },
    status: "unpaid",
    document_type: "invoice",
    currency: "USD",
    amount_usd: 100,
    amount_lbp: 0,
    due_date: "2026-07-01",
    created_at: "2026-07-01T00:00:00Z",
    payment_proofs: [],
    ...overrides
  };
}

describe("canonical client invoice totals", () => {
  it("counts and balances only the two canonical workspace invoices for a client", () => {
    const invoices = [
      invoice({ id: "usd-open", amount_usd: 100 }),
      invoice({ id: "lbp-partial", currency: "LBP", amount_usd: 0, amount_lbp: 5000000, status: "partial", payment_proofs: [{ status: "accepted", amount_lbp: 2000000 }] }),
      invoice({ id: "foreign", workspace_id: "workspace-b", amount_usd: 999 }),
      invoice({ id: "null-workspace", workspace_id: null, amount_usd: 888 }),
      invoice({ id: "mismatch", clients: { workspace_id: "workspace-b" }, amount_usd: 777 })
    ];

    const totals = deriveClientTotals({ workspaceId, clientId, invoices });

    expect(totals.invoiceCount).toBe(2);
    expect(totals.invoiceSummary).toEqual({ paid: 0, partial: 1, unpaid: 1 });
    expect(totals.balances).toEqual([
      { currency: "USD", billed: 100, paid: 0, balance: 100, overpaid: 0 },
      { currency: "LBP", billed: 5000000, paid: 2000000, balance: 3000000, overpaid: 0 }
    ]);
  });

  it("keeps paid invoices counted, excludes quotes and cancelled invoices, and ignores voided payment reductions", () => {
    const totals = deriveClientTotals({
      workspaceId,
      clientId,
      invoices: [
        invoice({ id: "paid", status: "paid", amount_usd: 40, payment_proofs: [{ status: "accepted", amount_usd: 40 }] }),
        invoice({ id: "quote", document_type: "quote", amount_usd: 900 }),
        invoice({ id: "cancelled", status: "rejected", amount_usd: 800 }),
        invoice({ id: "voided-proof", amount_usd: 60, payment_proofs: [{ status: "accepted", amount_usd: 60, voided_at: "2026-07-02T00:00:00Z" }] })
      ]
    });

    expect(totals.invoiceCount).toBe(2);
    expect(totals.invoiceSummary).toEqual({ paid: 1, partial: 0, unpaid: 1 });
    expect(totals.balances).toEqual([{ currency: "USD", billed: 100, paid: 40, balance: 60, overpaid: 0 }]);
  });

  it("keeps dashboard and reports on the same canonical invoice facts", () => {
    const invoices = [
      invoice({ id: "usd-open", amount_usd: 100 }),
      invoice({ id: "lbp-open", currency: "LBP", amount_usd: 0, amount_lbp: 5000000 }),
      invoice({ id: "mismatch", clients: { workspace_id: "workspace-b" }, amount_usd: 700 })
    ];
    const canonical = filterCanonicalWorkspaceInvoices(invoices, workspaceId);
    const metrics = dashboardMetrics({ invoices: canonical, payments: [], now: new Date("2026-07-27T10:00:00Z") });
    const reportRows = buildWorkspaceMonthlyReports({ invoices: canonical, today: "2026-07-27" });

    expect(metrics.outstanding).toEqual({ USD: 100, LBP: 5000000 });
    expect(metrics.overdue).toEqual({ USD: 100, LBP: 5000000 });
    expect(reportRows.map((row) => [row.currency, row.invoicesCreated, row.overdue])).toEqual([
      ["LBP", 1, 5000000],
      ["USD", 1, 100]
    ]);
  });
});
