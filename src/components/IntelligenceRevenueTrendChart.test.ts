import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatRevenueChartAmount, IntelligenceRevenueTrendChart, revenueMonthLabel, revenueTooltipLabel } from "@/components/IntelligenceRevenueTrendChart";
import { deriveRevenueCurrencyCharts } from "@/lib/revenue-currency-charts";

const mixedCharts = deriveRevenueCurrencyCharts(
  [
    { month: "2026-06", currency: "USD", metric: "collected", amount: 10 },
    { month: "2026-06", currency: "LBP", metric: "billed", amount: 1_000_000 }
  ],
  { reportingMonths: ["2026-06"] }
);

describe("currency-safe revenue chart presentation", () => {
  it("renders one labelled chart section per currency without approximation copy", () => {
    const html = renderToStaticMarkup(createElement(IntelligenceRevenueTrendChart, { charts: mixedCharts }));
    expect(html).toContain("Revenue trend — LBP");
    expect(html).toContain("Revenue trend — USD");
    expect(html).not.toContain("approx");
    expect(html).not.toContain("USD equivalent");
  });

  it("formats tooltip values and labels in the chart currency", () => {
    expect(revenueTooltipLabel("overdue", "LBP")).toBe("Overdue · LBP");
    expect(formatRevenueChartAmount(1_000_000, "LBP")).toContain("1,000,000");
    expect(revenueMonthLabel("2026-06")).toBe("Jun 2026");
  });

  it("renders the factual empty state without another currency section", () => {
    const html = renderToStaticMarkup(createElement(IntelligenceRevenueTrendChart, { charts: [] }));
    expect(html).toContain("Not enough monthly activity to chart yet.");
    expect(html).not.toContain("Revenue trend — USD");
  });
});