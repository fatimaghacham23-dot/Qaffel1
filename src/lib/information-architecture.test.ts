import { describe, expect, it } from "vitest";
import { mobileNavigationForRole, navigationForRole } from "@/lib/information-architecture";

describe("authenticated information architecture", () => {
  it("includes the notifications centre in owner navigation", () => {
    expect(navigationForRole("owner").map((item) => item.id)).toEqual(["home", "invoices", "payments", "clients", "reports", "team", "notifications", "settings"]);
  });

  it("does not render inaccessible categories for limited roles", () => {
    expect(navigationForRole("staff").map((item) => item.id)).toEqual(["home", "invoices", "payments", "clients", "team", "notifications"]);
  });

  it("keeps mobile navigation to collection destinations", () => {
    expect(mobileNavigationForRole("owner").map((item) => item.id)).toEqual(["home", "invoices", "payments", "clients"]);
  });
});
