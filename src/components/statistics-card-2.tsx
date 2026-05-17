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
    accent: "bg-cedar/80",
    icon: "text-cedar",
    surface: "bg-cedar/[0.06]"
  },
  emerald: {
    accent: "bg-emerald-600/75",
    icon: "text-emerald-700",
    surface: "bg-emerald-50/70"
  },
  amber: {
    accent: "bg-amber-500/75",
    icon: "text-amber-800",
    surface: "bg-amber-50/65"
  },
  tomato: {
    accent: "bg-tomato/80",
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
      <div className={cn("absolute inset-x-6 top-0 h-px", classes.accent)} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="q-section-label">{title}</p>
          <p className="q-figure mt-3.5 break-words text-[1.625rem] font-semibold tracking-tight text-ink sm:text-[1.75rem]">{value}</p>
        </div>
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/50 shadow-xs", classes.surface)}>
          <Icon className={cn("h-5 w-5", classes.icon)} aria-hidden="true" />
        </span>
      </div>
      <p className="q-caption mt-3.5">{helperText}</p>
    </>
  );

  const className =
    "group q-surface-hover relative block min-h-[9rem] overflow-hidden rounded-2xl border border-slate-200/50 bg-white/95 p-6";

  if (href) {
    return (
      <Link className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
