import { describe, expect, it } from "vitest";
import { dashboardMetrics, type DashboardInvoice, type DashboardPayment } from "@/lib/dashboard";
import { buildDerivedNotifications } from "@/lib/notifications";
import { buildWorkspaceMonthlyReports, type WorkspaceReportInvoice } from "@/lib/workspace-monthly-report";

type ScopedInvoice = DashboardInvoice & { workspace_id: string | null };
const now = new Date("2026-07-21T12:00:00.000Z");
const proof = (status: string, amount_usd: number | null, amount_lbp: number | null, overrides: Record<string, unknown> = {}) => ({ status, amount_usd, amount_lbp, ...overrides });
const invoice = (id: string, workspace_id: string | null, overrides: Partial<ScopedInvoice> = {}): ScopedInvoice => ({
  id, workspace_id, title: id, status: "sent", document_type: "invoice", currency: "USD", amount_usd: 100, amount_lbp: null,
  due_date: "2026-07-25", created_at: "2026-07-02T12:00:00.000Z", payment_proofs: [], ...overrides
});

const allInvoices: ScopedInvoice[] = [
  invoice("unpaid-usd", "workspace-a"),
  invoice("partial-usd", "workspace-a", { status: "partial", payment_proofs: [proof("accepted", 40, null, { confirmed_at: "2026-07-05T12:00:00.000Z" })] }),
  invoice("overdue-usd", "workspace-a", { due_date: "2026-07-10" }),
  invoice("due-lbp", "workspace-a", { currency: "LBP", amount_usd: null, amount_lbp: 5_000_000, due_date: "2026-07-26" }),
  invoice("paid", "workspace-a", { status: "paid", payment_proofs: [proof("accepted", 100, null, { confirmed_at: "2026-07-03T12:00:00.000Z" })] }),
  invoice("voided", "workspace-a", { status: "rejected", due_date: "2026-07-10" }),
  invoice("cancelled", "workspace-a", { status: "rejected" }),
  invoice("quote", "workspace-a", { document_type: "quote" }),
  invoice("null-workspace", null, { amount_usd: 900 }),
  invoice("workspace-b", "workspace-b", { amount_usd: 700, due_date: "2026-07-10" })
];
const workspaceA = allInvoices.filter((record) => record.workspace_id === "workspace-a");
const payments: DashboardPayment[] = [
  { id: "payment-a", status: "accepted", amount_usd: 40, confirmed_at: "2026-07-05T12:00:00.000Z", invoices: { id: "partial-usd", currency: "USD", workspace_id: "workspace-a" } },
  { id: "paid-payment", status: "accepted", amount_usd: 100, confirmed_at: "2026-07-03T12:00:00.000Z", invoices: { id: "paid", currency: "USD", workspace_id: "workspace-a" } },
  { id: "voided-payment", status: "accepted", amount_usd: 900, voided_at: "2026-07-06T12:00:00.000Z", confirmed_at: "2026-07-06T12:00:00.000Z", invoices: { id: "unpaid-usd", currency: "USD", workspace_id: "workspace-a" } },
  { id: "payment-b", status: "accepted", amount_usd: 700, confirmed_at: "2026-07-05T12:00:00.000Z", invoices: { id: "workspace-b", currency: "USD", workspace_id: "workspace-b" } }
];

const notificationInput = () => ({
  profile: { business_name: "Qaffel", phone: "+961", support_email: "support@example.com", logo_storage_path: "logo" },
  activePaymentMethodCount: 1, clientCount: 1, invoiceCount: 1, sharedInvoiceCount: 1,
  pendingProofCount: 0, rejectedProofCount: 0, pendingInvitationCount: 0, assignmentCount: 0, invoices: workspaceA, now
});

describe("workspace financial consistency fixture", () => {
  it("keeps Workspace B and null-workspace records out of all derived workspace surfaces", () => {
    const dashboard = dashboardMetrics({ invoices: workspaceA, payments: payments.filter((payment) => payment.invoices?.workspace_id === "workspace-a"), now });
    expect(dashboard).toMatchObject({
      collected: { USD: 140, LBP: 0 },
      outstanding: { USD: 260, LBP: 5_000_000 },
      overdue: { USD: 100, LBP: 0 },
      expectedNextSevenDays: { USD: 160, LBP: 5_000_000 }
    });

    const reports = buildWorkspaceMonthlyReports({ invoices: workspaceA as WorkspaceReportInvoice[], today: "2026-07-21" });
    const usd = reports.find((row) => row.monthKey === "2026-07" && row.currency === "USD");
    const lbp = reports.find((row) => row.monthKey === "2026-07" && row.currency === "LBP");
    expect(usd).toMatchObject({ collected: 140, overdue: 100 });
    expect(lbp).toMatchObject({ collected: 0, overdue: 0 });

    const notifications = buildDerivedNotifications(notificationInput());
    expect(notifications.map((item) => item.id)).toEqual(expect.arrayContaining(["collections:overdue", "collections:due-soon", "collections:partial-balances"]));
    expect(notifications.filter((item) => item.id === "collections:overdue")).toHaveLength(1);
  });

  it("excludes quotes, cancelled/voided records, paid records, and voided payments consistently", () => {
    const dashboard = dashboardMetrics({ invoices: workspaceA, payments: payments.filter((payment) => payment.invoices?.workspace_id === "workspace-a"), now });
    expect(dashboard.outstanding.USD).not.toBeGreaterThan(260);
    expect(dashboard.collected.USD).toBe(140);
    const notifications = buildDerivedNotifications(notificationInput());
    expect(notifications.find((item) => item.id === "collections:due-soon")?.description).toContain("3 outstanding invoices");
  });
});