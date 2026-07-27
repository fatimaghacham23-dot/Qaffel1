import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({ children, title, description, action, density = "standard", noPadding = false, className }: { children: ReactNode; title?: string; description?: string; action?: ReactNode; density?: "standard" | "compact"; noPadding?: boolean; className?: string }) {
  const padding = density === "compact" ? "p-4" : "p-5 sm:p-6";
  return <section className={cn("q-surface overflow-hidden", className)}>{title || description || action ? <header className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-slate-100", padding)}><div className="min-w-0"><h2 className="text-base font-semibold text-ink">{title}</h2>{description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}</div>{action ? <div className="shrink-0">{action}</div> : null}</header> : null}<div className={noPadding ? undefined : padding}>{children}</div></section>;
}
