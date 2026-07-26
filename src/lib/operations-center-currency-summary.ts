import { groupAmountsByCurrency } from "@/lib/currency-totals";

/**
 * Already-authorised operational facts. Every amount retains its source
 * currency; no value is a converted or USD-equivalent amount.
 */
export type OperationsCenterCurrencyFact = {
  currency: string;
  billed: number;
  openBalance: number;
  expectedIncomingWeek: number;
  overdueRecoverable: number;
  unpaidDeposits: number;
  workspaceMatched: boolean;
  eligibleForBalanceHealth: boolean;
  eligibleForExpectedIncoming: boolean;
  eligibleForOverdueRecoverable: boolean;
  eligibleForUnpaidDeposits: boolean;
};

/** The current client-risk card has a USD-only $5,000 high-open threshold. */
export type OperationsCenterClientOpenBalanceFact = {
  clientId: string;
  currency: string;
  openAmount: number;
  workspaceMatched: boolean;
  eligibleForClientRisk: boolean;
};

export type OperationsCenterSharedFacts = {
  acceptedLast7: number;
  acceptedPrevious7: number;
};

export type OperationsCenterCurrencySummary = {
  currency: string;
  billed: number;
  openBalance: number;
  expectedIncomingWeek: number;
  overdueRecoverable: number;
  unpaidDeposits: number;
  /** Null is explicit when the current balance-health denominator is not positive. */
  balanceRatio: number | null;
  /** Preserves the active 20-point balance-health formula per currency. */
  balancePoints: number;
};

export type OperationsCenterClientCurrencySummary = {
  clientId: string;
  currency: string;
  openAmount: number;
  /** Null means the active Operations Center has no threshold for that currency. */
  highOpenBalance: boolean | null;
};

export type OperationsCenterSharedSummary = {
  acceptedLast7: number;
  acceptedPrevious7: number;
  velocityLabel: string;
  velocityDetail: string | null;
};

export type OperationsCenterCurrencySummaryResult = {
  currencySummaries: OperationsCenterCurrencySummary[];
  clientCurrencySummaries: OperationsCenterClientCurrencySummary[];
  shared: OperationsCenterSharedSummary;
};

export type OperationsCenterCurrencySummaryInput = {
  currencyFacts: readonly OperationsCenterCurrencyFact[];
  clientOpenBalanceFacts: readonly OperationsCenterClientOpenBalanceFact[];
  shared: OperationsCenterSharedFacts;
};

const currencyPattern = /^[A-Z]{3}$/;

function normaliseCurrency(value: string): string | null {
  const currency = value.trim().toUpperCase();
  return currencyPattern.test(currency) ? currency : null;
}

function normaliseCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function amountTotals(entries: ReadonlyArray<{ currency: string; amount: number }>): Map<string, number> {
  return new Map(groupAmountsByCurrency(entries).map((total) => [total.currency, total.amount]));
}

function velocitySummary(acceptedLast7: number, acceptedPrevious7: number): Pick<OperationsCenterSharedSummary, "velocityLabel" | "velocityDetail"> {
  if (acceptedLast7 + acceptedPrevious7 < 3) return { velocityLabel: "Payment velocity", velocityDetail: null };
  if (acceptedLast7 > acceptedPrevious7) {
    return {
      velocityLabel: "Accelerating confirmations",
      velocityDetail: `${acceptedLast7} accepted in the last 7 days vs ${acceptedPrevious7} in the prior 7 days.`
    };
  }
  if (acceptedLast7 < acceptedPrevious7) {
    return {
      velocityLabel: "Slower confirmations",
      velocityDetail: `${acceptedLast7} accepted in the last 7 days vs ${acceptedPrevious7} in the prior 7 days.`
    };
  }
  return {
    velocityLabel: "Steady confirmation pace",
    velocityDetail: `${acceptedLast7} accepted payments in each of the last two 7-day windows.`
  };
}

/**
 * Pure successor for the Operations Center's converted cash-flow and
 * USD-only balance health inputs. Eligibility is resolved by the future
 * authorised factual builder using existing collection and proof predicates.
 */
export function deriveOperationsCenterCurrencySummary(
  input: OperationsCenterCurrencySummaryInput
): OperationsCenterCurrencySummaryResult {
  const validFacts = input.currencyFacts.flatMap((fact) => {
    const currency = normaliseCurrency(fact.currency);
    if (!currency || !fact.workspaceMatched || ![fact.billed, fact.openBalance, fact.expectedIncomingWeek, fact.overdueRecoverable, fact.unpaidDeposits].every(Number.isFinite)) return [];
    return [{ ...fact, currency }];
  });
  const orderedCurrencies = [...amountTotals(validFacts.map((fact) => ({ currency: fact.currency, amount: 0 }))).keys()];
  const billed = amountTotals(validFacts.filter((fact) => fact.eligibleForBalanceHealth).map((fact) => ({ currency: fact.currency, amount: fact.billed })));
  const openBalance = amountTotals(validFacts.filter((fact) => fact.eligibleForBalanceHealth).map((fact) => ({ currency: fact.currency, amount: fact.openBalance })));
  const expectedIncomingWeek = amountTotals(validFacts.filter((fact) => fact.eligibleForExpectedIncoming).map((fact) => ({ currency: fact.currency, amount: fact.expectedIncomingWeek })));
  const overdueRecoverable = amountTotals(validFacts.filter((fact) => fact.eligibleForOverdueRecoverable).map((fact) => ({ currency: fact.currency, amount: fact.overdueRecoverable })));
  const unpaidDeposits = amountTotals(validFacts.filter((fact) => fact.eligibleForUnpaidDeposits).map((fact) => ({ currency: fact.currency, amount: fact.unpaidDeposits })));

  const currencySummaries = orderedCurrencies.map((currency) => {
    const billedAmount = billed.get(currency) || 0;
    const openAmount = openBalance.get(currency) || 0;
    const balanceRatio = billedAmount > 0 ? openAmount / billedAmount : null;
    const balancePoints = Math.round(20 * (1 - Math.min(1, balanceRatio === null ? 0 : balanceRatio)));
    return {
      currency,
      billed: billedAmount,
      openBalance: openAmount,
      expectedIncomingWeek: expectedIncomingWeek.get(currency) || 0,
      overdueRecoverable: overdueRecoverable.get(currency) || 0,
      unpaidDeposits: unpaidDeposits.get(currency) || 0,
      balanceRatio: Number.isFinite(balanceRatio) ? balanceRatio : null,
      balancePoints
    };
  });

  const clientTotals = new Map<string, Array<{ currency: string; amount: number }>>();
  for (const fact of input.clientOpenBalanceFacts) {
    const currency = normaliseCurrency(fact.currency);
    if (!currency || !fact.clientId || !fact.workspaceMatched || !fact.eligibleForClientRisk || !Number.isFinite(fact.openAmount)) continue;
    const entries = clientTotals.get(fact.clientId) || [];
    entries.push({ currency, amount: fact.openAmount });
    clientTotals.set(fact.clientId, entries);
  }
  const clientCurrencySummaries = [...clientTotals.entries()]
    .flatMap(([clientId, entries]) => [...amountTotals(entries).entries()].map(([currency, openAmount]) => ({
      clientId,
      currency,
      openAmount,
      highOpenBalance: currency === "USD" ? openAmount >= 5_000 : null
    })))
    .sort((left, right) => left.clientId.localeCompare(right.clientId) || left.currency.localeCompare(right.currency));

  const acceptedLast7 = normaliseCount(input.shared.acceptedLast7);
  const acceptedPrevious7 = normaliseCount(input.shared.acceptedPrevious7);
  return {
    currencySummaries,
    clientCurrencySummaries,
    shared: { acceptedLast7, acceptedPrevious7, ...velocitySummary(acceptedLast7, acceptedPrevious7) }
  };
}