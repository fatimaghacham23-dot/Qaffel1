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
    <div className="space-y-4">
      <div className="q-panel overflow-hidden p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="q-section-label text-slate-500">Primary cash signal</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-600">Collected this month</p>
          </div>
          <span className="rounded-full border border-emerald-200/70 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
            Live
          </span>
        </div>
        <p className="q-figure mt-5 text-3xl font-semibold leading-none tracking-tight text-ink sm:text-4xl">
          <AnimatedUsd value={props.paidThisMonthUsd} />
        </p>
        <p className="q-caption mt-3 max-w-xl">
          Confirmed invoice payments only. Pending proofs stay out until manual review is complete.
        </p>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible lg:grid-cols-4">
        {secondaries.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="q-surface-hover q-figure min-w-[10rem] shrink-0 snap-start rounded-3xl border border-slate-200/65 bg-white/[0.93] px-4 py-3.5 shadow-card sm:min-w-0"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{k.label}</p>
            <p className={`mt-2 text-lg font-semibold tabular-nums sm:text-xl ${toneText[k.tone || "slate"]}`}>
              {k.valueUsd !== undefined ? <AnimatedUsd value={k.valueUsd} /> : null}
              {k.valueInt !== undefined ? <AnimatedInt value={k.valueInt} /> : null}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
