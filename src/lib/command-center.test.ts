import { describe, expect, it } from "vitest";
import { MAX_COMMAND_RECENTS, safeRecentDestination, sortCommandItems, staticCommandItems } from "@/lib/command-center";

describe("command centre navigation", () => {
  it("provides the approved navigation and safe quick actions", () => {
    const ids = new Set(staticCommandItems.map((item) => item.id));
    ["nav:dashboard", "nav:invoices", "nav:payments", "nav:clients", "nav:reports", "nav:team", "nav:notifications", "settings:profile", "nav:intelligence", "nav:operations", "nav:recoveries", "action:new-invoice", "action:new-client", "action:review-proofs", "action:view-overdue"].forEach((id) => expect(ids.has(id)).toBe(true));
  });

  it("keeps fuzzy command matching and orders direct matches first", () => {
    expect(sortCommandItems(staticCommandItems, "payment")[0]?.title).toContain("Payment");
    expect(sortCommandItems(staticCommandItems, "inv").some((item) => item.href === "/invoices")).toBe(true);
  });

  it("stores only bounded, route-safe recent destinations", () => {
    const safe = staticCommandItems.find((item) => item.id === "nav:payments");
    expect(safe && safeRecentDestination(safe)?.href).toBe("/payments");
    expect(MAX_COMMAND_RECENTS).toBe(5);
    expect(safeRecentDestination({ id: "unsafe", type: "invoice", title: "Private invoice", href: "/invoices/uuid?token=secret" })).toBeNull();
    expect(safeRecentDestination({ id: "remote", type: "client", title: "Customer", href: "/clients/uuid" })).toBeNull();
  });
});
