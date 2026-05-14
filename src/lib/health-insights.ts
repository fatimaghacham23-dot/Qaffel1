import type { WorkspaceHealth } from "@/lib/operations-center";

export type HealthInsightSeverity = "critical" | "high" | "medium" | "ok";

export type HealthInsightRow = {
  key: string;
  label: string;
  note: string;
  lost: number;
  max: number;
  points: number;
  severity: HealthInsightSeverity;
  actionLabel: string;
  href: string;
};

function hrefForBreakdownKey(key: string): string {
  switch (key) {
    case "profile":
      return "/settings/profile";
    case "readiness":
      return "/settings/payment-methods";
    case "overdue":
      return "/invoices";
    case "proofs":
      return "/proofs";
    case "balance":
      return "/invoices";
    default:
      return "/dashboard";
  }
}

function actionForBreakdownKey(key: string): string {
  switch (key) {
    case "profile":
      return "Open profile";
    case "readiness":
      return "Fix payment methods";
    case "overdue":
      return "Review overdue";
    case "proofs":
      return "Review proofs";
    case "balance":
      return "Review open balances";
    default:
      return "View dashboard";
  }
}

function severityFromLost(lost: number, max: number): HealthInsightSeverity {
  const cap = max > 0 ? max : 1;
  const ratio = lost / cap;
  if (ratio >= 0.45) return "critical";
  if (ratio >= 0.22) return "high";
  if (ratio > 0.001) return "medium";
  return "ok";
}

/** Derive deficit rows from existing health breakdown only (no new scoring). */
export function deriveHealthInsightRows(health: WorkspaceHealth): HealthInsightRow[] {
  return health.breakdown
    .map((row) => {
      const max = row.max > 0 ? row.max : 0;
      const lost = Math.max(0, max - row.points);
      return {
        key: row.key,
        label: row.label,
        note: row.note,
        lost,
        max,
        points: row.points,
        severity: severityFromLost(lost, max > 0 ? max : 1),
        actionLabel: actionForBreakdownKey(row.key),
        href: hrefForBreakdownKey(row.key)
      };
    })
    .filter((r) => r.lost > 0.0001)
    .sort((a, b) => b.lost - a.lost);
}
