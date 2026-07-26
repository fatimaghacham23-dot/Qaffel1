import { describe, expect, it } from "vitest";
import {
  deriveMomentumCurrencyIndicators,
  type MomentumCollectionCurrencyFact,
  type MomentumCurrencyIndicatorInput,
  type MomentumOutstandingCurrencyFact
} from "@/lib/momentum-currency-indicators";

function input(overrides: Partial<MomentumCurrencyIndicatorInput> = {}): MomentumCurrencyIndicatorInput {
  return {
    collectionFacts: [],
    outstandingFacts: [],
    shared: { overdueCountNow: 0, overdueCountPriorMonth: 0, repeatClientRate: null },
    ...overrides
  };
}

function collection(overrides: Partial<MomentumCollectionCurrencyFact> = {}): MomentumCollectionCurrencyFact {
  return { currency: "USD", period: "current_30d", amount: 10, ...overrides };
}

function outstanding(overrides: Partial<MomentumOutstandingCurrencyFact> = {}): MomentumOutstandingCurrencyFact {
  return { currency: "USD", currentAmount: 60, olderAmount: 100, eligibleForOutstanding: true, ...overrides };
}

describe("currency-safe momentum indicator contract", () => {
  it("creates a USD-only monetary summary with separate shared count/rate fields", () => {
    const result = deriveMomentumCurrencyIndicators(input({
      collectionFacts: [
        collection({ period: "current_30d", amount: 20 }),
        collection({ period: "current_30d", amount: 20 }),
        collection({ period: "previous_30d", amount: 10 }),
        collection({ period: "previous_30d", amount: 10 })
      ],
      outstandingFacts: [outstanding()],
      shared: { overdueCountNow: 3, overdueCountPriorMonth: 2, repeatClientRate: 0.5 }
    }));

    expect(result.currencyIndicators).toEqual([
      expect.objectContaining({
        currency: "USD",
        outstandingGrowth: -40,
        velocity: expect.objectContaining({ currentAmount: 40, previousAmount: 20, percentageChange: 1, direction: "up" })
      })
    ]);
    expect(result.shared).toEqual({ overdueCountNow: 3, overdueCountPriorMonth: 2, repeatClientRate: 0.5 });
    expect("totalUsd" in result.currencyIndicators[0]).toBe(false);
    expect("convertedAmount" in result.currencyIndicators[0]).toBe(false);
  });

  it("creates an LBP-only monetary summary without a USD total", () => {
    const result = deriveMomentumCurrencyIndicators(input({
      collectionFacts: [
        collection({ currency: "LBP", amount: 500_000 }),
        collection({ currency: "LBP", amount: 500_000 }),
        collection({ currency: "LBP", period: "previous_30d", amount: 250_000 }),
        collection({ currency: "LBP", period: "previous_30d", amount: 250_000 })
      ],
      outstandingFacts: [outstanding({ currency: "LBP", currentAmount: 700_000, olderAmount: 1_000_000 })]
    }));

    expect(result.currencyIndicators).toEqual([
      expect.objectContaining({
        currency: "LBP",
        outstandingGrowth: -300_000,
        velocity: expect.objectContaining({ currentAmount: 1_000_000, previousAmount: 500_000, direction: "up" })
      })
    ]);
    expect(result.currencyIndicators[0]).not.toHaveProperty("totalUsd");
  });
  it("keeps USD, LBP, and valid non-base currencies in independent deterministic summaries", () => {
    const factualInput = input({
      collectionFacts: [collection({ currency: "USD", amount: 10 }), collection({ currency: "LBP", amount: 500_000 }), collection({ currency: "AED", amount: 50 })],
      outstandingFacts: [outstanding({ currency: "USD", currentAmount: 60, olderAmount: 20 }), outstanding({ currency: "LBP", currentAmount: 1_000_000, olderAmount: 400_000 })]
    });
    const first = deriveMomentumCurrencyIndicators(factualInput);
    const second = deriveMomentumCurrencyIndicators({
      ...factualInput,
      collectionFacts: [...factualInput.collectionFacts].reverse(),
      outstandingFacts: [...factualInput.outstandingFacts].reverse()
    });

    expect(first.currencyIndicators.map((indicator) => indicator.currency)).toEqual(["AED", "LBP", "USD"]);
    expect(first.currencyIndicators.find((indicator) => indicator.currency === "USD")?.outstandingGrowth).toBe(40);
    expect(first.currencyIndicators.find((indicator) => indicator.currency === "LBP")?.outstandingGrowth).toBe(600_000);
    expect(first).toEqual(second);
  });

  it("excludes malformed currencies, periods, and non-finite monetary values", () => {
    const result = deriveMomentumCurrencyIndicators(input({
      collectionFacts: [
        collection({ currency: "US" }),
        collection({ period: "other" }),
        collection({ currency: "EUR", amount: Number.POSITIVE_INFINITY }),
        collection({ currency: "EUR", amount: 7 })
      ],
      outstandingFacts: [
        outstanding({ currency: "US" }),
        outstanding({ currency: "EUR", currentAmount: Number.NaN }),
        outstanding({ currency: "EUR", currentAmount: 5, olderAmount: 2 })
      ]
    }));

    expect(result.currencyIndicators).toEqual([
      {
        currency: "EUR",
        velocity: { currentAmount: 7, previousAmount: 0, percentageChange: null, direction: "unavailable" },
        outstandingGrowth: 3
      }
    ]);
  });

  it("preserves the active 30-day velocity thresholds per currency", () => {
    const up = deriveMomentumCurrencyIndicators(input({
      collectionFacts: [
        collection({ amount: 11.5 }), collection({ amount: 11.5 }),
        collection({ period: "previous_30d", amount: 10 }), collection({ period: "previous_30d", amount: 10 })
      ]
    })).currencyIndicators[0].velocity;
    const down = deriveMomentumCurrencyIndicators(input({
      collectionFacts: [
        collection({ amount: 8 }), collection({ amount: 8 }),
        collection({ period: "previous_30d", amount: 10 }), collection({ period: "previous_30d", amount: 10 })
      ]
    })).currencyIndicators[0].velocity;
    const flat = deriveMomentumCurrencyIndicators(input({
      collectionFacts: [
        collection({ amount: 10 }), collection({ amount: 10 }),
        collection({ period: "previous_30d", amount: 10 }), collection({ period: "previous_30d", amount: 10 })
      ]
    })).currencyIndicators[0].velocity;

    expect(up).toMatchObject({ currentAmount: 23, previousAmount: 20, percentageChange: 0.15, direction: "up" });
    expect(down).toMatchObject({ currentAmount: 16, previousAmount: 20, percentageChange: -0.2, direction: "down" });
    const boundary = deriveMomentumCurrencyIndicators(input({
      collectionFacts: [
        collection({ amount: 11 }), collection({ amount: 11 }),
        collection({ period: "previous_30d", amount: 10 }), collection({ period: "previous_30d", amount: 10 })
      ]
    })).currencyIndicators[0].velocity;

    expect(flat).toMatchObject({ currentAmount: 20, previousAmount: 20, percentageChange: 0, direction: "flat" });
    expect(boundary).toMatchObject({ currentAmount: 22, previousAmount: 20, percentageChange: 0.1, direction: "flat" });
  });

  it("uses unavailable below the four-proof evidence threshold and handles a zero previous period without Infinity", () => {
    const unavailable = deriveMomentumCurrencyIndicators(input({ collectionFacts: [collection(), collection()] })).currencyIndicators[0].velocity;
    const zeroPrevious = deriveMomentumCurrencyIndicators(input({
      collectionFacts: [collection({ amount: 10 }), collection({ amount: 10 }), collection({ amount: 0, period: "previous_30d" }), collection({ amount: 0, period: "previous_30d" })]
    })).currencyIndicators[0].velocity;

    expect(unavailable).toMatchObject({ direction: "unavailable", percentageChange: null });
    expect(zeroPrevious).toMatchObject({ currentAmount: 20, previousAmount: 0, percentageChange: null, direction: "up" });
    expect(Number.isFinite(zeroPrevious.currentAmount)).toBe(true);
    expect(Number.isFinite(zeroPrevious.previousAmount)).toBe(true);
  });

  it("includes only caller-authorised canonical outstanding facts, preserving partial remaining balances", () => {
    const result = deriveMomentumCurrencyIndicators(input({
      outstandingFacts: [
        outstanding({ currency: "USD", currentAmount: 60, olderAmount: 100, eligibleForOutstanding: true }),
        outstanding({ currency: "USD", currentAmount: 0, olderAmount: 0, eligibleForOutstanding: false }),
        outstanding({ currency: "USD", currentAmount: 500, olderAmount: 500, eligibleForOutstanding: false }),
        outstanding({ currency: "LBP", currentAmount: 750_000, olderAmount: 1_000_000, eligibleForOutstanding: true })
      ]
    }));

    expect(result.currencyIndicators.find((indicator) => indicator.currency === "USD")?.outstandingGrowth).toBe(-40);
    expect(result.currencyIndicators.find((indicator) => indicator.currency === "LBP")?.outstandingGrowth).toBe(-250_000);
    expect(result.currencyIndicators.map((indicator) => indicator.outstandingGrowth)).not.toContain(500);
  });

  it("retains shared count-based metrics without creating a mixed-currency monetary ratio", () => {
    const result = deriveMomentumCurrencyIndicators(input({
      shared: { overdueCountNow: 4.8, overdueCountPriorMonth: 1, repeatClientRate: 0.25 }
    }));

    expect(result.currencyIndicators).toEqual([]);
    expect(result.shared).toEqual({ overdueCountNow: 4, overdueCountPriorMonth: 1, repeatClientRate: 0.25 });
    expect("velocityRatio" in result.shared).toBe(false);
  });
});