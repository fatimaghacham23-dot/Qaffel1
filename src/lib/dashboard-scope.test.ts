import { describe, expect, it } from "vitest";
import { dashboardScope } from "@/lib/dashboard-scope";

describe("dashboard workspace isolation", () => {
  it("builds exact workspace and joined-proof filters without sharing scope", () => {
    expect(dashboardScope("workspace-a")).toEqual({ workspace: ["workspace_id", "workspace-a"], proofWorkspace: ["invoices.workspace_id", "workspace-a"] });
    expect(dashboardScope("workspace-b")).not.toEqual(dashboardScope("workspace-a"));
  });

  it("refuses to query without a workspace boundary", () => {
    expect(() => dashboardScope(" ")).toThrow("workspace is required");
  });
});
