import type { AlertPriority, OpsAlert } from "@/lib/operations-center";

export type MissionSeverity = "critical" | "urgent" | "warning" | "info" | "healthy";

export function missionSeverityFromPriority(p: AlertPriority): MissionSeverity {
  if (p === "critical") return "critical";
  if (p === "high") return "urgent";
  if (p === "medium") return "warning";
  return "info";
}

/** Stronger, business-oriented copy — same underlying alert data. */
export function humanizeOpsAlert(a: OpsAlert): { title: string; explanation: string; ctaLabel: string } {
  switch (a.alertType) {
    case "missing_payment_methods":
      return {
        title: "Clients cannot pay you yet",
        explanation: a.detail || "Public invoice pages have no way to show payment instructions.",
        ctaLabel: "Add payment methods"
      };
    case "payment_methods_incomplete":
      return {
        title: "Payment instructions look incomplete",
        explanation: a.detail,
        ctaLabel: "Fix payment methods"
      };
    case "expiring_link":
      return {
        title: "Client payment page expiring soon",
        explanation: a.detail.replace(/^Payment link expiring/i, "Validity window").replace(/validity ends/i, "Link expires"),
        ctaLabel: "Extend validity"
      };
    case "proof_waiting":
      return {
        title: "Money blocked — proof needs review",
        explanation: a.detail,
        ctaLabel: "Review proofs"
      };
    case "overdue_invoice":
      return {
        title: "Money overdue on an invoice",
        explanation: a.detail,
        ctaLabel: "Open invoice"
      };
    case "unpaid_deposit":
      return {
        title: "Deposit still needed before you can close this",
        explanation: a.detail.replace(/^Unpaid deposit/i, "Deposit still needed"),
        ctaLabel: "View invoice"
      };
    case "client_missing_contact":
      return {
        title: "Client missing contact details",
        explanation: a.detail,
        ctaLabel: "Update client"
      };
    case "invoice_overpaid":
      return {
        title: "Balance may be ahead of invoice total",
        explanation: a.detail,
        ctaLabel: "Reconcile invoice"
      };
    case "stale_draft":
      return {
        title: "Draft invoice sitting idle",
        explanation: a.detail,
        ctaLabel: "Finish or send"
      };
    case "quote_followup":
      return {
        title: "Quote waiting on client",
        explanation: a.detail,
        ctaLabel: "Follow up"
      };
    case "voided_payment":
      return {
        title: "Recent voided payments",
        explanation: a.detail,
        ctaLabel: "Review proofs"
      };
    case "client_late_pattern":
      return {
        title: "Client with repeated late pattern",
        explanation: a.detail,
        ctaLabel: "View client"
      };
    default:
      return {
        title: a.title,
        explanation: a.detail,
        ctaLabel: "Open"
      };
  }
}
