/** Restrained status chips — calm saturation per design-system-rules.md */
const styles: Record<string, string> = {
  paid: "bg-emerald-50/90 text-emerald-800/95 ring-emerald-200/70",
  accepted: "bg-emerald-50/90 text-emerald-800/95 ring-emerald-200/70",
  approved: "bg-emerald-50/90 text-emerald-800/95 ring-emerald-200/70",
  active: "bg-emerald-50/90 text-emerald-800/95 ring-emerald-200/70",
  complete: "bg-emerald-50/90 text-emerald-800/95 ring-emerald-200/70",
  pending: "bg-amber-50/90 text-amber-900/90 ring-amber-200/60",
  awaiting_review: "bg-amber-50/90 text-amber-900/90 ring-amber-200/60",
  warning: "bg-amber-50/90 text-amber-900/90 ring-amber-200/60",
  missing: "bg-amber-50/90 text-amber-900/90 ring-amber-200/60",
  expiring: "bg-amber-50/90 text-amber-900/90 ring-amber-200/60",
  partial: "bg-sky-50/90 text-sky-800/95 ring-sky-200/65",
  overdue: "bg-rose-50/90 text-rose-900/90 ring-rose-200/60",
  rejected: "bg-rose-50/90 text-rose-900/90 ring-rose-200/60",
  danger: "bg-rose-50/90 text-rose-900/90 ring-rose-200/60",
  recovery_risk: "bg-orange-50/85 text-orange-900/88 ring-orange-200/55",
  voided: "bg-slate-100/95 text-slate-600 ring-slate-200/70",
  neutral: "bg-slate-100/95 text-slate-600 ring-slate-200/70",
  unpaid: "bg-slate-100/95 text-slate-600 ring-slate-200/70",
  sent: "bg-indigo-50/90 text-indigo-800/95 ring-indigo-200/60",
  draft: "bg-slate-100/95 text-slate-600 ring-slate-200/70",
  quote: "bg-violet-50/90 text-violet-800/95 ring-violet-200/60",
  expired: "bg-rose-50/85 text-rose-900/88 ring-rose-200/55",
  not_required: "bg-slate-100/95 text-slate-500 ring-slate-200/65",
  unknown: "bg-slate-100/95 text-slate-500 ring-slate-200/65",
  deposit_pending: "bg-sky-50/90 text-sky-900/90 ring-sky-200/60"
};

const labels: Record<string, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  draft: "Draft",
  sent: "Sent",
  pending: "Pending",
  awaiting_review: "Awaiting review",
  accepted: "Accepted",
  rejected: "Rejected",
  voided: "Voided",
  quote: "Quote",
  expired: "Expired",
  approved: "Approved",
  active: "Active",
  complete: "Complete",
  warning: "Warning",
  missing: "Missing",
  danger: "Attention",
  neutral: "Neutral",
  not_required: "Not required",
  unknown: "Unknown",
  expiring: "Expiring soon",
  recovery_risk: "Recovery risk",
  deposit_pending: "Deposit pending"
};

const sizeClasses = {
  sm: "min-h-7 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight ring-[0.5px] shadow-sm",
  md: "min-h-8 rounded-full px-2.5 py-1 text-xs font-semibold ring-[0.5px] shadow-sm"
};

export function StatusBadge({
  status,
  label,
  className = "",
  size = "md"
}: {
  status: string | null | undefined;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const value = (status || "unknown").toLowerCase();
  const tone = styles[value] || styles.unknown;
  const sz = sizeClasses[size];

  return (
    <span className={`inline-flex max-w-full shrink-0 items-center justify-center border border-white/50 ${sz} ${tone} ${className}`}>
      <span className="truncate font-medium" style={{ letterSpacing: "0.01em" }}>{label || labels[value] || value}</span>
    </span>
  );
}
