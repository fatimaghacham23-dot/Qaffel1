import { describe, expect, it } from "vitest";
import {
  deriveOperationsCenterCurrencySummary,
  type OperationsCenterClientOpenBalanceFact,
  type OperationsCenterCurrencyFact,
  type OperationsCenterCurrencySummaryInput
} from "@/lib/operations-center-currency-summary";

function input(overrides: Partial<OperationsCenterCurrencySummaryInput> = {}): OperationsCenterCurrencySummaryInput {
  return {
    currencyFacts: [],
    clientOpenBalanceFacts: [],
    shared: { acceptedLast7: 0, acceptedPrevious7: 0 },
    ...overrides
  };
}

function currencyFact(overrides: Partial<OperationsCenterCurrencyFact> = {}): OperationsCenterCurrencyFact {
  return {
    currency: "USD",
    billed: 100,
    openBalance: 40,
    expectedIncomingWeek: 25,
    overdueRecoverable: 15,
    unpaidDeposits: 10,
    workspaceMatched: true,
    eligibleForBalanceHealth: true,
    eligibleForExpectedIncoming: true,
    eligibleForOverdueRecoverable: true,
    eligibleForUnpaidDeposits: true,
    ...overrides
  };
}

function clientFact(overrides: Partial<OperationsCenterClientOpenBalanceFact> = {}): OperationsCenterClientOpenBalanceFact {
  return { clientId: "client-a", currency: "USD", openAmount: 0, workspaceMatched: true, eligibleForClientRisk: true, ...overrides };
}

describe("currency-safe Operations Center summary contract", () => {
  it("creates a USD-only operational monetary summary and preserves current balance-health math", () => {
    const result = deriveOperationsCenterCurrencySummary(input({
      currencyFacts: [currencyFact()],
      clientOpenBalanceFacts: [clientFact({ openAmount: 5_000 })],
      shared: { acceptedLast7: 2, acceptedPrevious7: 1 }
    }));

    expect(result.currencySummaries).toEqual([
      {
        currency: "USD",
        billed: 100,
        openBalance: 40,
        expectedIncomingWeek: 25,
        overdueRecoverable: 15,
        unpaidDeposits: 10,
        balanceRatio: 0.4,
        balancePoints: 12
      }
    ]);
    expect(result.clientCurrencySummaries).toEqual([{ clientId: "client-a", currency: "USD", openAmount: 5_000, highOpenBalance: true }]);
    expect(result.shared).toEqual({
      acceptedLast7: 2,
      acceptedPrevious7: 1,
      velocityLabel: "Accelerating confirmations",
      velocityDetail: "2 accepted in the last 7 days vs 1 in the prior 7 days."
    });
  });

  it("creates an LBP-only summary without fabricating USD or converting deposits", () => {
    const result = deriveOperationsCenterCurrencySummary(input({
      currencyFacts: [currencyFact({ currency: "LBP", billed: 10_000_000, openBalance: 2_500_000, expectedIncomingWeek: 1_000_000, overdueRecoverable: 750_000, unpaidDeposits: 500_000 })],
      clientOpenBalanceFacts: [clientFact({ currency: "LBP", openAmount: 8_000_000 })]
    }));

    expect(result.currencySummaries).toEqual([expect.objectContaining({ currency: "LBP", billed: 10_000_000, unpaidDeposits: 500_000, balanceRatio: 0.25, balancePoints: 15 })]);
    expect(result.clientCurrencySummaries).toEqual([{ clientId: "client-a", currency: "LBP", openAmount: 8_000_000, highOpenBalance: null }]);
  });

  it("keeps USD and LBP facts independent, aggregates duplicates safely, and orders currencies deterministically", () => {
    const factualInput = input({
      currencyFacts: [
        currencyFact({ currency: "USD", billed: 100, openBalance: 25, expectedIncomingWeek: 10, overdueRecoverable: 5, unpaidDeposits: 0 }),
        currencyFact({ currency: "LBP", billed: 1_000_000, openBalance: 600_000, expectedIncomingWeek: 300_000, overdueRecoverable: 200_000, unpaidDeposits: 50_000 }),
        currencyFact({ currency: "USD", billed: 50, openBalance: 25, expectedIncomingWeek: 10, overdueRecoverable: 5, unpaidDeposits: 0 })
      ]
    });
    const first = deriveOperationsCenterCurrencySummary(factualInput);
    const second = deriveOperationsCenterCurrencySummary({ ...factualInput, currencyFacts: [...factualInput.currencyFacts].reverse() });

    expect(first).toEqual(second);
    expect(first.currencySummaries).toEqual([
      expect.objectContaining({ currency: "LBP", billed: 1_000_000, openBalance: 600_000, overdueRecoverable: 200_000 }),
      expect.objectContaining({ currency: "USD", billed: 150, openBalance: 50, expectedIncomingWeek: 20 })
    ]);
    expect(first.currencySummaries).not.toContainEqual(expect.objectContaining({ currency: "USD", billed: 1_000_000 }));
  });

  it("uses caller-provided canonical eligibility for partial, paid, quote, cancelled, voided, and workspace-bound records", () => {
    const result = deriveOperationsCenterCurrencySummary(input({
      currencyFacts: [
        currencyFact({ billed: 100, openBalance: 60, expectedIncomingWeek: 0, overdueRecoverable: 60, unpaidDeposits: 0 }),
        currencyFact({ billed: 100, openBalance: 0, expectedIncomingWeek: 0, overdueRecoverable: 0, unpaidDeposits: 0 }),
        currencyFact({ billed: 900, openBalance: 900, expectedIncomingWeek: 900, overdueRecoverable: 900, unpaidDeposits: 0, eligibleForBalanceHealth: false, eligibleForExpectedIncoming: false, eligibleForOverdueRecoverable: false, eligibleForUnpaidDeposits: false }),
        currencyFact({ billed: 500, openBalance: 500, expectedIncomingWeek: 500, overdueRecoverable: 500, unpaidDeposits: 0, workspaceMatched: false }),
        currencyFact({ billed: Number.POSITIVE_INFINITY }),
        currencyFact({ currency: "US", billed: 700, openBalance: 700, expectedIncomingWeek: 700, overdueRecoverable: 700, unpaidDeposits: 0 })
      ],
      clientOpenBalanceFacts: [
        clientFact({ clientId: "foreign", openAmount: 9_000, workspaceMatched: false }),
        clientFact({ clientId: "legacy", openAmount: 9_000, workspaceMatched: false }),
        clientFact({ clientId: "eligible", openAmount: 4_999 })
      ]
    }));

    expect(result.currencySummaries).toEqual([expect.objectContaining({ currency: "USD", billed: 200, openBalance: 60, overdueRecoverable: 60 })]);
    expect(result.clientCurrencySummaries).toEqual([{ clientId: "eligible", currency: "USD", openAmount: 4_999, highOpenBalance: false }]);
  });

  it("returns explicit unavailable balance ratios for zero billed while preserving the legacy 20-point zero-balance behavior", () => {
    const result = deriveOperationsCenterCurrencySummary(input({
      currencyFacts: [currencyFact({ currency: "AED", billed: 0, openBalance: 0, expectedIncomingWeek: 0, overdueRecoverable: 0, unpaidDeposits: 0 })]
    }));

    expect(result.currencySummaries).toEqual([expect.objectContaining({ currency: "AED", balanceRatio: null, balancePoints: 20 })]);
    expect(result.currencySummaries.every((summary) => summary.balanceRatio === null || Number.isFinite(summary.balanceRatio))).toBe(true);
  });

  it("keeps shared count and velocity fields outside currency summaries with the active thresholds", () => {
    const unavailable = deriveOperationsCenterCurrencySummary(input({ shared: { acceptedLast7: 1.8, acceptedPrevious7: 1 } }));
    const steady = deriveOperationsCenterCurrencySummary(input({ shared: { acceptedLast7: 2, acceptedPrevious7: 2 } }));
    const slower = deriveOperationsCenterCurrencySummary(input({ shared: { acceptedLast7: 1, acceptedPrevious7: 3 } }));

    expect(unavailable.shared).toEqual({ acceptedLast7: 1, acceptedPrevious7: 1, velocityLabel: "Payment velocity", velocityDetail: null });
    expect(steady.shared.velocityLabel).toBe("Steady confirmation pace");
    expect(slower.shared.velocityLabel).toBe("Slower confirmations");
    expect("currency" in steady.shared).toBe(false);
  });

  it("exposes no approximate, converted, or mixed-currency fields", () => {
    const result = deriveOperationsCenterCurrencySummary(input({
      currencyFacts: [currencyFact(), currencyFact({ currency: "LBP", billed: 1_000_000, openBalance: 0, expectedIncomingWeek: 0, overdueRecoverable: 0, unpaidDeposits: 0 })]
    }));

    for (const summary of result.currencySummaries) {
      expect("totalUsd" in summary).toBe(false);
      expect("convertedAmount" in summary).toBe(false);
      expect("approximateValue" in summary).toBe(false);
      expect(Number.isFinite(summary.billed)).toBe(true);
      expect(Number.isFinite(summary.openBalance)).toBe(true);
    }
  });
});