import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProductivityAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  badge?: string | number | null;
  shortcut?: string;
  external?: boolean;
  tone?: "default" | "attention" | "positive";
};

type QuickActionGridProps = {
  actions: ProductivityAction[];
  title?: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
};

const toneClasses = {
  default: "hover:border-cedar/20 hover:bg-cedar/[0.035] hover:text-cedar",
  attention: "border-amber-200/80 bg-amber-50/70 text-amber-950 hover:border-amber-300 hover:bg-amber-50",
  positive: "border-emerald-200/80 bg-emerald-50/70 text-emerald-950 hover:border-emerald-300 hover:bg-emerald-50"
};

export function QuickActionGrid({ actions, title, subtitle, className, compact = false }: QuickActionGridProps) {
  if (actions.length === 0) return null;

  return (
    <section className={cn("q-panel p-4 sm:p-5", className)}>
      {title || subtitle ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-bold text-ink">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}

      <div className={cn("grid gap-2", compact ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4")}>
        {actions.map((action) => {
          const Icon = action.icon;
          const tone = action.tone || "default";

          return (
            <Link
              key={`${action.label}-${action.href}`}
              className={cn(
                "group flex min-h-[76px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-ink shadow-[0_1px_0_rgba(15,23,42,0.03)] transition-[background-color,border-color,box-shadow,transform,color] duration-q ease-q hover:-translate-y-0.5 hover:shadow-soft",
                toneClasses[tone]
              )}
              href={action.href}
              target={action.external ? "_blank" : undefined}
              rel={action.external ? "noopener noreferrer" : undefined}
            >
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border bg-white shadow-sm transition",
                  tone === "attention"
                    ? "border-amber-200 text-amber-700"
                    : tone === "positive"
                      ? "border-emerald-200 text-emerald-700"
                      : "border-slate-200 text-slate-500 group-hover:text-cedar"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{action.label}</span>
                  {action.badge ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      {action.badge}
                    </span>
                  ) : null}
                </span>
                {action.description ? <span className="mt-0.5 block truncate text-xs text-slate-500">{action.description}</span> : null}
              </span>
              {action.shortcut ? (
                <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-bold text-slate-500 sm:inline-flex">
                  {action.shortcut}
                </kbd>
              ) : (
                <ArrowRight className="hidden h-4 w-4 text-slate-300 transition group-hover:text-current sm:block" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
