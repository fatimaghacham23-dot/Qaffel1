import { groupAmountsByCurrency } from "@/lib/currency-totals";

/**
 * Monetary facts are already workspace-scoped and authorised by the caller.
 * `collected` and `overdue` retain their original invoice currency; neither
 * value is converted or assumed to be USD.
 */
export type MonthlyIntelligenceCurrencyFact = {
  month: string;
  currency: string;
  collected: number;
  overdue: number;
};

/** Count facts from the current legacy monthly report. */
export type MonthlySharedIntelligenceFact = {
  month: string;
  invoicesCreated: number;
  newClients: number;
};

/**
 * The legacy report resolves a top payment method by accepted-payment count.
 * `sourceOrder` preserves its first-seen tie behaviour without exposing a
 * database record or identifier.
 */
export type MonthlyIntelligencePaymentMethodFact = {
  month: string;
  method: string;
  sourceOrder: number;
};

export type MonthlyIntelligenceCurrencySummaryInput = {
  /** The caller's established reporting window, such as the legacy last 12 months. */
  reportingMonths: readonly string[];
  currencyFacts: readonly MonthlyIntelligenceCurrencyFact[];
  sharedFacts: readonly MonthlySharedIntelligenceFact[];
  paymentMethodFacts: readonly MonthlyIntelligencePaymentMethodFact[];
};

/** One explicit currency per monetary month; there is intentionally no ratio. */
export type MonthlyCurrencySummary = {
  month: string;
  currency: string;
  collected: number;
  overdue: number;
};

/** Currency-independent fields from the active legacy monthly report. */
export type MonthlySharedSummary = {
  month: string;
  invoicesCreated: number;
  newClients: number;
  topMethod: string | null;
  /** The active report is binary: any overdue monetary balance means one issue. */
  operationalIssues: number;
};

export type MonthlyIntelligenceCurrencySummaryResult = {
  currencySummaries: MonthlyCurrencySummary[];
  sharedSummaries: MonthlySharedSummary[];
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const currencyPattern = /^[A-Z]{3}$/;

function normaliseMonth(value: string): string | null {
  return monthPattern.test(value) ? value : null;
}

function normaliseCurrency(value: string): string | null {
  const currency = value.trim().toUpperCase();
  return currencyPattern.test(currency) ? currency : null;
}

function normaliseCount(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

type MethodAggregate = { count: number; firstSourceOrder: number };

/**
 * Derives a currency-safe successor to the legacy approximate-USD monthly
 * report. The caller retains canonical eligibility decisions (accepted proof,
 * active non-quote invoice, canonical overdue remainder, and date grouping).
 */
export function deriveMonthlyIntelligenceCurrencySummaries(
  input: MonthlyIntelligenceCurrencySummaryInput
): MonthlyIntelligenceCurrencySummaryResult {
  const reportingMonths = [...new Set(input.reportingMonths.map(normaliseMonth).filter((month): month is string => month !== null))]
    .sort((left, right) => left.localeCompare(right));
  const reportingMonthSet = new Set(reportingMonths);
  const factsByMonth = new Map<string, MonthlyIntelligenceCurrencyFact[]>();
  const observedCurrencies = new Set<string>();

  for (const fact of input.currencyFacts) {
    const month = normaliseMonth(fact.month);
    const currency = normaliseCurrency(fact.currency);
    if (!month || !currency || !reportingMonthSet.has(month) || !Number.isFinite(fact.collected) || !Number.isFinite(fact.overdue)) continue;
    const facts = factsByMonth.get(month) || [];
    facts.push({ month, currency, collected: fact.collected, overdue: fact.overdue });
    factsByMonth.set(month, facts);
    observedCurrencies.add(currency);
  }

  const sharedByMonth = new Map<string, { invoicesCreated: number; newClients: number }>();
  for (const fact of input.sharedFacts) {
    const month = normaliseMonth(fact.month);
    const invoicesCreated = normaliseCount(fact.invoicesCreated);
    const newClients = normaliseCount(fact.newClients);
    if (!month || !reportingMonthSet.has(month) || invoicesCreated === null || newClients === null) continue;
    const existing = sharedByMonth.get(month) || { invoicesCreated: 0, newClients: 0 };
    existing.invoicesCreated += invoicesCreated;
    existing.newClients += newClients;
    sharedByMonth.set(month, existing);
  }

  const methodsByMonth = new Map<string, Map<string, MethodAggregate>>();
  for (const fact of input.paymentMethodFacts) {
    const month = normaliseMonth(fact.month);
    const method = fact.method.trim();
    if (!month || !method || !reportingMonthSet.has(month) || !Number.isFinite(fact.sourceOrder) || fact.sourceOrder < 0) continue;
    const methods = methodsByMonth.get(month) || new Map<string, MethodAggregate>();
    const existing = methods.get(method);
    if (existing) {
      existing.count += 1;
      existing.firstSourceOrder = Math.min(existing.firstSourceOrder, fact.sourceOrder);
    } else {
      methods.set(method, { count: 1, firstSourceOrder: fact.sourceOrder });
    }
    methodsByMonth.set(month, methods);
  }

  const currencySummaries: MonthlyCurrencySummary[] = [];
  const overdueByMonth = new Map<string, boolean>();
  for (const month of reportingMonths) {
    const facts = factsByMonth.get(month) || [];
    const collectedByCurrency = new Map(groupAmountsByCurrency(facts.map((fact) => ({ currency: fact.currency, amount: fact.collected }))).map((total) => [total.currency, total.amount]));
    const overdueByCurrency = new Map(groupAmountsByCurrency(facts.map((fact) => ({ currency: fact.currency, amount: fact.overdue }))).map((total) => [total.currency, total.amount]));
    const currencies = [...observedCurrencies].sort((left, right) => left.localeCompare(right));
    for (const currency of currencies) {
      const overdue = overdueByCurrency.get(currency) || 0;
      currencySummaries.push({ month, currency, collected: collectedByCurrency.get(currency) || 0, overdue });
      if (overdue > 0) overdueByMonth.set(month, true);
    }
  }

  const sharedSummaries = reportingMonths.map((month) => {
    const shared = sharedByMonth.get(month) || { invoicesCreated: 0, newClients: 0 };
    const methods = methodsByMonth.get(month) || new Map<string, MethodAggregate>();
    const topMethod = [...methods.entries()]
      .sort(([leftMethod, left], [rightMethod, right]) => right.count - left.count || left.firstSourceOrder - right.firstSourceOrder || leftMethod.localeCompare(rightMethod))[0]?.[0] || null;
    return {
      month,
      invoicesCreated: shared.invoicesCreated,
      newClients: shared.newClients,
      topMethod,
      operationalIssues: overdueByMonth.get(month) ? 1 : 0
    };
  });

  return { currencySummaries, sharedSummaries };
}