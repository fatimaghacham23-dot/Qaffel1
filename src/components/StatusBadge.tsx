const styles: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  complete: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  missing: "bg-amber-50 text-amber-700 ring-amber-200",
  partial: "bg-sky-50 text-sky-700 ring-sky-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  voided: "bg-slate-100 text-slate-700 ring-slate-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  unpaid: "bg-slate-100 text-slate-700 ring-slate-200",
  sent: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  quote: "bg-violet-50 text-violet-700 ring-violet-200",
  expired: "bg-red-50 text-red-700 ring-red-200",
  not_required: "bg-slate-100 text-slate-700 ring-slate-200",
  unknown: "bg-slate-100 text-slate-700 ring-slate-200"
};

const labels: Record<string, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  draft: "Draft",
  sent: "Sent",
  pending: "Pending",
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
  unknown: "Unknown"
};

export function StatusBadge({ status, label, className = "" }: { status: string | null | undefined; label?: string; className?: string }) {
  const value = (status || "unknown").toLowerCase();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[value] || styles.unknown} ${className}`}>
      {label || labels[value] || value}
    </span>
  );
}
