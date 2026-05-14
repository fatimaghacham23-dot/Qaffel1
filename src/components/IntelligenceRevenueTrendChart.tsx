"use client";

import { Area, AreaChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/area-charts-2";
import { money } from "@/lib/format";
import { finiteN } from "@/lib/safe-metrics";
import type { RevenueIntelligence } from "@/lib/intelligence-layer";

const chartConfig = {
  collected: { label: "Collected (approx. USD)", color: "#116466" },
  billed: { label: "Billed (approx. USD)", color: "#64748b" },
  overdue: { label: "Revenue at risk (overdue)", color: "#d95f43" }
} satisfies ChartConfig;

function fmtAxis(v: number) {
  const n = finiteN(v);
  if (n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
}

export function IntelligenceRevenueTrendChart({ revenue }: { revenue: RevenueIntelligence }) {
  const data = revenue.collectedByMonth.map((c, i) => ({
    label: c.label,
    collected: finiteN(c.usd),
    billed: finiteN(revenue.billedByMonth[i]?.usd ?? 0),
    overdue: finiteN(revenue.overdueByMonth[i]?.usd ?? 0)
  }));

  const hasData = data.some((d) => d.collected > 0 || d.billed > 0 || d.overdue > 0);

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cedar">Revenue trajectory</p>
        <h3 className="mt-1 text-base font-bold text-ink">Collected vs billed vs overdue pressure</h3>
        <p className="mt-1 text-xs text-slate-500">
          Collected = accepted proofs by confirmation month (invoice currency converted at each invoice&apos;s rate). Billed = new
          invoices in month. Overdue = remaining balance on overdue invoices, grouped by due-date month.
        </p>
      </div>
      {hasData ? (
        <ChartContainer config={chartConfig} className="h-[300px] w-full min-w-0 sm:h-[340px]">
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="intelCollected" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-collected)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-collected)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="intelBilled" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-billed)" stopOpacity={0.22} />
                <stop offset="95%" stopColor="var(--color-billed)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="intelOverdue" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-overdue)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-overdue)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis width={48} tickFormatter={(v) => fmtAxis(Number(v))} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="border-slate-200 !bg-white text-ink"
                  formatter={(value, name) => (
                    <div className="flex min-w-44 justify-between gap-4">
                      <span className="text-slate-500">
                        {name === "collected" ? "Collected" : name === "billed" ? "Billed" : "Overdue"}
                      </span>
                      <span className="font-mono font-semibold">{money(finiteN(Number(value)), "USD")}</span>
                    </div>
                  )}
                />
              }
            />
            <Area type="monotone" dataKey="collected" stroke="var(--color-collected)" fill="url(#intelCollected)" strokeWidth={2} isAnimationActive animationDuration={700} />
            <Area type="monotone" dataKey="billed" stroke="var(--color-billed)" fill="url(#intelBilled)" strokeWidth={2} isAnimationActive animationDuration={700} />
            <Area type="monotone" dataKey="overdue" stroke="var(--color-overdue)" fill="url(#intelOverdue)" strokeWidth={2} isAnimationActive animationDuration={700} />
          </AreaChart>
        </ChartContainer>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
          Not enough monthly activity to chart yet.
        </p>
      )}
    </section>
  );
}
