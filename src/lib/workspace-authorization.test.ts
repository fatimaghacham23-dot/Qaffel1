import { describe, expect, it } from "vitest";
import {
  assertResourceInWorkspace,
  requireWorkspaceCapability,
  workspaceContextFromMembership
} from "@/lib/workspace-authorization";

const user = {
  id: "user-1",
  user_metadata: { full_name: "Finance User" }
};

describe("workspace authorization", () => {
  it("fails closed when an authenticated user has no active membership", () => {
    expect(() => workspaceContextFromMembership(user, null)).toThrow(
      "No active workspace membership"
    );
  });

  it("uses the persisted workspace and role", () => {
    expect(
      workspaceContextFromMembership(user, {
        workspace_id: "workspace-1",
        role: "finance",
        workspaces: { name: "Qaffel Test", owner_id: "owner-1" }
      })
    ).toEqual({
      workspaceId: "workspace-1",
      workspaceName: "Qaffel Test",
      workspaceOwnerId: "owner-1",
      userId: "user-1",
      userFullName: "Finance User",
      role: "finance"
    });
  });

  it("allows only capabilities granted by the existing permission matrix", () => {
    const context = workspaceContextFromMembership(user, {
      workspace_id: "workspace-1",
      role: "finance",
      workspaces: { owner_id: "owner-1" }
    });

    expect(() => requireWorkspaceCapability(context, "payments.void")).not.toThrow();
    expect(() => requireWorkspaceCapability(context, "settings.manage")).toThrow();
  });

  it("blocks a record from another workspace", () => {
    expect(() =>
      assertResourceInWorkspace({ workspace_id: "workspace-2" }, "workspace-1")
    ).toThrow("access denied");
  });
});
