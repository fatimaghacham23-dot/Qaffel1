import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RevenueCurrencyKpiGroups } from "@/components/DashboardIntelligenceSection";
import type { RevenueCurrencyKpiSummary } from "@/lib/revenue-currency-kpis";

function summary(overrides: Partial<RevenueCurrencyKpiSummary> = {}): RevenueCurrencyKpiSummary {
  return {
    currency: "USD",
    bestEarningMonth: { month: "2026-06", amount: 100 },
    averageInvoice: 50,
    revenueTrend: { currentAmount: 20, previousAmount: 10, percentageChange: 1, direction: "up" },
    collectedToBilledRatio: 0.75,
    ...overrides
  };
}

describe("currency-safe dashboard revenue KPI presentation", () => {
  it("renders independently labelled currency groups in deterministic order without approximation copy", () => {
    const html = renderToStaticMarkup(createElement(RevenueCurrencyKpiGroups, {
      summaries: [
        summary({ currency: "USD", bestEarningMonth: { month: "2026-06", amount: 100 } }),
        summary({ currency: "LBP", bestEarningMonth: { month: "2026-05", amount: 1_000_000 }, averageInvoice: 500_000 })
      ]
    }));

    expect(html.indexOf("revenue-kpis-LBP")).toBeLessThan(html.indexOf("revenue-kpis-USD"));
    expect(html).toContain("Revenue KPIs");
    expect(html).toContain("LBP");
    expect(html).toContain("USD");
    expect(html).not.toContain("approx.");
    expect(html).not.toContain("USD equivalent");
    expect(html).not.toContain("totalUsd");
  });

  it("formats an LBP-only group in its own currency without a USD group or hardcoded dollar formatting", () => {
    const html = renderToStaticMarkup(createElement(RevenueCurrencyKpiGroups, {
      summaries: [summary({ currency: "LBP", bestEarningMonth: { month: "2026-06", amount: 1_000_000 }, averageInvoice: 750_000 })]
    }));

    expect(html).toContain("revenue-kpis-LBP");
    expect(html).toContain("1,000,000");
    expect(html).not.toContain("revenue-kpis-USD");
    expect(html).not.toContain("US$");
  });

  it("renders factual unavailable states instead of fabricated values or percentages", () => {
    const emptyHtml = renderToStaticMarkup(createElement(RevenueCurrencyKpiGroups, { summaries: [] }));
    const unavailableHtml = renderToStaticMarkup(createElement(RevenueCurrencyKpiGroups, {
      summaries: [summary({
        bestEarningMonth: null,
        averageInvoice: null,
        revenueTrend: { currentAmount: 10, previousAmount: 0, percentageChange: null, direction: "unavailable" },
        collectedToBilledRatio: null
      })]
    }));

    expect(emptyHtml).toContain("Revenue KPIs are unavailable for the available revenue facts.");
    expect(emptyHtml).not.toContain("revenue-kpis-USD");
    expect(unavailableHtml).toContain("No collected revenue in this period");
    expect(unavailableHtml).toContain("No eligible invoices");
    expect(unavailableHtml).toContain("No billed revenue for ratio");
    expect(unavailableHtml).toContain("Unavailable");
    expect(unavailableHtml).not.toContain("NaN");
    expect(unavailableHtml).not.toContain("Infinity");
  });

  it("converts the decimal ratio to a percentage exactly once and omits a null trend percentage", () => {
    const html = renderToStaticMarkup(createElement(RevenueCurrencyKpiGroups, {
      summaries: [summary({ collectedToBilledRatio: 0.75, revenueTrend: { currentAmount: 10, previousAmount: 0, percentageChange: null, direction: "up" } })]
    }));

    expect(html).toContain("75%");
    expect(html).not.toContain("0.75%");
    expect(html).toContain("Up");
    expect(html).not.toContain("Infinity");
  });

  it("uses responsive, wrapping, screen-reader-labelled structure without nested controls", () => {
    const html = renderToStaticMarkup(createElement(RevenueCurrencyKpiGroups, { summaries: [summary()] }));

    expect(html).toContain("aria-labelledby=\"revenue-kpis-USD\"");
    expect(html).toContain("xl:grid-cols-4");
    expect(html).toContain("break-words");
    expect(html).not.toContain("<button");
  });
});