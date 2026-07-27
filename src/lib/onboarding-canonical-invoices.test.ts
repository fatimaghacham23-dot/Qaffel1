import { describe, expect, it } from "vitest";
import { filterCanonicalActiveWorkspaceInvoices, type WorkspaceInvoiceFact } from "@/lib/canonical-invoices";
import { deriveOnboardingEvidence } from "@/lib/onboarding-evidence";
import { deriveDashboardOnboardingState } from "@/lib/dashboard";
import { buildDerivedNotifications } from "@/lib/notifications";

const workspaceId = "workspace-a";
function invoice(overrides: Partial<WorkspaceInvoiceFact> = {}): WorkspaceInvoiceFact {
  return {
    id: "invoice-default",
    workspace_id: workspaceId,
    client_id: "client-a",
    clients: { workspace_id: workspaceId },
    status: "unpaid",
    document_type: "invoice",
    currency: "USD",
    amount_usd: 100,
    ...overrides
  };
}
function evidenceFor(invoices: WorkspaceInvoiceFact[]) {
  return deriveOnboardingEvidence({
    clientCount: 1,
    realInvoiceCount: filterCanonicalActiveWorkspaceInvoices(invoices, workspaceId).length,
    businessName: "Qaffel",
    phone: "03123456",
    activePaymentMethodCount: 1,
    validPaymentTokenCount: 0,
    shareEventCount: 0,
    additionalMemberCount: 0,
    pendingInvitationCount: 0
  });
}

describe("canonical onboarding invoice evidence", () => {
  it("recognises two canonical invoices and keeps dashboard and notifications aligned", () => {
    const evidence = evidenceFor([invoice({ id: "one" }), invoice({ id: "two" })]);
    const dashboard = deriveDashboardOnboardingState({ onboardingEvidence: evidence, role: "owner" });
    const notifications = buildDerivedNotifications({ onboardingEvidence: evidence, pendingProofCount: 0, rejectedProofCount: 0, pendingInvitationCount: 0, assignmentCount: 0, invoices: [], now: new Date("2026-07-27T00:00:00Z") });

    expect(evidence.hasInvoice).toBe(true);
    expect(dashboard.primaryAction.id).not.toBe("setup:first-invoice");
    expect(notifications.some((item) => item.id === "onboarding:first-invoice")).toBe(false);
  });

  it("does not treat quotes, foreign, null-workspace, or client-mismatched rows as invoice evidence", () => {
    expect(evidenceFor([invoice({ document_type: "quote" })]).hasInvoice).toBe(false);
    expect(evidenceFor([invoice({ workspace_id: "workspace-b" })]).hasInvoice).toBe(false);
    expect(evidenceFor([invoice({ workspace_id: null })]).hasInvoice).toBe(false);
    expect(evidenceFor([invoice({ clients: { workspace_id: "workspace-b" } })]).hasInvoice).toBe(false);
  });

  it("shows first-invoice guidance only when no canonical invoice exists", () => {
    const evidence = evidenceFor([]);
    const notifications = buildDerivedNotifications({ onboardingEvidence: evidence, pendingProofCount: 0, rejectedProofCount: 0, pendingInvitationCount: 0, assignmentCount: 0, invoices: [], now: new Date("2026-07-27T00:00:00Z") });

    expect(evidence.hasInvoice).toBe(false);
    expect(notifications.some((item) => item.id === "onboarding:first-invoice")).toBe(true);
  });
});
