import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(resolve(process.cwd(), `src/components/layout/${name}`), "utf8");

describe("responsive layout primitives", () => {
  it("supports PageContainer width variants and caller content", () => {
    const file = source("PageContainer.tsx");
    expect(file).toContain('"default" | "wide" | "compact"');
    expect(file).toContain("{children}");
  });
  it("provides semantic PageHeader and SectionCard headings, actions, and mobile actions", () => {
    expect(source("PageHeader.tsx")).toContain("<h1");
    expect(source("PageHeader.tsx")).toContain("mobileActions");
    expect(source("SectionCard.tsx")).toContain("<h2");
    expect(source("SectionCard.tsx")).toContain("noPadding");
  });
  it("keeps ResponsiveGrid typed and mobile-first", () => {
    const file = source("ResponsiveGrid.tsx");
    expect(file).toContain("type Columns = 1 | 2 | 3 | 4");
    expect(file).toContain("grid-cols-1");
  });
  it("renders one responsive data representation at a time with labelled mobile values", () => {
    const file = source("ResponsiveDataList.tsx");
    expect(file).toContain("hidden overflow-x-auto md:block");
    expect(file).toContain("grid gap-3 md:hidden");
    expect(file).toContain("aria-busy");
  });
  it("provides a mobile-only action bar and companion content spacing", () => {
    const file = source("MobileActionBar.tsx");
    expect(file).toContain("env(safe-area-inset-bottom)");
    expect(file).toContain("mobileActionBarContentSpacing");
  });
});
