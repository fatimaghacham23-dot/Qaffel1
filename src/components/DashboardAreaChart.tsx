"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/area-charts-2";
import { money } from "@/lib/format";

export interface DashboardTrendDatum {
  label: string;
  paidAmount: number;
  outstandingAmount: number;
}

interface DashboardAreaChartProps {
  data: DashboardTrendDatum[];
  hasTrendData: boolean;
  paidTotal: number;
  outstandingTotal: number;
}

const chartConfig = {
  paidAmount: {
    label: "Collected in month",
    color: "#116466"
  },
  outstandingAmount: {
    label: "Waiting to be collected",
    color: "#d95f43"
  }
} satisfies ChartConfig;

function formatAxis(value: number) {
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${value}`;
}

export function DashboardAreaChart({ data, hasTrendData, paidTotal, outstandingTotal }: DashboardAreaChartProps) {
  return (
    <section className="q-panel min-h-[340px] min-w-0 p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="q-section-label text-cedar">Invoice trend</p>
          <h2 className="mt-2 text-lg font-bold text-ink">Collected vs waiting to be collected</h2>
        </div>
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-slate-500">Collected</p>
            <p className="font-bold text-ink">{money(paidTotal, "USD")}</p>
          </div>
          <div>
            <p className="text-slate-500">Waiting to collect</p>
            <p className="font-bold text-ink">{money(outstandingTotal, "USD")}</p>
          </div>
        </div>
      </div>

      {hasTrendData ? (
        <ChartContainer config={chartConfig} className="h-[300px] w-full min-w-0 sm:h-[340px]">
          <AreaChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="paidAmountFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-paidAmount)" stopOpacity={0.34} />
                <stop offset="95%" stopColor="var(--color-paidAmount)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="outstandingAmountFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-outstandingAmount)" stopOpacity={0.28} />
                <stop offset="95%" stopColor="var(--color-outstandingAmount)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              tickMargin={10}
              tick={{ fill: "#64748b", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickFormatter={(value) => formatAxis(Number(value))}
              tickLine={false}
              tickMargin={10}
              tick={{ fill: "#64748b", fontSize: 12 }}
              width={52}
            />
            <ChartTooltip
              cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  className="border-slate-200 !bg-white text-ink"
                  formatter={(value, name) => (
                    <div className="flex min-w-44 items-center justify-between gap-4">
                      <span className="text-slate-500">
                        {name === "paidAmount" ? "Collected in month" : "Waiting to be collected"}
                      </span>
                      <span className="font-mono font-semibold text-ink">{money(Number(value), "USD")}</span>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="paidAmount"
              fill="url(#paidAmountFill)"
              name="paidAmount"
              stroke="var(--color-paidAmount)"
              strokeWidth={2}
              type="monotone"
              isAnimationActive={false}
            />
            <Area
              dataKey="outstandingAmount"
              fill="url(#outstandingAmountFill)"
              name="outstandingAmount"
              stroke="var(--color-outstandingAmount)"
              strokeWidth={2}
              type="monotone"
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="grid min-h-[300px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center sm:min-h-[340px]">
          <div>
            <p className="text-base font-semibold text-ink">Trend data will appear as more invoices are created.</p>
            <p className="mt-2 text-sm text-slate-500">
              Current totals are shown above without inventing historical activity.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
