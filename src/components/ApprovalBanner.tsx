import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

type ApprovalBannerProps = {
  status: "pending" | "approved" | "rejected";
  type: string;
  requestedBy?: string | null;
  resolvedBy?: string | null;
  note?: string | null;
  resolvedAt?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  payment_void: "Payment void",
  high_value_invoice: "High-value invoice",
  payment_plan: "Payment plan",
  recovery_escalation: "Recovery escalation",
};

export function ApprovalBanner({
  status,
  type,
  requestedBy,
  resolvedBy,
  note,
  resolvedAt,
}: ApprovalBannerProps) {
  const typeLabel = TYPE_LABELS[type] ?? type;

  if (status === "pending") {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/70 px-4 py-3"
        style={{ boxShadow: "var(--q-shadow-xs)" }}
      >
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Approval required</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800/80">
            This {typeLabel.toLowerCase()} requires approval before it can proceed.
            {requestedBy ? ` Requested by ${requestedBy}.` : ""}
          </p>
        </div>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div
        className="flex items-start gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50/70 px-4 py-3"
        style={{ boxShadow: "var(--q-shadow-xs)" }}
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">Approved</p>
          <p className="mt-0.5 text-xs leading-relaxed text-emerald-800/80">
            {typeLabel} approved{resolvedBy ? ` by ${resolvedBy}` : ""}
            {resolvedAt ? ` on ${new Date(resolvedAt).toLocaleDateString()}` : ""}.
            {note ? ` "${note}"` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50/70 px-4 py-3"
      style={{ boxShadow: "var(--q-shadow-xs)" }}
    >
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-red-900">Rejected</p>
        <p className="mt-0.5 text-xs leading-relaxed text-red-800/80">
          {typeLabel} rejected{resolvedBy ? ` by ${resolvedBy}` : ""}
          {resolvedAt ? ` on ${new Date(resolvedAt).toLocaleDateString()}` : ""}.
          {note ? ` Reason: "${note}"` : ""}
        </p>
      </div>
    </div>
  );
}
