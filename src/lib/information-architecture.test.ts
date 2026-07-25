import { describe, expect, it } from "vitest";
import { mobileNavigationForRole, navigationForRole } from "@/lib/information-architecture";

describe("authenticated information architecture", () => {
  it("keeps the owner workspace focused on seven categories", () => {
    expect(navigationForRole("owner").map((item) => item.id)).toEqual(["home", "invoices", "payments", "clients", "reports", "team", "settings"]);
  });

  it("does not render inaccessible categories for limited roles", () => {
    expect(navigationForRole("staff").map((item) => item.id)).toEqual(["home", "invoices", "payments", "clients", "team"]);
  });

  it("keeps mobile navigation to collection destinations", () => {
    expect(mobileNavigationForRole("owner").map((item) => item.id)).toEqual(["home", "invoices", "payments", "clients"]);
  });
});
