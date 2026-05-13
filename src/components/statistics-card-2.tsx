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
    accent: "bg-cedar",
    icon: "text-cedar",
    surface: "bg-cedar/5"
  },
  emerald: {
    accent: "bg-emerald-600",
    icon: "text-emerald-700",
    surface: "bg-emerald-50"
  },
  amber: {
    accent: "bg-amber-500",
    icon: "text-amber-700",
    surface: "bg-amber-50"
  },
  tomato: {
    accent: "bg-tomato",
    icon: "text-tomato",
    surface: "bg-tomato/5"
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
      <div className={cn("absolute inset-x-0 top-0 h-1", classes.accent)} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 break-words text-2xl font-bold tracking-normal text-ink">{value}</p>
        </div>
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", classes.surface)}>
          <Icon className={cn("h-5 w-5", classes.icon)} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">{helperText}</p>
    </>
  );

  const className =
    "group relative block min-h-36 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-cedar/20";

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
