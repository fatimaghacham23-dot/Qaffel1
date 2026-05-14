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
        className="flex w-full touch-manipulation items-start justify-between gap-3 rounded-t-[1.35rem] px-5 py-4 text-left transition-colors duration-q hover:bg-slate-50/90 active:bg-slate-100/80 sm:px-6 sm:py-5"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ChevronDown
              className={cn("mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ease-out", open ? "rotate-0" : "-rotate-90")}
              aria-hidden
            />
            <h2 className="q-title-sm">{title}</h2>
            {badge}
          </div>
          {subtitle ? <p className="q-body-muted mt-2 pl-6 sm:pl-7">{subtitle}</p> : null}
        </div>
        <span className="mt-0.5 max-w-[10rem] shrink-0 rounded-full border border-slate-200/80 bg-slate-50/90 px-2.5 py-1 text-center text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-700">
          {toggleLabel}
        </span>
      </button>
      <div
        className={cn(
          "grid border-t border-slate-100 transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "px-4 pb-5 pt-3 transition-opacity duration-200 ease-out motion-reduce:transition-none sm:px-6 sm:pb-6",
              open ? "opacity-100" : "opacity-0"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
