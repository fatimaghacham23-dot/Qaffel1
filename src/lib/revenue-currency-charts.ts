import { groupAmountsByCurrency } from "@/lib/currency-totals";

export const REVENUE_METRICS = ["collected", "billed", "overdue"] as const;
export type RevenueMetric = (typeof REVENUE_METRICS)[number];

/**
 * Already-authorized, factual revenue values. The adapter intentionally receives
 * no invoice, proof, workspace, exchange-rate, or database fields.
 */
export type MonthlyRevenueCurrencyFact = {
  month: string;
  currency: string;
  metric: RevenueMetric;
  amount: number;
};

export type RevenueCurrencyChartSeries = {
  key: string;
  metric: RevenueMetric;
  currency: string;
};

export type RevenueCurrencyChartRow = {
  month: string;
  values: Record<string, number>;
};

export type RevenueCurrencyChart = {
  currency: string;
  rows: RevenueCurrencyChartRow[];
  series: RevenueCurrencyChartSeries[];
};

export type RevenueCurrencyChartOptions = {
  /**
   * An explicit continuous reporting period. When omitted, only factual months
   * are returned. The active chart's later migration can pass its 12-month period.
   */
  reportingMonths?: readonly string[];
};

function isMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function monthOrder(a: string, b: string) {
  const [aYear, aMonth] = a.split("-").map(Number);
  const [bYear, bMonth] = b.split("-").map(Number);
  return aYear === bYear ? aMonth - bMonth : aYear - bYear;
}

function isRevenueMetric(metric: string): metric is RevenueMetric {
  return REVENUE_METRICS.some((candidate) => candidate === metric);
}

/**
 * Builds independent per-currency chart contracts without conversion. Eligible
 * facts must be filtered by the caller using the revenue source's canonical
 * workspace and payment/invoice predicates before reaching this pure adapter.
 */
export function deriveRevenueCurrencyCharts(
  facts: readonly MonthlyRevenueCurrencyFact[],
  options: RevenueCurrencyChartOptions = {}
): RevenueCurrencyChart[] {
  const validFacts = facts.filter(
    (fact) => isMonth(fact.month) && isRevenueMetric(fact.metric) && Number.isFinite(fact.amount)
  );
  const currencies = groupAmountsByCurrency(validFacts.map((fact) => ({ currency: fact.currency, amount: 0 }))).map(
    (total) => total.currency
  );
  const currencySet = new Set(currencies);
  const currencyFactsOnly = validFacts.filter((fact) => currencySet.has(fact.currency.trim().toUpperCase()));
  const factualMonths = currencyFactsOnly.map((fact) => fact.month);
  const reportingMonths = (options.reportingMonths || []).filter(isMonth);
  const months = [...new Set([...factualMonths, ...reportingMonths])].sort(monthOrder);

  return currencies.map((currency) => {
    const currencyFacts = currencyFactsOnly.filter((fact) => fact.currency.trim().toUpperCase() === currency);
    const series = REVENUE_METRICS.map((metric) => ({
      key: `${currency}:${metric}`,
      metric,
      currency
    }));
    const rows = months.map((month) => {
      const values: Record<string, number> = {};
      for (const item of series) {
        values[item.key] =
          groupAmountsByCurrency(
            currencyFacts
              .filter((fact) => fact.month === month && fact.metric === item.metric)
              .map((fact) => ({ currency, amount: fact.amount }))
          )[0]?.amount || 0;
      }
      return { month, values };
    });
    return { currency, rows, series };
  });
}
