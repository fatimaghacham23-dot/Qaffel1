import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("authenticated application shell", () => {
  const source = readFileSync(resolve(process.cwd(), "src/components/AppShell.tsx"), "utf8");

  it("includes an accessible mobile menu, dialog, sign-out action, and active route state", () => {
    expect(source).toContain('aria-label="Open navigation menu"');
    expect(source).toContain('role="dialog"');
    expect(source).toContain("aria-modal=\"true\"");
    expect(source).toContain("<SignOutButton />");
    expect(source).toContain("aria-current={selected ? \"page\" : undefined}");
  });

  it("locks scroll, handles Escape, and focuses the close control while the drawer is open", () => {
    expect(source).toContain('document.body.style.overflow = "hidden"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("drawerCloseRef.current?.focus()");
  });
});
