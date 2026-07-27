import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { safeRecentDestination, staticCommandItems } from "@/lib/command-center";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("integrations navigation safety", () => {
  it("uses the existing Settings entry point instead of a nonexistent integrations page", () => {
    const reports = source("src/app/reports/page.tsx");
    expect(reports).toContain('href="/settings"');
    expect(reports).toContain("Manage available connections in Settings");
    expect(reports).not.toContain("/settings/integrations");
    expect(source("src/lib/information-architecture.ts")).not.toContain("/settings/profile#integrations");
  });

  it("uses server redirects for Settings and the obsolete integrations URL", () => {
    expect(source("src/app/settings/page.tsx")).toContain('redirect("/settings/profile")');
    expect(source("src/app/settings/integrations/page.tsx")).toContain('redirect("/settings")');
  });

  it("does not expose the obsolete route through the command palette or recents", () => {
    expect(staticCommandItems.every((item) => item.href !== "/settings/integrations")).toBe(true);
    expect(safeRecentDestination({ id: "obsolete", type: "setting", title: "Integrations", href: "/settings/integrations" })).toBeNull();
  });

  it("keeps Settings active for valid nested Settings routes and verifies literal destinations", () => {
    const shell = source("src/components/AppShell.tsx");
    expect(shell).toContain('pathname.startsWith(href + "/")');
    const guard = source("scripts/check-production-urls.mjs");
    expect(guard).toContain("unknown internal destination");
    expect(guard).toContain('"/settings/integrations", "/settings"');
  });
});