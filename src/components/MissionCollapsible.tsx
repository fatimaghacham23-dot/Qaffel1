"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  expandLabel?: string;
  collapseLabel?: string;
};

export function MissionCollapsible({
  id,
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
  className,
  expandLabel = "Expand section",
  collapseLabel = "Collapse section"
}: Props) {
  const storageKey = `qaffel-dash-section-${id}`;

  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const idRaf = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw === "1") setOpen(true);
        else if (raw === "0") setOpen(false);
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(idRaf);
  }, [storageKey]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleLabel = open ? collapseLabel : expandLabel;

  return (
    <section className={cn("q-page-fade q-panel overflow-hidden", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full touch-manipulation items-start justify-between gap-4 rounded-t-[var(--q-radius-2xl)] px-5 py-5 text-left transition-colors hover:bg-slate-50/60 active:bg-slate-100/50 sm:px-7 sm:py-6"
        style={{ transitionDuration: "var(--q-duration-normal)", transitionTimingFunction: "var(--q-ease)" }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform",
                open ? "rotate-0" : "-rotate-90"
              )}
              style={{ transitionDuration: "var(--q-duration-expand)", transitionTimingFunction: "var(--q-ease-spring)" }}
              aria-hidden
            />
            <h2 className="q-title-sm">{title}</h2>
            {badge}
          </div>
          {subtitle ? <p className="q-body-muted mt-2.5 pl-6 sm:pl-7">{subtitle}</p> : null}
        </div>
        <span className="mt-0.5 max-w-[10rem] shrink-0 rounded-full border border-slate-200/60 bg-slate-50/70 px-3 py-1 text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
          {toggleLabel}
        </span>
      </button>
      <div
        className={cn(
          "grid border-t border-slate-100/60 motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
        style={{
          transitionProperty: "grid-template-rows",
          transitionDuration: "var(--q-duration-expand)",
          transitionTimingFunction: "var(--q-ease)"
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "px-5 pb-6 pt-4 motion-reduce:transition-none sm:px-7 sm:pb-7",
              open ? "opacity-100" : "opacity-0"
            )}
            style={{
              transitionProperty: "opacity, transform",
              transitionDuration: "var(--q-duration-slow)",
              transitionTimingFunction: "var(--q-ease)",
              transitionDelay: open ? "80ms" : "0ms",
              transform: open ? "translateY(0)" : "translateY(-4px)"
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
