import { describe, expect, it } from "vitest";
import { drawerSideClass, drawerShouldClose } from "@/lib/mobile-navigation";

describe("mobile navigation drawer behaviour", () => {
  it("closes for accessible close interactions", () => {
    expect(drawerShouldClose("escape")).toBe(true);
    expect(drawerShouldClose("overlay")).toBe(true);
    expect(drawerShouldClose("navigation")).toBe(true);
    expect(drawerShouldClose("close-button")).toBe(true);
  });

  it("uses the logical start side in RTL", () => {
    expect(drawerSideClass(false)).toContain("right-0");
    expect(drawerSideClass(true)).toContain("left-0");
  });
});
