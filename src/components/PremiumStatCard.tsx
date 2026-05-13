import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PremiumStatCardProps = {
  label: string;
  value: ReactNode;
  detail?: string;
  className?: string;
};

export function PremiumStatCard({ label, value, detail, className }: PremiumStatCardProps) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-soft", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
      {detail ? <p className="mt-1 truncate text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}
