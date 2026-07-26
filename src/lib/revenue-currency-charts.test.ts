import { describe, expect, it } from "vitest";
import {
  deriveRevenueCurrencyCharts,
  REVENUE_METRICS,
  type MonthlyRevenueCurrencyFact
} from "@/lib/revenue-currency-charts";

const fact = (overrides: Partial<MonthlyRevenueCurrencyFact>): MonthlyRevenueCurrencyFact => ({
  month: "2026-06",
  currency: "USD",
  metric: "collected",
  amount: 1,
  ...overrides
});

describe("currency-safe revenue chart contract", () => {
  it("creates only the supplied USD chart and preserves its factual values", () => {
    const charts = deriveRevenueCurrencyCharts([fact({ amount: 12 })]);
    expect(charts).toHaveLength(1);
    expect(charts[0].currency).toBe("USD");
    expect(charts[0].rows[0].values["USD:collected"]).toBe(12);
    expect(charts[0].series.map((item) => item.metric)).toEqual(REVENUE_METRICS);
  });

  it("creates only the supplied LBP chart", () => {
    const charts = deriveRevenueCurrencyCharts([fact({ currency: "LBP", amount: 2_000_000 })]);
    expect(charts).toHaveLength(1);
    expect(charts[0]).toMatchObject({ currency: "LBP" });
    expect(charts[0].series[0]).toMatchObject({ key: "LBP:collected", currency: "LBP" });
    expect(charts[0].rows[0].values["LBP:collected"]).toBe(2_000_000);
  });

  it("keeps mixed currencies in independent chart contracts and series", () => {
    const charts = deriveRevenueCurrencyCharts([
      fact({ currency: "USD", amount: 10 }),
      fact({ currency: "LBP", amount: 1_000_000, metric: "billed" })
    ]);
    expect(charts.map((chart) => chart.currency)).toEqual(["LBP", "USD"]);
    expect(charts[0].series.every((series) => series.currency === "LBP" && series.key.startsWith("LBP:"))).toBe(true);
    expect(charts[1].series.every((series) => series.currency === "USD" && series.key.startsWith("USD:"))).toBe(true);
  });

  it("aggregates duplicate factual values only within matching month, currency, and metric", () => {
    const charts = deriveRevenueCurrencyCharts([
      fact({ amount: 2 }),
      fact({ amount: 3 }),
      fact({ metric: "billed", amount: 9 }),
      fact({ currency: "LBP", amount: 2_000_000 })
    ]);
    const usd = charts.find((chart) => chart.currency === "USD");
    expect(usd?.rows[0].values).toMatchObject({ "USD:collected": 5, "USD:billed": 9, "USD:overdue": 0 });
  });

  it("sorts months chronologically and zero-fills only the explicit reporting period", () => {
    const charts = deriveRevenueCurrencyCharts(
      [fact({ month: "2026-08", amount: 8 }), fact({ month: "2026-06", amount: 6 })],
      { reportingMonths: ["2026-05", "2026-06", "2026-07", "2026-08"] }
    );
    expect(charts[0].rows.map((row) => row.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(charts[0].rows[0].values["USD:collected"]).toBe(0);
    expect(charts[0].rows[2].values["USD:collected"]).toBe(0);
  });

  it("excludes malformed months, currencies, and non-finite amounts without creating another contract", () => {
    const charts = deriveRevenueCurrencyCharts([
      fact({ month: "2026-13" }),
      fact({ currency: "US", month: "2026-07" }),
      fact({ currency: "EUR", amount: Number.POSITIVE_INFINITY }),
      fact({ currency: "EUR", amount: 7 })
    ]);
    expect(charts).toEqual([
      {
        currency: "EUR",
        series: [
          { key: "EUR:collected", metric: "collected", currency: "EUR" },
          { key: "EUR:billed", metric: "billed", currency: "EUR" },
          { key: "EUR:overdue", metric: "overdue", currency: "EUR" }
        ],
        rows: [{ month: "2026-06", values: { "EUR:collected": 7, "EUR:billed": 0, "EUR:overdue": 0 } }]
      }
    ]);
  });

  it("is deterministic, retains valid unsupported currencies, and has no cross-currency totals", () => {
    const facts = [fact({ currency: "AED", amount: 4 }), fact({ currency: "USD", amount: 5, metric: "overdue" })];
    const first = deriveRevenueCurrencyCharts(facts);
    const second = deriveRevenueCurrencyCharts([...facts].reverse());
    expect(first).toEqual(second);
    expect(first.map((chart) => chart.currency)).toEqual(["AED", "USD"]);
    expect("totalUsd" in first[0]).toBe(false);
    expect("convertedAmount" in first[0].rows[0]).toBe(false);
    expect(first[0].series.map((series) => series.key)).toEqual(["AED:collected", "AED:billed", "AED:overdue"]);
  });
});
