import { describe, expect, it } from "vitest";
import { buildOperationalPresenceModel, type PresenceEventRow } from "@/lib/operational-presence";
import type { OperationalAssignmentRow } from "@/lib/assignments";

const now = new Date("2026-05-15T12:00:00.000Z");

function assignment(overrides: Partial<OperationalAssignmentRow> = {}): OperationalAssignmentRow {
  return {
    id: "assignment-1",
    workspace_id: "workspace-1",
    target_type: "proof",
    target_id: "proof-1",
    assignment_type: "reviewer",
    assigned_to_user_id: "reviewer-1",
    assigned_to_role: null,
    assigned_by: "owner-1",
    status: "in_progress",
    priority: "normal",
    due_at: null,
    context: null,
    last_action_at: "2026-05-15T11:20:00.000Z",
    completed_at: null,
    created_at: "2026-05-15T10:00:00.000Z",
    updated_at: "2026-05-15T11:20:00.000Z",
    assigned_to_name: "Rana Reviewer",
    assigned_to_initials: "RR",
    target_label: "Proof waiting: INV-001 - May retainer",
    target_href: "/invoices/inv-1#proofs-review",
    ...overrides
  };
}

describe("buildOperationalPresenceModel", () => {
  it("surfaces active operational handling without creating noisy duplicate activity", () => {
    const model = buildOperationalPresenceModel({
      userId: "reviewer-1",
      role: "reviewer",
      invoices: [{ id: "inv-1", invoice_number: "INV-001", title: "May retainer" }],
      proofs: [{ id: "proof-1", invoice_id: "inv-1" }],
      assignments: [assignment()],
      now
    });

    expect(model.activeNow.map((signal) => signal.actorName)).toContain("Rana Reviewer");
    expect(model.strip.some((item) => item.scope === "proofs")).toBe(true);
    expect(model.entitySummaries[0].primaryLine).toContain("Handling by Rana Reviewer");
  });

  it("keeps finance/export presence role-aware", () => {
    const model = buildOperationalPresenceModel({
      userId: "staff-1",
      role: "staff",
      exportRuns: [
        {
          id: "export-1",
          export_type: "monthly_close",
          title: "Monthly finance package",
          row_count: 42,
          generated_by_name: "Finance Manager",
          generated_at: "2026-05-15T10:00:00.000Z"
        }
      ],
      closeTasks: [
        {
          task_key: "void_verification",
          status: "completed",
          completed_by_name: "Finance Manager",
          completed_at: "2026-05-15T09:00:00.000Z",
          updated_at: "2026-05-15T09:00:00.000Z",
          period_month: "2026-05"
        }
      ],
      now
    });

    expect(model.recentActivity).toHaveLength(0);
    expect(model.strip).toHaveLength(0);
  });

  it("includes finance continuity for finance-capable roles", () => {
    const model = buildOperationalPresenceModel({
      userId: "finance-1",
      role: "finance",
      exportRuns: [
        {
          id: "export-1",
          export_type: "monthly_close",
          title: "Monthly finance package",
          row_count: 42,
          generated_by_name: "Finance Manager",
          generated_at: "2026-05-15T10:00:00.000Z"
        }
      ],
      closeTasks: [
        {
          task_key: "export_package",
          status: "completed",
          completed_by_name: "Finance Manager",
          completed_at: "2026-05-15T09:30:00.000Z",
          updated_at: "2026-05-15T09:30:00.000Z",
          period_month: "2026-05"
        }
      ],
      now
    });

    expect(model.recentActivity.map((signal) => signal.verb)).toContain("Export generated");
    expect(model.strip.some((item) => item.scope === "exports")).toBe(true);
    expect(model.counts.financeSignals).toBe(2);
  });

  it("drops stale presence beyond the operational lookback window", () => {
    const oldEvent: PresenceEventRow = {
      id: "event-old",
      invoice_id: "inv-1",
      event_type: "proof_accepted",
      message: "Proof accepted.",
      created_at: "2026-05-01T09:00:00.000Z",
      actor_name: "Reviewer"
    };

    const model = buildOperationalPresenceModel({
      userId: "reviewer-1",
      role: "reviewer",
      invoices: [{ id: "inv-1", invoice_number: "INV-001", title: "May retainer" }],
      events: [oldEvent],
      now
    });

    expect(model.recentActivity).toHaveLength(0);
    expect(model.entitySummaries).toHaveLength(0);
  });
});
