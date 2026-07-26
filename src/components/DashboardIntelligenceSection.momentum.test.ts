import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MomentumCurrencyIndicatorGroups, MomentumSharedMetrics } from "@/components/DashboardIntelligenceSection";
import type { MomentumCurrencyIndicators } from "@/lib/momentum-currency-indicators";

function indicator(overrides: Partial<MomentumCurrencyIndicators> = {}): MomentumCurrencyIndicators {
  return {
    currency: "USD",
    velocity: { currentAmount: 120, previousAmount: 100, percentageChange: 0.2, direction: "up" },
    outstandingGrowth: -20,
    ...overrides
  };
}

describe("currency-safe dashboard momentum presentation", () => {
  it("renders independent currency groups in deterministic order without approximation copy", () => {
    const html = renderToStaticMarkup(createElement(MomentumCurrencyIndicatorGroups, {
      indicators: [
        indicator({ currency: "USD" }),
        indicator({ currency: "LBP", velocity: { currentAmount: 1_000_000, previousAmount: 500_000, percentageChange: 1, direction: "up" }, outstandingGrowth: 250_000 })
      ]
    }));

    expect(html.indexOf("momentum-LBP")).toBeLessThan(html.indexOf("momentum-USD"));
    expect(html).toContain("Momentum");
    expect(html).toContain("LBP");
    expect(html).toContain("USD");
    expect(html).not.toContain("approx.");
    expect(html).not.toContain("USD equivalent");
    expect(html).not.toContain("totalUsd");
  });

  it("formats an LBP-only group without creating a USD group or hardcoded dollar format", () => {
    const html = renderToStaticMarkup(createElement(MomentumCurrencyIndicatorGroups, {
      indicators: [indicator({ currency: "LBP", velocity: { currentAmount: 1_000_000, previousAmount: 0, percentageChange: null, direction: "up" }, outstandingGrowth: -500_000 })]
    }));

    expect(html).toContain("momentum-LBP");
    expect(html).toContain("1,000,000");
    expect(html).not.toContain("momentum-USD");
    expect(html).not.toContain("US$");
  });

  it("renders velocity direction text, omits null percentages, and never renders non-finite values", () => {
    const html = renderToStaticMarkup(createElement(MomentumCurrencyIndicatorGroups, {
      indicators: [
        indicator({ currency: "USD", velocity: { currentAmount: 10, previousAmount: 0, percentageChange: null, direction: "up" }, outstandingGrowth: 0 }),
        indicator({ currency: "LBP", velocity: { currentAmount: 0, previousAmount: 0, percentageChange: null, direction: "unavailable" }, outstandingGrowth: 0 })
      ]
    }));

    expect(html).toContain("Up");
    expect(html).toContain("Unavailable");
    expect(html).toContain("At least four accepted proofs are needed.");
    expect(html).not.toContain("Infinity");
    expect(html).not.toContain("NaN");
  });

  it("renders the compact factual empty state without a placeholder currency group", () => {
    const html = renderToStaticMarkup(createElement(MomentumCurrencyIndicatorGroups, { indicators: [] }));

    expect(html).toContain("Monetary momentum is unavailable for the available facts.");
    expect(html).not.toContain("momentum-USD");
  });

  it("renders shared overdue counts and repeat rate once without a currency label", () => {
    const html = renderToStaticMarkup(createElement(MomentumSharedMetrics, {
      shared: { overdueCountNow: 3, overdueCountPriorMonth: 1, repeatClientRate: 0.75 }
    }));

    expect((html.match(/Overdue now/g) || [])).toHaveLength(1);
    expect((html.match(/Repeat client rate/g) || [])).toHaveLength(1);
    expect(html).toContain("3 · 1");
    expect(html).toContain("75%");
    expect(html).not.toContain("USD");
    expect(html).not.toContain("LBP");
  });

  it("uses responsive, wrapping, screen-reader-labelled structure without nested controls", () => {
    const html = renderToStaticMarkup(createElement(MomentumCurrencyIndicatorGroups, { indicators: [indicator()] }));

    expect(html).toContain("aria-labelledby=\"momentum-USD\"");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("break-words");
    expect(html).not.toContain("<button");
  });
});