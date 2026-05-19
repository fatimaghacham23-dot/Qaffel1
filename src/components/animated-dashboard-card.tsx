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
  /** When true, skips the large headline value block (use with an external KPI strip). */
  omitHeroValue?: boolean;
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
  activityEmptyMessage,
  omitHeroValue = false
}: AnimatedDashboardCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = enableAnimations && !shouldReduceMotion;

  return (
    <motion.div
      className="q-panel relative h-full min-h-[240px] overflow-hidden p-4 sm:min-h-[260px] sm:p-5"
      initial={shouldAnimate ? { opacity: 0, y: 16, scale: 0.98 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cedar/25 to-transparent" />

      <div className="relative z-10 grid h-full grid-rows-[auto_auto_1fr] gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="q-section-label text-cedar">Financial highlight</p>
            <h2 className="mt-2 text-lg font-bold text-ink">{title}</h2>
          </div>
        </div>

        {!omitHeroValue ? (
          <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/[0.85] p-5 shadow-sm">
            <motion.div
              className="relative max-w-full"
              initial={shouldAnimate ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            >
              <p className="text-sm font-medium text-slate-500">{title}</p>
              <p className="mt-2 break-words text-3xl font-bold tracking-normal text-ink sm:text-4xl">{value}</p>
            </motion.div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Trend and breakdown below — headline totals sit in the KPI strip above.</p>
        )}

        {activityData ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm">
            <ActivityChartCard
              variant="embed"
              data={activityData}
              emptyMessage={activityEmptyMessage}
            />
          </div>
        ) : null}

        {!omitHeroValue ? (
          <div className="self-end">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-slate-200/70 bg-slate-50/60 p-2.5">
                <div className="mb-2 h-1 w-8 rounded-full bg-cedar" />
                <p className="text-xs font-medium text-slate-500">{primaryLabel}</p>
                <p className="mt-1 break-words text-lg font-bold text-ink">{primaryValue}</p>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200/70 bg-slate-50/60 p-2.5">
                <div className="mb-2 h-1 w-8 rounded-full bg-tomato" />
                <p className="text-xs font-medium text-slate-500">{secondaryLabel}</p>
                <p className="mt-1 break-words text-lg font-bold text-ink">{secondaryValue}</p>
              </div>
            </div>

            {note ? <p className="mt-3 text-xs leading-5 text-slate-500">{note}</p> : null}
          </div>
        ) : note ? (
          <p className="self-end text-xs leading-5 text-slate-500">{note}</p>
        ) : null}
      </div>
    </motion.div>
  );
}
