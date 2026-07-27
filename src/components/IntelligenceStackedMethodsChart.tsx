"use client";

import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/area-charts-2";
import { formatCurrencyTotal } from "@/lib/currency-totals";
import type { PaymentMethodCurrencyChart } from "@/lib/payment-method-currency-charts";

const PALETTE = ["#116466", "#d95f43", "#64748b", "#0ea5e9", "#a855f7", "#94a3b8"];

export function paymentMethodTooltipLabel(method: string, currency: string) {
  return `${method} · ${currency}`;
}

export function formatPaymentMethodChartAmount(amount: number, currency: string) {
  return formatCurrencyTotal({ currency, amount });
}

function PaymentMethodChartSection({ chart }: { chart: PaymentMethodCurrencyChart }) {
  const headingId = `payment-methods-${chart.currency.toLowerCase()}`;
  const chartRows: Array<Record<string, string | number>> = chart.rows.map((row) => ({ month: row.month, ...row.values }));
  const hasValues = chartRows.some((row) => chart.series.some((series) => Number(row[series.key]) > 0));
  const config: ChartConfig = {};
  chart.series.forEach((series, index) => {
    config[series.key] = { label: series.method, color: PALETTE[index % PALETTE.length] };
  });

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5" aria-labelledby={headingId}>
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cedar">Payment mix</p>
        <h3 id={headingId} className="mt-1 text-base font-bold text-ink">Payment methods — {chart.currency}</h3>
        <p className="mt-1 text-xs text-slate-500">Accepted, non-voided payment amounts grouped by method in {chart.currency}.</p>
      </div>
      {hasValues ? (
        <ChartContainer config={config} className="h-[280px] w-full min-w-0 sm:h-[320px]" aria-label={`Payment methods by month in ${chart.currency}`}>
          <BarChart data={chartRows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              width={88}
              tickFormatter={(value) => formatPaymentMethodChartAmount(Number(value), chart.currency)}
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="border-slate-200 !bg-white text-ink"
                  labelFormatter={(label) => `Month: ${String(label)}`}
                  formatter={(value, name) => (
                    <div className="flex min-w-40 justify-between gap-3 text-xs">
                      <span className="text-slate-500">{paymentMethodTooltipLabel(String(name), chart.currency)}</span>
                      <span className="font-mono font-semibold">{formatPaymentMethodChartAmount(Number(value), chart.currency)}</span>
                    </div>
                  )}
                />
              }
            />
            {chart.series.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={`${series.method} (${chart.currency})`}
                stackId={series.stackId}
                fill={PALETTE[index % PALETTE.length]}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
          Need accepted, non-voided payment records with methods to show this view.
        </p>
      )}
    </section>
  );
}

export function IntelligenceStackedMethodsChart({ data }: { data: PaymentMethodCurrencyChart[] }) {
  if (data.length === 0) {
    return (
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cedar">Payment mix</p>
        <h3 className="mt-1 text-base font-bold text-ink">Payment methods</h3>
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
          Need accepted, non-voided payment records with methods to show this view.
        </p>
      </section>
    );
  }

  return <div className="min-w-0 space-y-4">{data.map((chart) => <PaymentMethodChartSection key={chart.currency} chart={chart} />)}</div>;
}