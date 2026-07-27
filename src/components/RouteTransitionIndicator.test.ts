import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("shared route feedback", () => {
  it("uses a reduced-motion-safe transition indicator without covering content", () => {
    const source = read("src/components/RouteTransitionIndicator.tsx");
    expect(source).toContain("motion-safe:animate");
    expect(source).toContain("motion-reduce:animate-none");
    expect(source).toContain("h-0.5");
    expect(source).toContain("target === \"_blank\"");
    expect(source).toContain("url.search !== window.location.search");
    expect(source).toContain("url.protocol === window.location.protocol");
  });

  it("provides accessible shared loading skeletons for primary workspace routes", () => {
    expect(read("src/components/AuthenticatedRouteLoading.tsx")).toContain('aria-busy="true"');
    expect(read("src/components/AuthenticatedRouteLoading.tsx")).toContain("motion-reduce:animate-none");
    ["dashboard", "invoices", "payments", "clients", "reports", "notifications", "settings"].forEach((route) => {
      expect(read(`src/app/${route}/loading.tsx`)).toContain("AuthenticatedRouteLoading");
    });
  });

  it("keeps command palette focus and recents privacy-safe", () => {
    const source = read("src/components/CommandCenter.tsx");
    expect(source).toContain("safeRecentDestination");
    expect(source).toContain("MAX_COMMAND_RECENTS");
    expect(source).toContain("previousFocusRef");
    expect(source).toContain("currentPage ? \"Current page\" : item.badge");
    expect(source).not.toContain("COMMAND_SEARCHES_KEY");
    expect(source).not.toContain("recentSearches");
  });
});
