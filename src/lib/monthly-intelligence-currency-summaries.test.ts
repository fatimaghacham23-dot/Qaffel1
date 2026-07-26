import { describe, expect, it } from "vitest";
import {
  deriveMonthlyIntelligenceCurrencySummaries,
  type MonthlyIntelligenceCurrencyFact,
  type MonthlyIntelligenceCurrencySummaryInput,
  type MonthlyIntelligencePaymentMethodFact,
  type MonthlySharedIntelligenceFact
} from "@/lib/monthly-intelligence-currency-summaries";

const reportingMonths = ["2026-01", "2026-02", "2026-03"];

function input(overrides: Partial<MonthlyIntelligenceCurrencySummaryInput> = {}): MonthlyIntelligenceCurrencySummaryInput {
  return { reportingMonths, currencyFacts: [], sharedFacts: [], paymentMethodFacts: [], ...overrides };
}

function currencyFact(overrides: Partial<MonthlyIntelligenceCurrencyFact> = {}): MonthlyIntelligenceCurrencyFact {
  return { month: "2026-01", currency: "USD", collected: 0, overdue: 0, ...overrides };
}

function sharedFact(overrides: Partial<MonthlySharedIntelligenceFact> = {}): MonthlySharedIntelligenceFact {
  return { month: "2026-01", invoicesCreated: 0, newClients: 0, ...overrides };
}

function methodFact(overrides: Partial<MonthlyIntelligencePaymentMethodFact> = {}): MonthlyIntelligencePaymentMethodFact {
  return { month: "2026-01", method: "Bank transfer", sourceOrder: 0, ...overrides };
}

describe("currency-safe monthly intelligence summary contract", () => {
  it("creates USD-only monthly monetary summaries and zero-fills the reporting calendar", () => {
    const result = deriveMonthlyIntelligenceCurrencySummaries(input({
      currencyFacts: [currencyFact({ collected: 125.25, overdue: 40 })],
      sharedFacts: [sharedFact({ invoicesCreated: 2, newClients: 1 })],
      paymentMethodFacts: [methodFact()]
    }));

    expect(result.currencySummaries).toEqual([
      { month: "2026-01", currency: "USD", collected: 125.25, overdue: 40 },
      { month: "2026-02", currency: "USD", collected: 0, overdue: 0 },
      { month: "2026-03", currency: "USD", collected: 0, overdue: 0 }
    ]);
    expect(result.sharedSummaries).toEqual([
      { month: "2026-01", invoicesCreated: 2, newClients: 1, topMethod: "Bank transfer", operationalIssues: 1 },
      { month: "2026-02", invoicesCreated: 0, newClients: 0, topMethod: null, operationalIssues: 0 },
      { month: "2026-03", invoicesCreated: 0, newClients: 0, topMethod: null, operationalIssues: 0 }
    ]);
  });

  it("creates LBP-only summaries without fabricating a USD row", () => {
    const result = deriveMonthlyIntelligenceCurrencySummaries(input({
      currencyFacts: [currencyFact({ currency: "LBP", collected: 2_500_000, overdue: 750_000 })]
    }));

    expect(result.currencySummaries.map((summary) => summary.currency)).toEqual(["LBP", "LBP", "LBP"]);
    expect(result.currencySummaries[0]).toMatchObject({ collected: 2_500_000, overdue: 750_000 });
  });

  it("keeps mixed currencies separate, aggregates duplicate facts safely, and orders months then currencies", () => {
    const factualInput = input({
      currencyFacts: [
        currencyFact({ month: "2026-03", currency: "USD", collected: 15, overdue: 0 }),
        currencyFact({ month: "2026-01", currency: "LBP", collected: 500_000, overdue: 100_000 }),
        currencyFact({ month: "2026-01", currency: "USD", collected: 20, overdue: 10 }),
        currencyFact({ month: "2026-01", currency: "USD", collected: 5, overdue: 50 })
      ]
    });
    const first = deriveMonthlyIntelligenceCurrencySummaries(factualInput);
    const second = deriveMonthlyIntelligenceCurrencySummaries({ ...factualInput, currencyFacts: [...factualInput.currencyFacts].reverse() });

    expect(first).toEqual(second);
    expect(first.currencySummaries).toEqual([
      { month: "2026-01", currency: "LBP", collected: 500_000, overdue: 100_000 },
      { month: "2026-01", currency: "USD", collected: 25, overdue: 60 },
      { month: "2026-02", currency: "LBP", collected: 0, overdue: 0 },
      { month: "2026-02", currency: "USD", collected: 0, overdue: 0 },
      { month: "2026-03", currency: "LBP", collected: 0, overdue: 0 },
      { month: "2026-03", currency: "USD", collected: 15, overdue: 0 }
    ]);
    expect(first.currencySummaries).not.toContainEqual(expect.objectContaining({ currency: "USD", collected: 500_000 }));
  });

  it("retains canonical partial overdue remainders while paid invoices contribute no overdue factual amount", () => {
    const result = deriveMonthlyIntelligenceCurrencySummaries(input({
      currencyFacts: [
        currencyFact({ collected: 40, overdue: 60 }),
        currencyFact({ collected: 100, overdue: 0 })
      ]
    }));

    expect(result.currencySummaries[0]).toMatchObject({ collected: 140, overdue: 60 });
    expect(result.sharedSummaries[0].operationalIssues).toBe(1);
  });

  it("keeps count-derived fields shared and resolves the legacy top-method tie using source order", () => {
    const result = deriveMonthlyIntelligenceCurrencySummaries(input({
      currencyFacts: [currencyFact({ currency: "USD" }), currencyFact({ currency: "LBP" })],
      sharedFacts: [sharedFact({ invoicesCreated: 3, newClients: 2 }), sharedFact({ invoicesCreated: 1, newClients: 1 })],
      paymentMethodFacts: [
        methodFact({ method: "Card", sourceOrder: 4 }),
        methodFact({ method: "Bank transfer", sourceOrder: 2 }),
        methodFact({ method: "Card", sourceOrder: 4 }),
        methodFact({ method: "Bank transfer", sourceOrder: 2 })
      ]
    }));

    expect(result.sharedSummaries[0]).toEqual({ month: "2026-01", invoicesCreated: 4, newClients: 3, topMethod: "Bank transfer", operationalIssues: 0 });
    expect(result.sharedSummaries).toHaveLength(3);
    expect(result.sharedSummaries[0]).not.toHaveProperty("currency");
  });

  it("excludes malformed months, currencies, non-finite amounts, invalid counts, and facts outside the reporting window while retaining valid zeroes", () => {
    const result = deriveMonthlyIntelligenceCurrencySummaries(input({
      currencyFacts: [
        currencyFact({ month: "2026-13", collected: 9 }),
        currencyFact({ month: "2026-04", collected: 9 }),
        currencyFact({ currency: "US", collected: 9 }),
        currencyFact({ currency: "EUR", collected: Number.POSITIVE_INFINITY }),
        currencyFact({ currency: "AED", collected: 0, overdue: 0 })
      ],
      sharedFacts: [sharedFact({ invoicesCreated: -1, newClients: 1 }), sharedFact({ month: "2026-02", invoicesCreated: 1, newClients: 0 })],
      paymentMethodFacts: [methodFact({ sourceOrder: -1 }), methodFact({ month: "2026-04", method: "Card" })]
    }));

    expect(result.currencySummaries).toEqual([
      { month: "2026-01", currency: "AED", collected: 0, overdue: 0 },
      { month: "2026-02", currency: "AED", collected: 0, overdue: 0 },
      { month: "2026-03", currency: "AED", collected: 0, overdue: 0 }
    ]);
    expect(result.sharedSummaries[1]).toEqual({ month: "2026-02", invoicesCreated: 1, newClients: 0, topMethod: null, operationalIssues: 0 });
  });

  it("uses the supplied reporting window chronologically and does not create a currency without factual presence", () => {
    const result = deriveMonthlyIntelligenceCurrencySummaries(input({
      reportingMonths: ["2026-03", "2026-01", "2026-02", "2026-01", "2026-14"],
      currencyFacts: [currencyFact({ month: "2026-02", currency: "AED", collected: 5 })]
    }));

    expect(result.currencySummaries.map((summary) => `${summary.month}:${summary.currency}`)).toEqual(["2026-01:AED", "2026-02:AED", "2026-03:AED"]);
    expect(result.sharedSummaries.map((summary) => summary.month)).toEqual(reportingMonths);
  });

  it("exposes no converted, approximate, or mixed-currency monetary fields", () => {
    const result = deriveMonthlyIntelligenceCurrencySummaries(input({
      currencyFacts: [currencyFact({ currency: "USD", collected: 20 }), currencyFact({ currency: "LBP", collected: 2_000_000 })]
    }));

    for (const summary of result.currencySummaries) {
      expect("totalUsd" in summary).toBe(false);
      expect("convertedAmount" in summary).toBe(false);
      expect("approximateValue" in summary).toBe(false);
      expect("monetaryRatios" in summary).toBe(false);
      expect(Number.isFinite(summary.collected)).toBe(true);
      expect(Number.isFinite(summary.overdue)).toBe(true);
    }
  });
});