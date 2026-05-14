import { cn } from "@/lib/utils";
import type { MissionSeverity } from "@/lib/dashboard-mission-copy";

const STYLES: Record<MissionSeverity, string> = {
  critical: "bg-red-600 text-white ring-red-700/30",
  urgent: "bg-amber-500 text-white ring-amber-600/30",
  warning: "bg-sky-600 text-white ring-sky-700/30",
  info: "bg-slate-500 text-white ring-slate-600/30",
  healthy: "bg-emerald-600 text-white ring-emerald-700/30"
};

const LABELS: Record<MissionSeverity, string> = {
  critical: "Critical",
  urgent: "Urgent",
  warning: "Warning",
  info: "Info",
  healthy: "Healthy"
};

export function SeverityBadge({ severity, className }: { severity: MissionSeverity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
        STYLES[severity],
        className
      )}
    >
      {LABELS[severity]}
    </span>
  );
}
