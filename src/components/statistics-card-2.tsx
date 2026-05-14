import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatisticsCardTone = "cedar" | "emerald" | "amber" | "tomato";

interface StatisticsCardProps {
  title: string;
  value: string;
  helperText?: string;
  icon: LucideIcon;
  href?: string;
  tone?: StatisticsCardTone;
}

const toneClasses: Record<StatisticsCardTone, { accent: string; icon: string; surface: string }> = {
  cedar: {
    accent: "bg-cedar/90",
    icon: "text-cedar",
    surface: "bg-cedar/[0.06]"
  },
  emerald: {
    accent: "bg-emerald-600/85",
    icon: "text-emerald-800",
    surface: "bg-emerald-50/80"
  },
  amber: {
    accent: "bg-amber-500/85",
    icon: "text-amber-900/90",
    surface: "bg-amber-50/75"
  },
  tomato: {
    accent: "bg-tomato/90",
    icon: "text-tomato",
    surface: "bg-tomato/[0.06]"
  }
};

export function StatisticsCard({
  title,
  value,
  helperText = "Current total",
  icon: Icon,
  href,
  tone = "cedar"
}: StatisticsCardProps) {
  const classes = toneClasses[tone];
  const content = (
    <>
      <div className={cn("absolute inset-x-5 top-0 h-px", classes.accent)} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="q-section-label">{title}</p>
          <p className="q-figure mt-3 break-words text-2xl font-semibold tracking-tight text-ink sm:text-[1.65rem]">{value}</p>
        </div>
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/60 shadow-sm", classes.surface)}>
          <Icon className={cn("h-5 w-5", classes.icon)} aria-hidden="true" />
        </span>
      </div>
      <p className="q-caption mt-3">{helperText}</p>
    </>
  );

  const className =
    "group q-surface-hover relative block min-h-[8.5rem] overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 p-5 shadow-card";

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
