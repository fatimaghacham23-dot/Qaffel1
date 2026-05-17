import { describe, expect, it } from "vitest";
import {
  buildAttentionCenterModel,
  type AttentionEventRow,
  type AttentionInvoiceRow,
  type AttentionProofRow
} from "@/lib/operational-notifications";
import type { OperationalAssignmentRow } from "@/lib/assignments";

const now = new Date("2026-05-15T12:00:00.000Z");

function invoice(overrides: Partial<AttentionInvoiceRow> = {}): AttentionInvoiceRow {
  return {
    id: "inv-1",
    title: "May retainer",
    invoice_number: "INV-001",
    status: "sent",
    document_type: "invoice",
    amount_usd: 1000,
    amount_lbp: null,
    currency: "USD",
    due_date: "2026-05-10",
    valid_until: "2026-05-30",
    created_at: "2026-05-01T09:00:00.000Z",
    clients: { id: "client-1", name: "Cedar Studio", phone: "+96170000000", email: "ops@example.com" },
    payment_proofs: [],
    ...overrides
  };
}

function proof(overrides: Partial<AttentionProofRow> = {}): AttentionProofRow {
  return {
    id: "proof-1",
    invoice_id: "inv-1",
    status: "pending",
    uploaded_at: "2026-05-14T08:00:00.000Z",
    amount_usd: 1000,
    amount_lbp: null,
    invoices: invoice(),
    ...overrides
  };
}

function assignment(overrides: Partial<OperationalAssignmentRow> = {}): OperationalAssignmentRow {
  return {
    id: "assign-1",
    workspace_id: "workspace-1",
    target_type: "invoice",
    target_id: "inv-1",
    assignment_type: "operations_owner",
    assigned_to_user_id: "staff-1",
    assigned_to_role: null,
    assigned_by: "owner-1",
    status: "open",
    priority: "normal",
    due_at: null,
    context: null,
    last_action_at: "2026-05-10T09:00:00.000Z",
    completed_at: null,
    created_at: "2026-05-10T09:00:00.000Z",
    updated_at: "2026-05-10T09:00:00.000Z",
    assigned_to_name: "Staff User",
    assigned_to_initials: "SU",
    target_label: "May retainer",
    target_href: "/invoices/inv-1",
    ...overrides
  };
}

const members = [
  { userId: "staff-1", name: "Staff User", role: "staff" as const, initials: "SU" },
  { userId: "reviewer-1", name: "Reviewer User", role: "reviewer" as const, initials: "RU" }
];

describe("buildAttentionCenterModel", () => {
  it("escalates pending proof review after the deterministic 24h threshold", () => {
    const model = buildAttentionCenterModel({
      userId: "reviewer-1",
      role: "reviewer",
      invoices: [invoice({ payment_proofs: [proof()] })],
      proofs: [proof()],
      assignments: [],
      events: [],
      members,
      now
    });

    const item = model.notifications.find((notification) => notification.kind === "proof_awaiting_review");
    expect(item).toBeTruthy();
    expect(item?.id).toBe("proof:proof-1:awaiting-review");
    expect(item?.priority).toBe("high");
    expect(item?.severity).toBe("elevated");
    expect(item?.escalation?.active).toBe(true);
    expect(model.sections.waitingOnYou.map((notification) => notification.id)).toContain("proof:proof-1:awaiting-review");
  });

  it("deduplicates the same proof when it appears in invoice joins and proof queue rows", () => {
    const model = buildAttentionCenterModel({
      userId: "reviewer-1",
      role: "reviewer",
      invoices: [invoice({ payment_proofs: [proof()] })],
      proofs: [proof()],
      assignments: [],
      events: [],
      members,
      now
    });

    const ids = model.notifications.map((notification) => notification.id);
    expect(ids.filter((id) => id === "proof:proof-1:awaiting-review")).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not prompt another recovery reminder when a reminder was copied recently", () => {
    const recentReminder: AttentionEventRow = {
      invoice_id: "inv-1",
      event_type: "reminder_copied",
      message: "Reminder copied.",
      created_at: "2026-05-15T02:00:00.000Z"
    };

    const model = buildAttentionCenterModel({
      userId: "ops-1",
      role: "operations",
      invoices: [invoice()],
      assignments: [],
      events: [recentReminder],
      members,
      now
    });

    expect(model.notifications.some((notification) => notification.kind === "recovery_follow_up_needed")).toBe(false);
  });

  it("keeps staff role-aware: assigned work is visible but proof-review notifications are not", () => {
    const model = buildAttentionCenterModel({
      userId: "staff-1",
      role: "staff",
      invoices: [invoice()],
      proofs: [proof()],
      assignments: [assignment()],
      events: [],
      members,
      now
    });

    expect(model.notifications.some((notification) => notification.kind === "proof_awaiting_review")).toBe(false);
    expect(model.sections.waitingOnYou.some((notification) => notification.assignmentId === "assign-1")).toBe(true);
  });
});

