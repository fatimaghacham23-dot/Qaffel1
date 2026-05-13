import type { PriorityFlag, PriorityFlagKey } from "@/lib/operations";
import { cn } from "@/lib/utils";

const toneClass: Record<PriorityFlagKey, string> = {
  needs_follow_up: "border-amber-200 bg-amber-50 text-amber-900",
  awaiting_proof_review: "border-sky-200 bg-sky-50 text-sky-900",
  deposit_pending: "border-violet-200 bg-violet-50 text-violet-900",
  overdue: "border-red-200 bg-red-50 text-red-900",
  expiring_soon: "border-orange-200 bg-orange-50 text-orange-900"
};

export function InvoicePriorityBadges({ flags, className }: { flags: PriorityFlag[]; className?: string }) {
  if (flags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {flags.map((flag) => (
        <span
          key={flag.key}
          className={cn(
            "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight sm:text-[11px]",
            toneClass[flag.key]
          )}
        >
          {flag.label}
        </span>
      ))}
    </div>
  );
}
