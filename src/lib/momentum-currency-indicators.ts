import { groupAmountsByCurrency } from "@/lib/currency-totals";

export type MomentumVelocityPeriod = "current_30d" | "previous_30d";

/**
 * One already-authorized accepted-proof amount in the active 30-day velocity
 * windows. Each item represents one proof so the legacy four-proof threshold
 * can be applied without a mixed-currency count.
 */
export type MomentumCollectionCurrencyFact = {
  currency: string;
  period: string;
  amount: number;
};

/**
 * An already-authorized invoice balance fact. Eligibility is decided by the
 * caller with the canonical outstanding-invoice predicates; this pure adapter
 * never reimplements invoice status or payment-balance rules.
 */
export type MomentumOutstandingCurrencyFact = {
  currency: string;
  currentAmount: number;
  olderAmount: number;
  eligibleForOutstanding: boolean;
};

/** Currency-independent counts and a count-derived client rate from active momentum. */
export type MomentumSharedFacts = {
  overdueCountNow: number;
  overdueCountPriorMonth: number;
  repeatClientRate: number | null;
};

export type MomentumCurrencyVelocity = {
  currentAmount: number;
  previousAmount: number;
  percentageChange: number | null;
  direction: "up" | "down" | "flat" | "unavailable";
};

export type MomentumCurrencyIndicators = {
  currency: string;
  velocity: MomentumCurrencyVelocity;
  /** Current eligible outstanding balance minus the eligible older-open balance. */
  outstandingGrowth: number;
};

export type MomentumSharedIndicators = {
  overdueCountNow: number;
  overdueCountPriorMonth: number;
  repeatClientRate: number | null;
};

export type MomentumCurrencyIndicatorResult = {
  currencyIndicators: MomentumCurrencyIndicators[];
  shared: MomentumSharedIndicators;
};

export type MomentumCurrencyIndicatorInput = {
  collectionFacts: readonly MomentumCollectionCurrencyFact[];
  outstandingFacts: readonly MomentumOutstandingCurrencyFact[];
  shared: MomentumSharedFacts;
};

type ValidCollectionFact = {
  currency: string;
  period: MomentumVelocityPeriod;
  amount: number;
};

type ValidOutstandingFact = {
  currency: string;
  currentAmount: number;
  olderAmount: number;
};

const MINIMUM_PROOF_COUNT = 4;

function normaliseCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return groupAmountsByCurrency([{ currency: value, amount: 0 }])[0]?.currency || null;
}

function isFiniteAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVelocityPeriod(value: unknown): value is MomentumVelocityPeriod {
  return value === "current_30d" || value === "previous_30d";
}

function sumCurrencyAmounts(currency: string, amounts: readonly number[]) {
  return groupAmountsByCurrency(amounts.map((amount) => ({ currency, amount })))[0]?.amount || 0;
}

function sharedCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function sharedRate(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function deriveVelocity(currency: string, facts: readonly ValidCollectionFact[]): MomentumCurrencyVelocity {
  const currentFacts = facts.filter((fact) => fact.period === "current_30d");
  const previousFacts = facts.filter((fact) => fact.period === "previous_30d");
  const currentAmount = sumCurrencyAmounts(currency, currentFacts.map((fact) => fact.amount));
  const previousAmount = sumCurrencyAmounts(currency, previousFacts.map((fact) => fact.amount));

  // Matches the active momentum evidence threshold, now applied within one currency.
  if (currentFacts.length + previousFacts.length < MINIMUM_PROOF_COUNT) {
    return { currentAmount, previousAmount, percentageChange: null, direction: "unavailable" };
  }

  const percentageChange = previousAmount === 0 ? null : (currentAmount - previousAmount) / previousAmount;
  const direction =
    currentAmount > previousAmount * 1.1
      ? "up"
      : currentAmount < previousAmount * 0.9 && previousAmount > 0
        ? "down"
        : "flat";

  return { currentAmount, previousAmount, percentageChange, direction };
}

/**
 * Re-expresses the active momentum money calculations as deterministic,
 * per-currency summaries. It performs no database access, conversion, or
 * invoice/payment eligibility calculation.
 */
export function deriveMomentumCurrencyIndicators(
  input: MomentumCurrencyIndicatorInput
): MomentumCurrencyIndicatorResult {
  const collectionFacts: ValidCollectionFact[] = input.collectionFacts.flatMap((fact) => {
    const currency = normaliseCurrency(fact.currency);
    if (!currency || !isVelocityPeriod(fact.period) || !isFiniteAmount(fact.amount)) return [];
    return [{ currency, period: fact.period, amount: fact.amount }];
  });
  const outstandingFacts: ValidOutstandingFact[] = input.outstandingFacts.flatMap((fact) => {
    const currency = normaliseCurrency(fact.currency);
    if (
      !currency ||
      fact.eligibleForOutstanding !== true ||
      !isFiniteAmount(fact.currentAmount) ||
      !isFiniteAmount(fact.olderAmount)
    ) {
      return [];
    }
    return [{ currency, currentAmount: fact.currentAmount, olderAmount: fact.olderAmount }];
  });
  const currencies = groupAmountsByCurrency([
    ...collectionFacts.map((fact) => ({ currency: fact.currency, amount: 0 })),
    ...outstandingFacts.map((fact) => ({ currency: fact.currency, amount: 0 }))
  ]).map((total) => total.currency);

  return {
    currencyIndicators: currencies.map((currency) => {
      const currencyCollections = collectionFacts.filter((fact) => fact.currency === currency);
      const currencyOutstanding = outstandingFacts.filter((fact) => fact.currency === currency);
      const currentOutstanding = sumCurrencyAmounts(currency, currencyOutstanding.map((fact) => fact.currentAmount));
      const olderOutstanding = sumCurrencyAmounts(currency, currencyOutstanding.map((fact) => fact.olderAmount));

      return {
        currency,
        velocity: deriveVelocity(currency, currencyCollections),
        outstandingGrowth: currentOutstanding - olderOutstanding
      };
    }),
    shared: {
      overdueCountNow: sharedCount(input.shared.overdueCountNow),
      overdueCountPriorMonth: sharedCount(input.shared.overdueCountPriorMonth),
      repeatClientRate: input.shared.repeatClientRate === null ? null : sharedRate(input.shared.repeatClientRate)
    }
  };
}