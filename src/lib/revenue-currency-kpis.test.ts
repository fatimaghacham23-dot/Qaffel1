import { describe, expect, it } from "vitest";
import {
  deriveRevenueCurrencyKpis,
  type CollectedBilledCurrencyFact,
  type InvoiceCurrencyFact,
  type MonthlyRevenueCurrencyValue,
  type RevenueCurrencyKpiInput
} from "@/lib/revenue-currency-kpis";

const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

function input(overrides: Partial<RevenueCurrencyKpiInput> = {}): RevenueCurrencyKpiInput {
  return {
    reportingMonths: months,
    monthlyValues: [],
    invoiceFacts: [],
    collectedBilledFacts: [],
    ...overrides
  };
}

function monthly(overrides: Partial<MonthlyRevenueCurrencyValue> = {}): MonthlyRevenueCurrencyValue {
  return { month: "2026-06", currency: "USD", collected: 0, billed: 0, ...overrides };
}

function invoice(overrides: Partial<InvoiceCurrencyFact> = {}): InvoiceCurrencyFact {
  return { currency: "USD", amount: 10, eligibleForAverage: true, ...overrides };
}

function ratio(overrides: Partial<CollectedBilledCurrencyFact> = {}): CollectedBilledCurrencyFact {
  return { currency: "USD", collected: 0, billed: 0, ...overrides };
}

function sixEligibleInvoices(currency = "USD") {
  return Array.from({ length: 6 }, () => invoice({ currency }));
}

describe("currency-safe revenue KPI contract", () => {
  it("creates a USD-only summary without approximate or converted fields", () => {
    const summaries = deriveRevenueCurrencyKpis(
      input({
        monthlyValues: [monthly({ collected: 50 })],
        invoiceFacts: [invoice({ amount: 12.5 })],
        collectedBilledFacts: [ratio({ collected: 50, billed: 100 })]
      })
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ currency: "USD", averageInvoice: 12.5, collectedToBilledRatio: 0.5 });
    expect("totalUsd" in summaries[0]).toBe(false);
    expect("convertedAmount" in summaries[0]).toBe(false);
    expect("approximateValue" in summaries[0]).toBe(false);
  });

  it("keeps USD, LBP, and supported non-base currencies in separate deterministic summaries", () => {
    const factualInput = input({
      monthlyValues: [
        monthly({ currency: "USD", collected: 10 }),
        monthly({ currency: "LBP", collected: 1_000_000 }),
        monthly({ currency: "AED", collected: 50 })
      ],
      invoiceFacts: [invoice({ currency: "USD", amount: 10 }), invoice({ currency: "LBP", amount: 1_000_000 })],
      collectedBilledFacts: [ratio({ currency: "USD", collected: 10, billed: 20 }), ratio({ currency: "LBP", collected: 100, billed: 200 })]
    });
    const first = deriveRevenueCurrencyKpis(factualInput);
    const second = deriveRevenueCurrencyKpis({
      ...factualInput,
      monthlyValues: [...factualInput.monthlyValues].reverse(),
      invoiceFacts: [...factualInput.invoiceFacts].reverse(),
      collectedBilledFacts: [...factualInput.collectedBilledFacts].reverse()
    });

    expect(first.map((summary) => summary.currency)).toEqual(["AED", "LBP", "USD"]);
    expect(second).toEqual(first);
    expect(first.find((summary) => summary.currency === "USD")?.bestEarningMonth?.amount).toBe(10);
    expect(first.find((summary) => summary.currency === "LBP")?.bestEarningMonth?.amount).toBe(1_000_000);
  });

  it("excludes malformed currencies, months, non-finite values, and facts outside the reporting period", () => {
    const summaries = deriveRevenueCurrencyKpis(
      input({
        monthlyValues: [
          monthly({ currency: "US", collected: 99 }),
          monthly({ month: "2026-13", collected: 99 }),
          monthly({ month: "2027-01", collected: 99 }),
          monthly({ currency: "EUR", collected: Number.POSITIVE_INFINITY }),
          monthly({ currency: "EUR", collected: 7 })
        ],
        invoiceFacts: [invoice({ currency: "US" }), invoice({ currency: "EUR", amount: Number.NaN })],
        collectedBilledFacts: [ratio({ currency: "USD", billed: Number.NEGATIVE_INFINITY })]
      })
    );

    expect(summaries).toEqual([
      {
        currency: "EUR",
        bestEarningMonth: { month: "2026-06", amount: 7 },
        averageInvoice: null,
        revenueTrend: { currentAmount: 0, previousAmount: 0, percentageChange: null, direction: "unavailable" },
        collectedToBilledRatio: null
      }
    ]);
  });

  it("selects the highest collected month per currency and preserves the first chronological month on a tie", () => {
    const summaries = deriveRevenueCurrencyKpis(
      input({
        monthlyValues: [
          monthly({ month: "2026-01", currency: "USD", collected: 20 }),
          monthly({ month: "2026-02", currency: "USD", collected: 20 }),
          monthly({ month: "2026-06", currency: "LBP", collected: 500_000 })
        ]
      })
    );

    expect(summaries.find((summary) => summary.currency === "USD")?.bestEarningMonth).toEqual({ month: "2026-01", amount: 20 });
    expect(summaries.find((summary) => summary.currency === "LBP")?.bestEarningMonth).toEqual({ month: "2026-06", amount: 500_000 });
  });

  it("returns no best earning month when collected amounts are zero or negative", () => {
    const summaries = deriveRevenueCurrencyKpis(
      input({ monthlyValues: [monthly({ collected: 0 }), monthly({ month: "2026-05", collected: -2 })] })
    );

    expect(summaries[0].bestEarningMonth).toBeNull();
  });

  it("averages only eligible positive invoices within each currency at six-decimal money precision", () => {
    const summaries = deriveRevenueCurrencyKpis(
      input({
        invoiceFacts: [
          invoice({ currency: "USD", amount: 10.123456 }),
          invoice({ currency: "USD", amount: 20.123456 }),
          invoice({ currency: "USD", amount: 999, eligibleForAverage: false }),
          invoice({ currency: "USD", amount: 0 }),
          invoice({ currency: "LBP", amount: 2_000_000 })
        ]
      })
    );

    expect(summaries.find((summary) => summary.currency === "USD")?.averageInvoice).toBe(15.123456);
    expect(summaries.find((summary) => summary.currency === "LBP")?.averageInvoice).toBe(2_000_000);
  });

  it("uses the caller's established eligibility result for quotes, cancelled, and voided invoices", () => {
    const summaries = deriveRevenueCurrencyKpis(
      input({
        monthlyValues: [monthly({ collected: 1 })],
        invoiceFacts: [
          invoice({ amount: 100, eligibleForAverage: false }),
          invoice({ amount: 200, eligibleForAverage: false }),
          invoice({ amount: 300, eligibleForAverage: false })
        ]
      })
    );

    expect(summaries[0].averageInvoice).toBeNull();
    expect(summaries[0].revenueTrend.direction).toBe("unavailable");
  });

  it("uses the legacy three-month average comparison and thresholds independently per currency", () => {
    const usdInvoices = sixEligibleInvoices("USD");
    const lbpInvoices = sixEligibleInvoices("LBP");
    const summaries = deriveRevenueCurrencyKpis(
      input({
        monthlyValues: [
          ...months.map((month) => monthly({ month, currency: "USD", collected: month < "2026-04" ? 10 : 20 })),
          ...months.map((month) => monthly({ month, currency: "LBP", collected: month < "2026-04" ? 1_000 : 500 }))
        ],
        invoiceFacts: [...usdInvoices, ...lbpInvoices]
      })
    );

    expect(summaries.find((summary) => summary.currency === "USD")?.revenueTrend).toMatchObject({
      currentAmount: 20,
      previousAmount: 10,
      percentageChange: 1,
      direction: "up"
    });
    expect(summaries.find((summary) => summary.currency === "LBP")?.revenueTrend).toMatchObject({
      currentAmount: 500,
      previousAmount: 1_000,
      percentageChange: -0.5,
      direction: "down"
    });
  });

  it("returns flat for equal averages and treats zero previous amounts as up without Infinity", () => {
    const flat = deriveRevenueCurrencyKpis(
      input({
        monthlyValues: months.map((month) => monthly({ month, collected: 10 })),
        invoiceFacts: sixEligibleInvoices()
      })
    )[0];
    const zeroPrevious = deriveRevenueCurrencyKpis(
      input({
        monthlyValues: months.map((month) => monthly({ month, collected: month < "2026-04" ? 0 : 10 })),
        invoiceFacts: sixEligibleInvoices()
      })
    )[0];

    expect(flat.revenueTrend).toMatchObject({ direction: "flat", percentageChange: 0 });
    expect(zeroPrevious.revenueTrend).toMatchObject({ direction: "up", percentageChange: null });
    expect(Number.isFinite(zeroPrevious.revenueTrend.currentAmount)).toBe(true);
    expect(Number.isFinite(zeroPrevious.revenueTrend.previousAmount)).toBe(true);
  });

  it("returns unavailable when the reporting period or eligible invoice comparison base is incomplete", () => {
    const shortPeriod = deriveRevenueCurrencyKpis(
      input({ reportingMonths: months.slice(1), monthlyValues: [monthly({ collected: 10 })], invoiceFacts: sixEligibleInvoices() })
    )[0];
    const shortInvoiceBase = deriveRevenueCurrencyKpis(
      input({ monthlyValues: [monthly({ collected: 10 })], invoiceFacts: [invoice()] })
    )[0];

    expect(shortPeriod.revenueTrend.direction).toBe("unavailable");
    expect(shortInvoiceBase.revenueTrend.direction).toBe("unavailable");
  });

  it("calculates the legacy decimal collected-to-billed ratio per currency and returns null for zero billed", () => {
    const summaries = deriveRevenueCurrencyKpis(
      input({
        collectedBilledFacts: [
          ratio({ currency: "USD", collected: 50, billed: 100 }),
          ratio({ currency: "LBP", collected: 1_000_000, billed: 2_000_000 }),
          ratio({ currency: "AED", collected: 10, billed: 0 })
        ]
      })
    );

    expect(summaries.find((summary) => summary.currency === "USD")?.collectedToBilledRatio).toBe(0.5);
    expect(summaries.find((summary) => summary.currency === "LBP")?.collectedToBilledRatio).toBe(0.5);
    expect(summaries.find((summary) => summary.currency === "AED")?.collectedToBilledRatio).toBeNull();
    expect(summaries.every((summary) => summary.collectedToBilledRatio === null || Number.isFinite(summary.collectedToBilledRatio))).toBe(true);
  });
});
