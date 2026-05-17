"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { animate, useReducedMotion } from "framer-motion";
import { finiteN } from "@/lib/safe-metrics";
import { money } from "@/lib/format";

function AnimatedUsd({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const safe = finiteN(value);
  const shouldReduceMotion = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shouldReduceMotion) {
      el.textContent = money(safe, "USD");
      return;
    }
    const c = animate(0, safe, {
      duration: 0.7,
      ease: "circOut",
      onUpdate: (v) => {
        el.textContent = money(finiteN(v), "USD");
      }
    });
    return () => c.stop();
  }, [safe, shouldReduceMotion]);
  return <span ref={ref}>{money(0, "USD")}</span>;
}

function AnimatedInt({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const safe = Math.max(0, Math.round(finiteN(value)));
  const shouldReduceMotion = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shouldReduceMotion) {
      el.textContent = `${safe.toLocaleString()}`;
      return;
    }
    const c = animate(0, safe, {
      duration: 0.55,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = `${Math.round(finiteN(v)).toLocaleString()}`;
      }
    });
    return () => c.stop();
  }, [safe, shouldReduceMotion]);
  return <span ref={ref}>0</span>;
}

type SecondaryKpi = {
  label: string;
  valueUsd?: number;
  valueInt?: number;
  href: string;
  tone?: "slate" | "amber" | "rose" | "sky";
};

const toneText: Record<NonNullable<SecondaryKpi["tone"]>, string> = {
  slate: "text-ink",
  amber: "text-amber-900",
  rose: "text-rose-800",
  sky: "text-sky-900"
};

export function DashboardFinancialKpiStrip(props: {
  paidThisMonthUsd: number;
  waitingToCollectUsd: number;
  cashThisWeekUsd: number;
  revenueAtRiskUsd: number;
  proofsAwaitingReview: number;
}) {
  const secondaries: SecondaryKpi[] = [
    {
      label: "Waiting to be collected",
      valueUsd: props.waitingToCollectUsd,
      href: "/invoices",
      tone: "slate"
    },
    {
      label: "Cash arriving this week",
      valueUsd: props.cashThisWeekUsd,
      href: "/invoices",
      tone: "sky"
    },
    {
      label: "Revenue at risk",
      valueUsd: props.revenueAtRiskUsd,
      href: "/invoices",
      tone: "rose"
    },
    {
      label: "Proofs awaiting review",
      valueInt: props.proofsAwaitingReview,
      href: "/proofs",
      tone: "amber"
    }
  ];

  return (
    <div className="space-y-5">
      <div className="q-elevated overflow-hidden p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="q-section-label text-slate-500">Primary cash signal</p>
            <p className="mt-2 text-sm font-medium text-slate-600">Collected this month</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/50 bg-emerald-50/70 px-3 py-1 text-[11px] font-semibold text-emerald-800">
            <span className="q-pulse-dot text-emerald-500" />
            Live
          </span>
        </div>
        <p className="q-kpi-hero mt-6">
          <AnimatedUsd value={props.paidThisMonthUsd} />
        </p>
        <p className="q-caption mt-4 max-w-xl">
          Confirmed invoice payments only. Pending proofs stay out until manual review is complete.
        </p>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible lg:grid-cols-4">
        {secondaries.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="q-surface-hover q-figure min-w-[11rem] shrink-0 snap-start rounded-2xl border border-slate-200/50 bg-white/90 px-5 py-4 sm:min-w-0"
            style={{ boxShadow: "var(--q-shadow-xs)" }}
          >
            <p className="q-section-label">{k.label}</p>
            <p className={`q-kpi-secondary mt-3 ${toneText[k.tone || "slate"]}`}>
              {k.valueUsd !== undefined ? <AnimatedUsd value={k.valueUsd} /> : null}
              {k.valueInt !== undefined ? <AnimatedInt value={k.valueInt} /> : null}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
