import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type OperationsCheckItem = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
  /** Shown when not ok — e.g. link to settings */
  fixHref?: string;
  fixLabel?: string;
};

export function OperationsChecklist({
  title,
  description,
  items,
  className
}: {
  title: string;
  description?: string;
  items: OperationsCheckItem[];
  className?: string;
}) {
  const done = items.filter((i) => i.ok).length;

  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-soft", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {done}/{items.length}
        </span>
      </div>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex gap-3 rounded-xl border px-3 py-2.5 text-sm",
              item.ok ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-slate-50/80"
            )}
          >
            <span className="mt-0.5 shrink-0">
              {item.ok ? (
                <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 text-slate-400" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("font-semibold", item.ok ? "text-emerald-900" : "text-ink")}>{item.label}</p>
              {item.hint && !item.ok ? <p className="mt-0.5 text-xs text-slate-600">{item.hint}</p> : null}
              {!item.ok && item.fixHref ? (
                <Link className="mt-1.5 inline-block text-xs font-semibold text-cedar hover:underline" href={item.fixHref}>
                  {item.fixLabel || "Fix in settings →"}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
