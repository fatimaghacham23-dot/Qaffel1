"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ActivityChartCard } from "@/components/activity-chart-card";

interface AnimatedDashboardCardProps {
  title: string;
  value: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  note?: string;
  enableAnimations?: boolean;
  activityData?: { day: string; value: number }[];
  activityEmptyMessage?: string;
}

export function AnimatedDashboardCard({
  title,
  value,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  note,
  enableAnimations = true,
  activityData,
  activityEmptyMessage
}: AnimatedDashboardCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = enableAnimations && !shouldReduceMotion;

  return (
    <motion.div
      className="relative h-full min-h-[300px] overflow-hidden rounded-2xl border border-cedar/15 bg-white p-5 shadow-soft"
      initial={shouldAnimate ? { opacity: 0, y: 16, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full border border-cedar/10 bg-cedar/5" />
      <div className="pointer-events-none absolute -bottom-20 left-8 h-44 w-44 rounded-full border border-tomato/10 bg-tomato/5" />

      <div className="relative z-10 grid h-full grid-rows-[auto_auto_1fr] gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cedar">Financial highlight</p>
            <h2 className="mt-2 text-lg font-bold text-ink">{title}</h2>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-cedar/5 to-slate-50 p-5 shadow-sm">
          <motion.div
            className="absolute right-4 top-4 hidden h-14 w-14 place-items-center rounded-full border border-cedar/10 text-cedar/40 sm:grid"
            aria-hidden="true"
            initial={shouldAnimate ? { rotate: -18, scale: 0.88, opacity: 0 } : false}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ delay: 0.12, type: "spring", stiffness: 220, damping: 24 }}
          >
            <span className="h-8 w-8 rounded-full border border-current" />
          </motion.div>
          <motion.div
            className="relative max-w-full"
            initial={shouldAnimate ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="mt-2 break-words text-3xl font-bold tracking-normal text-ink sm:text-4xl">{value}</p>
          </motion.div>
        </div>

        {activityData ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm">
            <ActivityChartCard
              variant="embed"
              data={activityData}
              emptyMessage={activityEmptyMessage}
            />
          </div>
        ) : null}

        <div className="self-end">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-2 h-1 w-8 rounded-full bg-cedar" />
              <p className="text-xs font-medium text-slate-500">{primaryLabel}</p>
              <p className="mt-1 break-words text-lg font-bold text-ink">{primaryValue}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-2 h-1 w-8 rounded-full bg-tomato" />
              <p className="text-xs font-medium text-slate-500">{secondaryLabel}</p>
              <p className="mt-1 break-words text-lg font-bold text-ink">{secondaryValue}</p>
            </div>
          </div>

          {note && <p className="mt-3 text-xs leading-5 text-slate-500">{note}</p>}
        </div>
      </div>
    </motion.div>
  );
}
