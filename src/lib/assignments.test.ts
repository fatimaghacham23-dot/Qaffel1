import { describe, expect, it } from "vitest";
import {
  assignmentAgeDays,
  formatAssignee,
  initialsForName,
  isOpenAssignment,
  isOverdueAssignment,
  sortAssignments,
  type OperationalAssignmentRow
} from "@/lib/assignments";

const base: OperationalAssignmentRow = {
  id: "a",
  workspace_id: "w",
  target_type: "invoice",
  target_id: "i",
  assignment_type: "operations_owner",
  assigned_to_user_id: null,
  assigned_to_role: "operations",
  status: "open",
  priority: "normal",
  last_action_at: "2026-05-10T00:00:00.000Z",
  created_at: "2026-05-10T00:00:00.000Z",
  updated_at: "2026-05-10T00:00:00.000Z"
};

describe("assignments", () => {
  it("formats person and role ownership labels", () => {
    expect(formatAssignee({ assigned_to_name: "Ahmad Saleh", assigned_to_role: null })).toBe("Ahmad Saleh");
    expect(formatAssignee({ assigned_to_name: null, assigned_to_role: "finance" })).toBe("Finance");
  });

  it("builds stable initials", () => {
    expect(initialsForName("Ahmad Saleh")).toBe("AS");
    expect(initialsForName("Finance")).toBe("F");
  });

  it("detects open and overdue assignments deterministically", () => {
    expect(isOpenAssignment("waiting")).toBe(true);
    expect(isOpenAssignment("completed")).toBe(false);
    expect(isOverdueAssignment({ ...base, due_at: "2026-05-14T00:00:00.000Z" }, new Date("2026-05-15T00:00:00.000Z"))).toBe(true);
    expect(assignmentAgeDays(base, new Date("2026-05-15T00:00:00.000Z"))).toBe(5);
  });

  it("sorts overdue and urgent work first", () => {
    const urgent = { ...base, id: "urgent", priority: "urgent" as const, due_at: "2999-05-16T00:00:00.000Z" };
    const overdue = { ...base, id: "overdue", priority: "normal" as const, due_at: "2000-05-14T00:00:00.000Z" };
    const low = { ...base, id: "low", priority: "low" as const, due_at: "2999-05-20T00:00:00.000Z" };

    expect([low, urgent, overdue].sort(sortAssignments).map((assignment) => assignment.id)).toEqual(["overdue", "urgent", "low"]);
  });
});
