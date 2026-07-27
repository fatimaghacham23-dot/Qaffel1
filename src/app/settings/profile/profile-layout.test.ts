import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/settings/profile/page.tsx"), "utf8");

describe("Business Profile layout", () => {
  it("uses an expanded, padded desktop content container with vertical section spacing", () => {
    expect(source).toContain('className="max-w-[90rem] space-y-8"');
    expect(source).toContain('<PageContainer width="default"');
  });

  it("uses a separated desktop two-column grid with a wider form column", () => {
    expect(source).toContain('grid min-w-0 items-start gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]');
  });

  it("stacks below the desktop breakpoint without horizontal overflow or physical RTL spacing", () => {
    expect(source).toContain("xl:grid-cols-");
    expect(source).toContain("min-w-0");
    expect(source).not.toMatch(/\b(?:ml|mr|left|right)-/);
  });
});
