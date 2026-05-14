"use client";

import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/area-charts-2";
import { money } from "@/lib/format";
import { finiteN } from "@/lib/safe-metrics";
import type { StackedMethodMonth } from "@/lib/intelligence-layer";

const PALETTE = ["#116466", "#d95f43", "#64748b", "#0ea5e9", "#a855f7", "#94a3b8"];

export function IntelligenceStackedMethodsChart({ data }: { data: StackedMethodMonth[] }) {
  const methodKeys = [...new Set(data.flatMap((d) => Object.keys(d.stacks)))].filter((k) => k !== "Other");
  const withOther = [...methodKeys];
  if (data.some((d) => d.stacks["Other"])) withOther.push("Other");

  const chartRows = data.map((row) => {
    const out: Record<string, string | number> = { label: row.label };
    for (const k of withOther) {
      out[k] = row.stacks[k] ?? 0;
    }
    return out;
  });

  const config: ChartConfig = {};
  withOther.forEach((k, i) => {
    config[k] = { label: k, color: PALETTE[i % PALETTE.length] };
  });

  const has = chartRows.some((r) => withOther.some((k) => Number(r[k]) > 0));

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cedar">Payment mix</p>
        <h3 className="mt-1 text-base font-bold text-ink">Stacked proof volume by method</h3>
        <p className="mt-1 text-xs text-slate-500">
          Accepted proof amounts in invoice currency, converted to approx. USD at each invoice&apos;s rate, grouped by method label.
        </p>
      </div>
      {has ? (
        <ChartContainer config={config} className="h-[280px] w-full min-w-0 sm:h-[320px]">
          <BarChart data={chartRows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis width={44} tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="border-slate-200 !bg-white text-ink"
                  formatter={(value, name) => (
                    <div className="flex min-w-40 justify-between gap-3 text-xs">
                      <span className="text-slate-500">{String(name)}</span>
                      <span className="font-mono font-semibold">{money(finiteN(Number(value)), "USD")}</span>
                    </div>
                  )}
                />
              }
            />
            {withOther.map((k, i) => (
              <Bar key={k} dataKey={k} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={650} />
            ))}
          </BarChart>
        </ChartContainer>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
          Need accepted proofs with methods to stack this view.
        </p>
      )}
    </section>
  );
}
