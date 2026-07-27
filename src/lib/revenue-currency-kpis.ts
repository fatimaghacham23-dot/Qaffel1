import { groupAmountsByCurrency } from "@/lib/currency-totals";

/**
 * Already-authorized and workspace-scoped monthly facts. They retain the source
 * currency and deliberately contain no conversion, exchange-rate, or database fields.
 */
export type MonthlyRevenueCurrencyValue = {
  month: string;
  currency: string;
  collected: number;
  billed: number;
};

/**
 * The caller applies the existing invoice eligibility predicate before setting
 * eligibleForAverage. This adapter intentionally does not duplicate invoice-state rules.
 */
export type InvoiceCurrencyFact = {
  currency: string;
  amount: number;
  eligibleForAverage: boolean;
};

/**
 * All-time factual inputs for the legacy collected/billed ratio. The values are
 * already filtered using the source's established invoice and payment rules.
 */
export type CollectedBilledCurrencyFact = {
  currency: string;
  collected: number;
  billed: number;
};

export type RevenueCurrencyKpiTrend = {
  /** Average collected amount for the most recent three reporting months. */
  currentAmount: number;
  /** Average collected amount for the preceding three reporting months. */
  previousAmount: number;
  /** Decimal change, or null when the previous comparison amount is zero. */
  percentageChange: number | null;
  direction: "up" | "down" | "flat" | "unavailable";
};

export type RevenueCurrencyKpiSummary = {
  currency: string;
  bestEarningMonth: { month: string; amount: number } | null;
  averageInvoice: number | null;
  revenueTrend: RevenueCurrencyKpiTrend;
  /** A decimal 0–1-style ratio, matching the active legacy KPI contract. */
  collectedToBilledRatio: number | null;
};

export type RevenueCurrencyKpiInput = {
  /** The explicit continuous reporting period used by best month and trend. */
  reportingMonths: readonly string[];
  monthlyValues: readonly MonthlyRevenueCurrencyValue[];
  invoiceFacts: readonly InvoiceCurrencyFact[];
  collectedBilledFacts: readonly CollectedBilledCurrencyFact[];
};

type ValidMonthlyValue = {
  month: string;
  currency: string;
  collected: number;
  billed: number;
};

type ValidInvoiceFact = {
  currency: string;
  amount: number;
};

type ValidCollectedBilledFact = {
  currency: string;
  collected: number;
  billed: number;
};

const TREND_INVOICE_MINIMUM = 6;

function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function monthOrder(a: string, b: string) {
  return a.localeCompare(b);
}

function normaliseCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return groupAmountsByCurrency([{ currency: value, amount: 0 }])[0]?.currency || null;
}

function isFiniteAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sumCurrencyAmounts(currency: string, amounts: readonly number[]) {
  return (
    groupAmountsByCurrency(amounts.map((amount) => ({ currency, amount })))[0]?.amount || 0
  );
}

function unavailableTrend(): RevenueCurrencyKpiTrend {
  return {
    currentAmount: 0,
    previousAmount: 0,
    percentageChange: null,
    direction: "unavailable"
  };
}

function validReportingMonths(months: readonly string[]) {
  return [...new Set(months.filter(isMonth))].sort(monthOrder);
}

function findBestMonth(currency: string, months: readonly string[], values: readonly ValidMonthlyValue[]) {
  let best: { month: string; amount: number } | null = null;
  let bestAmount = 0;

  for (const month of months) {
    const collected = sumCurrencyAmounts(
      currency,
      values.filter((value) => value.month === month).map((value) => value.collected)
    );
    // Strictly greater preserves the first chronological month when amounts tie.
    if (collected > bestAmount) {
      best = { month, amount: collected };
      bestAmount = collected;
    }
  }

  return best;
}

function deriveTrend(
  currency: string,
  reportingMonths: readonly string[],
  monthlyValues: readonly ValidMonthlyValue[],
  eligibleInvoiceCount: number
): RevenueCurrencyKpiTrend {
  // The active legacy field is unavailable until there are at least six billable invoices.
  if (reportingMonths.length < 6 || eligibleInvoiceCount < TREND_INVOICE_MINIMUM) return unavailableTrend();

  const currentMonths = reportingMonths.slice(-3);
  const previousMonths = reportingMonths.slice(-6, -3);
  const averageCollected = (months: readonly string[]) =>
    sumCurrencyAmounts(
      currency,
      months.flatMap((month) => monthlyValues.filter((value) => value.month === month).map((value) => value.collected))
    ) / months.length;
  const currentAmount = averageCollected(currentMonths);
  const previousAmount = averageCollected(previousMonths);
  const percentageChange = previousAmount === 0 ? null : (currentAmount - previousAmount) / previousAmount;
  const direction =
    currentAmount > previousAmount * 1.08
      ? "up"
      : currentAmount < previousAmount * 0.92
        ? "down"
        : "flat";

  return { currentAmount, previousAmount, percentageChange, direction };
}

/**
 * Re-expresses the active legacy approximate KPI formulas as independent,
 * currency-safe summaries. It performs no authorization, eligibility filtering,
 * database access, or conversion; callers provide factual source amounts only.
 */
export function deriveRevenueCurrencyKpis(input: RevenueCurrencyKpiInput): RevenueCurrencyKpiSummary[] {
  const reportingMonths = validReportingMonths(input.reportingMonths);
  const reportingMonthSet = new Set(reportingMonths);
  const monthlyValues: ValidMonthlyValue[] = input.monthlyValues.flatMap((value) => {
    const currency = normaliseCurrency(value.currency);
    if (
      !currency ||
      !isMonth(value.month) ||
      !reportingMonthSet.has(value.month) ||
      !isFiniteAmount(value.collected) ||
      !isFiniteAmount(value.billed)
    ) {
      return [];
    }
    return [{ month: value.month, currency, collected: value.collected, billed: value.billed }];
  });
  const invoiceFacts: ValidInvoiceFact[] = input.invoiceFacts.flatMap((fact) => {
    const currency = normaliseCurrency(fact.currency);
    if (!currency || fact.eligibleForAverage !== true || !isFiniteAmount(fact.amount)) return [];
    return [{ currency, amount: fact.amount }];
  });
  const collectedBilledFacts: ValidCollectedBilledFact[] = input.collectedBilledFacts.flatMap((fact) => {
    const currency = normaliseCurrency(fact.currency);
    if (!currency || !isFiniteAmount(fact.collected) || !isFiniteAmount(fact.billed)) return [];
    return [{ currency, collected: fact.collected, billed: fact.billed }];
  });
  const currencies = groupAmountsByCurrency([
    ...monthlyValues.map((value) => ({ currency: value.currency, amount: 0 })),
    ...invoiceFacts.map((fact) => ({ currency: fact.currency, amount: 0 })),
    ...collectedBilledFacts.map((fact) => ({ currency: fact.currency, amount: 0 }))
  ]).map((total) => total.currency);

  return currencies.map((currency) => {
    const currencyMonthlyValues = monthlyValues.filter((value) => value.currency === currency);
    const currencyInvoices = invoiceFacts.filter((fact) => fact.currency === currency && fact.amount > 0);
    const currencyRatioFacts = collectedBilledFacts.filter((fact) => fact.currency === currency);
    const averageInvoice =
      currencyInvoices.length > 0
        ? sumCurrencyAmounts(currency, currencyInvoices.map((fact) => fact.amount)) / currencyInvoices.length
        : null;
    const billed = sumCurrencyAmounts(currency, currencyRatioFacts.map((fact) => fact.billed));
    const collected = sumCurrencyAmounts(currency, currencyRatioFacts.map((fact) => fact.collected));

    return {
      currency,
      bestEarningMonth: findBestMonth(currency, reportingMonths, currencyMonthlyValues),
      averageInvoice,
      revenueTrend: deriveTrend(currency, reportingMonths, currencyMonthlyValues, currencyInvoices.length),
      collectedToBilledRatio: billed > 0 ? collected / billed : null
    };
  });
}
