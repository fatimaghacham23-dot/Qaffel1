"use client";

import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/area-charts-2";
import { formatCurrencyTotal } from "@/lib/currency-totals";
import type { RevenueCurrencyChart, RevenueMetric } from "@/lib/revenue-currency-charts";

const METRIC_COLORS: Record<RevenueMetric, string> = {
  collected: "#116466",
  billed: "#64748b",
  overdue: "#d95f43"
};

function metricLabel(metric: RevenueMetric) {
  if (metric === "collected") return "Collected";
  if (metric === "billed") return "Billed";
  return "Overdue";
}

export function revenueTooltipLabel(metric: RevenueMetric, currency: string) {
  return `${metricLabel(metric)} · ${currency}`;
}

export function revenueMonthLabel(month: string) {
  const date = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}
export function formatRevenueChartAmount(amount: number, currency: string) {
  return formatCurrencyTotal({ currency, amount });
}

function RevenueCurrencyChartSection({ chart }: { chart: RevenueCurrencyChart }) {
  const headingId = `revenue-trend-${chart.currency.toLowerCase()}`;
  const rows: Array<Record<string, string | number>> = chart.rows.map((row) => ({ month: revenueMonthLabel(row.month), ...row.values }));
  const config: ChartConfig = {};
  chart.series.forEach((series) => {
    config[series.key] = { label: metricLabel(series.metric), color: METRIC_COLORS[series.metric] };
  });
  const hasValues = rows.some((row) => chart.series.some((series) => Number(row[series.key]) > 0));

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5" aria-labelledby={headingId}>
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cedar">Revenue trajectory</p>
        <h3 id={headingId} className="mt-1 text-base font-bold text-ink">Revenue trend — {chart.currency}</h3>
        <p className="mt-1 text-xs text-slate-500">Collected, billed, and overdue amounts in {chart.currency}.</p>
      </div>
      {hasValues ? (
        <ChartContainer config={config} className="h-[300px] w-full min-w-0 sm:h-[340px]" aria-label={`Revenue trend by month in ${chart.currency}`}>
          <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <defs>
              {chart.series.map((series) => (
                <linearGradient key={series.key} id={`revenue-${series.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={METRIC_COLORS[series.metric]} stopOpacity={series.metric === "billed" ? 0.22 : 0.35} />
                  <stop offset="95%" stopColor={METRIC_COLORS[series.metric]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis width={88} tickFormatter={(value) => formatRevenueChartAmount(Number(value), chart.currency)} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="border-slate-200 !bg-white text-ink"
                  labelFormatter={(label) => `Month: ${String(label)}`}
                  formatter={(value, name, item) => {
                    const series = chart.series.find((candidate) => candidate.key === item.dataKey);
                    return (
                      <div className="flex min-w-44 justify-between gap-4">
                        <span className="text-slate-500">{revenueTooltipLabel(series?.metric || (name === "Billed" ? "billed" : name === "Overdue" ? "overdue" : "collected"), chart.currency)}</span>
                        <span className="font-mono font-semibold">{formatRevenueChartAmount(Number(value), chart.currency)}</span>
                      </div>
                    );
                  }}
                />
              }
            />
            {chart.series.map((series) => (
              <Area key={series.key} type="monotone" dataKey={series.key} name={metricLabel(series.metric)} stroke={METRIC_COLORS[series.metric]} fill={`url(#revenue-${series.key})`} strokeWidth={2} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ChartContainer>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">Not enough monthly activity to chart yet.</p>
      )}
    </section>
  );
}

export function IntelligenceRevenueTrendChart({ charts }: { charts: RevenueCurrencyChart[] }) {
  if (charts.length === 0) {
    return (
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cedar">Revenue trajectory</p>
        <h3 className="mt-1 text-base font-bold text-ink">Revenue trend</h3>
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">Not enough monthly activity to chart yet.</p>
      </section>
    );
  }

  return <div className="min-w-0 space-y-4">{charts.map((chart) => <RevenueCurrencyChartSection key={chart.currency} chart={chart} />)}</div>;
}