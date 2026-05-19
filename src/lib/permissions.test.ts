import { describe, expect, it } from "vitest";
import { hasPermission, requirePermission, getPermissions, ASSIGNABLE_ROLES, ROLE_LABELS, type WorkspaceRole } from "@/lib/permissions";

describe("permission matrix", () => {
  it("owner has all permissions", () => {
    expect(hasPermission("owner", "invoices.create")).toBe(true);
    expect(hasPermission("owner", "team.manage")).toBe(true);
    expect(hasPermission("owner", "exports.finance")).toBe(true);
    expect(hasPermission("owner", "payments.void")).toBe(true);
    expect(hasPermission("owner", "billing.manage")).toBe(true);
  });

  it("admin has operational admin permissions and billing visibility", () => {
    expect(hasPermission("admin", "invoices.create")).toBe(true);
    expect(hasPermission("admin", "team.manage")).toBe(true);
    expect(hasPermission("admin", "exports.finance")).toBe(true);
    expect(hasPermission("admin", "billing.view")).toBe(true);
    expect(hasPermission("admin", "billing.manage")).toBe(false);
  });

  it("finance can review proofs, void payments, and view billing but not create invoices", () => {
    expect(hasPermission("finance", "proofs.review")).toBe(true);
    expect(hasPermission("finance", "payments.void")).toBe(true);
    expect(hasPermission("finance", "exports.finance")).toBe(true);
    expect(hasPermission("finance", "billing.view")).toBe(true);
    expect(hasPermission("finance", "billing.manage")).toBe(false);
    expect(hasPermission("finance", "invoices.create")).toBe(false);
    expect(hasPermission("finance", "team.manage")).toBe(false);
  });

  it("operations can create invoices and manage clients", () => {
    expect(hasPermission("operations", "invoices.create")).toBe(true);
    expect(hasPermission("operations", "clients.create")).toBe(true);
    expect(hasPermission("operations", "recoveries.manage")).toBe(true);
    expect(hasPermission("operations", "payments.void")).toBe(false);
    expect(hasPermission("operations", "team.manage")).toBe(false);
    expect(hasPermission("operations", "billing.view")).toBe(false);
  });

  it("reviewer can only review proofs", () => {
    expect(hasPermission("reviewer", "proofs.review")).toBe(true);
    expect(hasPermission("reviewer", "invoices.view")).toBe(true);
    expect(hasPermission("reviewer", "invoices.create")).toBe(false);
    expect(hasPermission("reviewer", "team.manage")).toBe(false);
    expect(hasPermission("reviewer", "exports.finance")).toBe(false);
    expect(hasPermission("reviewer", "billing.view")).toBe(false);
  });

  it("staff has read-only access", () => {
    expect(hasPermission("staff", "invoices.view")).toBe(true);
    expect(hasPermission("staff", "clients.view")).toBe(true);
    expect(hasPermission("staff", "proofs.view")).toBe(true);
    expect(hasPermission("staff", "invoices.create")).toBe(false);
    expect(hasPermission("staff", "proofs.review")).toBe(false);
    expect(hasPermission("staff", "team.manage")).toBe(false);
  });

  it("null/undefined role has no permissions", () => {
    expect(hasPermission(null, "invoices.view")).toBe(false);
    expect(hasPermission(undefined, "invoices.view")).toBe(false);
  });

  it("requirePermission throws for unauthorized roles", () => {
    expect(() => requirePermission("staff", "team.manage")).toThrow("Permission denied");
    expect(() => requirePermission(null, "invoices.view")).toThrow("Permission denied");
  });

  it("requirePermission passes for authorized roles", () => {
    expect(() => requirePermission("owner", "team.manage")).not.toThrow();
    expect(() => requirePermission("finance", "proofs.review")).not.toThrow();
  });

  it("ASSIGNABLE_ROLES does not include owner", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("owner");
    expect(ASSIGNABLE_ROLES).toContain("admin");
    expect(ASSIGNABLE_ROLES).toContain("staff");
  });

  it("every role has a label", () => {
    const allRoles: WorkspaceRole[] = ["owner", "admin", "finance", "operations", "reviewer", "staff"];
    for (const role of allRoles) {
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("getPermissions returns non-empty arrays for all roles", () => {
    const allRoles: WorkspaceRole[] = ["owner", "admin", "finance", "operations", "reviewer", "staff"];
    for (const role of allRoles) {
      const perms = getPermissions(role);
      expect(perms.length).toBeGreaterThan(0);
    }
  });
});
