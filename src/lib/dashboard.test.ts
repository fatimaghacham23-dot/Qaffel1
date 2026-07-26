import { describe, expect, it } from "vitest";
import { createOnboardingEvidenceFixture } from "@/test/onboarding-fixtures";
import { hasPermission, type WorkspaceRole } from "@/lib/permissions";
import {
  DASHBOARD_ACTIVITY_LIMIT,
  dashboardActivity,
  dashboardAttention,
  dashboardCapabilities,
  dashboardMetrics,
  dashboardOnboarding,
  dashboardQueryPlan,
  type DashboardInvoice
} from "@/lib/dashboard";

const now = new Date("2026-07-21T12:00:00.000Z");
const invoice = (overrides: Partial<DashboardInvoice> = {}): DashboardInvoice => ({
  id: "invoice-1",
  title: "Website project",
  invoice_number: "INV-001",
  status: "sent",
  document_type: "invoice",
  currency: "USD",
  amount_usd: 1000,
  amount_lbp: null,
  due_date: "2026-07-25",
  created_at: "2026-07-01T00:00:00.000Z",
  payment_proofs: [],
  clients: { name: "Acme" },
  ...overrides
});

describe("dashboard role visibility and query planning", () => {
  it("gives owner/admin a broad dashboard and reviewer a proof-focused dashboard", () => {
    expect(dashboardCapabilities("owner")).toMatchObject({ showFinancialSummary: true, canCreateInvoice: true, canRecordPayment: true });
    expect(dashboardCapabilities("admin")).toMatchObject({ showFinancialSummary: true, canRecordPayment: false });
    expect(dashboardCapabilities("finance")).toMatchObject({ showFinancialSummary: true, canCreateInvoice: false });
    expect(dashboardCapabilities("reviewer")).toMatchObject({ showFinancialSummary: false, showProofWorkload: true, canReviewProofs: true });
    expect(dashboardCapabilities("staff")).toMatchObject({ showFinancialSummary: false, canCreateInvoice: false, canRecordPayment: false });
  });

  it("never schedules a protected dataset without its repository permission", () => {
    const roles: WorkspaceRole[] = ["owner", "admin", "finance", "operations", "reviewer", "staff"];
    for (const role of roles) {
      const plan = dashboardQueryPlan(role);
      if (plan.proofs) expect(hasPermission(role, "proofs.view")).toBe(true);
      if (plan.assignments) expect(hasPermission(role, "assignments.view")).toBe(true);
      if (plan.events) expect(hasPermission(role, "invoices.view")).toBe(true);
    }
    expect(dashboardQueryPlan("reviewer").invoices).toBe(false);
    expect(dashboardQueryPlan("staff").invoices).toBe(false);
  });
});

describe("dashboard financial metrics", () => {
  it("uses accepted non-voided payments in the current month and keeps currencies separate", () => {
    const result = dashboardMetrics({
      now,
      invoices: [invoice({ payment_proofs: [{ status: "accepted", amount_usd: 250 }] }), invoice({ id: "lbp", currency: "LBP", amount_usd: null, amount_lbp: 5_000_000, payment_proofs: [] })],
      payments: [
        { id: "accepted", status: "accepted", amount_usd: 250, confirmed_at: "2026-07-10T10:00:00.000Z", invoices: { id: "invoice-1", currency: "USD" } },
        { id: "voided", status: "accepted", amount_usd: 900, voided_at: "2026-07-11T10:00:00.000Z", confirmed_at: "2026-07-10T10:00:00.000Z", invoices: { id: "invoice-1", currency: "USD" } },
        { id: "old", status: "accepted", amount_lbp: 3_000_000, confirmed_at: "2026-06-29T12:00:00.000Z", invoices: { id: "lbp", currency: "LBP" } },
        { id: "pending", status: "pending", amount_usd: 100, uploaded_at: "2026-07-10T10:00:00.000Z", invoices: { id: "invoice-1", currency: "USD" } }
      ]
    });
    expect(result.collected).toEqual({ USD: 250, LBP: 0 });
    expect(result.outstanding).toEqual({ USD: 750, LBP: 5_000_000 });
    expect(result.expectedNextSevenDays).toEqual({ USD: 750, LBP: 5_000_000 });
  });

  it("handles zero data and partial payments without inventing totals", () => {
    expect(dashboardMetrics({ now, invoices: [], payments: [] })).toEqual({
      collected: { USD: 0, LBP: 0 }, outstanding: { USD: 0, LBP: 0 }, overdue: { USD: 0, LBP: 0 }, expectedNextSevenDays: { USD: 0, LBP: 0 }
    });
    const result = dashboardMetrics({ now, invoices: [invoice({ payment_proofs: [{ status: "accepted", amount_usd: 400 }] })], payments: [] });
    expect(result.outstanding.USD).toBe(600);
    expect(result.expectedNextSevenDays.USD).toBe(600);
  });
});

describe("dashboard attention", () => {
  it("prioritizes urgent assignments, proof review, overdue invoices, then lower urgency work", () => {
    const capabilities = dashboardCapabilities("owner");
    const items = dashboardAttention({
      now,
      capabilities,
      invoices: [invoice({ due_date: "2026-07-01" }), invoice({ id: "quote", document_type: "quote", status: "sent" })],
      payments: [{ id: "proof", invoice_id: "invoice-1", status: "pending", uploaded_at: "2026-07-20T00:00:00.000Z", invoices: { id: "invoice-1", title: "Website", clients: { name: "Acme" } } }],
      assignments: [{ id: "urgent", target_type: "invoice", target_id: "invoice-1", status: "open", priority: "urgent", context: "Call client", due_at: "2026-07-20T00:00:00.000Z", created_at: "2026-07-19T00:00:00.000Z" }]
    });
    expect(items.map((item) => item.type).slice(0, 3)).toEqual(["assignment", "proof_review", "overdue_invoice"]);
    expect(items.length).toBeLessThanOrEqual(6);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });

  it("returns no section data when nothing is actionable", () => {
    expect(dashboardAttention({ now, capabilities: dashboardCapabilities("staff"), invoices: [], payments: [], assignments: [] })).toEqual([]);
  });
});

describe("dashboard onboarding and activity", () => {
  it("derives the three onboarding steps from real workspace state", () => {
    const empty = dashboardOnboarding({ role: "owner", evidence: createOnboardingEvidenceFixture({ hasClient: false, hasInvoice: false, hasSharedPaymentRequest: false }) });
    expect(empty?.map((step) => [step.id, step.complete])).toEqual([["client", false], ["invoice", false], ["share", false]]);
    expect(dashboardOnboarding({ role: "owner", evidence: createOnboardingEvidenceFixture() })).toBeNull();
    expect(dashboardOnboarding({ role: "reviewer", evidence: createOnboardingEvidenceFixture({ hasClient: false, hasInvoice: false, hasSharedPaymentRequest: false }) })).toBeNull();
  });

  it("keeps only five latest meaningful events in descending order", () => {
    const events = Array.from({ length: 7 }, (_, index) => ({ id: String(index), invoice_id: "invoice-1", event_type: "invoice_created", message: "internal", created_at: `2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z` }));
    events.push({ id: "raw", invoice_id: "invoice-1", event_type: "stripe_webhook_received", message: "internal", created_at: "2026-07-30T00:00:00.000Z" });
    const activity = dashboardActivity(events);
    expect(activity).toHaveLength(DASHBOARD_ACTIVITY_LIMIT);
    expect(activity.map((item) => item.id)).toEqual(["event:6", "event:5", "event:4", "event:3", "event:2"]);
    expect(activity.some((item) => item.id === "event:raw")).toBe(false);
  });
});
