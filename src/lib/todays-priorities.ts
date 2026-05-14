import { sortOpsAlerts, type AlertPriority, type OperationsCenterModel, type OpsAlert } from "@/lib/operations-center";
import { humanizeOpsAlert, missionSeverityFromPriority, type MissionSeverity } from "@/lib/dashboard-mission-copy";

export type TodaysPriority = {
  id: string;
  severity: MissionSeverity;
  title: string;
  explanation: string;
  ctaLabel: string;
  href: string;
  bucket: OpsAlert["bucket"];
};

function priorityRank(p: AlertPriority): number {
  switch (p) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}

/** Merge multiple expiring-link alerts into one row when there are several (same data, clearer action). */
function flattenAlertsForPriorities(alerts: OpsAlert[]): OpsAlert[] {
  const expiring = alerts.filter((a) => a.alertType === "expiring_link");
  const rest = alerts.filter((a) => a.alertType !== "expiring_link");
  if (expiring.length <= 1) return [...alerts].sort(sortOpsAlerts);

  const worst = expiring.reduce((a, b) => (priorityRank(a.priority) <= priorityRank(b.priority) ? a : b));
  const synthetic: OpsAlert = {
    id: "priority-expiring-bundle",
    alertType: "expiring_link",
    priority: worst.priority,
    bucket: "invoices",
    title: `${expiring.length} client payment pages expiring soon`,
    detail: `Validity ends within 7 days on ${expiring.length} invoices — extend or regenerate links.`,
    href: "/invoices"
  };
  return [synthetic, ...rest].sort(sortOpsAlerts);
}

export function buildTodaysPriorities(
  model: OperationsCenterModel,
  ctx: { pendingProofCount: number }
): TodaysPriority[] {
  const flat = flattenAlertsForPriorities(model.alerts);
  const candidates: TodaysPriority[] = [];

  const hasProofQueueRow = flat.some((a) => a.alertType === "proof_waiting");
  if (ctx.pendingProofCount > 0 && !hasProofQueueRow) {
    const sev: MissionSeverity = ctx.pendingProofCount >= 3 ? "urgent" : "warning";
    candidates.push({
      id: "priority-pending-proofs-count",
      severity: sev,
      title: `Review ${ctx.pendingProofCount} pending proof${ctx.pendingProofCount === 1 ? "" : "s"}`,
      explanation: "Client uploads stay in queue until you accept, reject, or void — money is not confirmed until then.",
      ctaLabel: "Open proof queue",
      href: "/proofs",
      bucket: "proofs"
    });
  }

  for (const a of flat) {
    const { title, explanation, ctaLabel } = humanizeOpsAlert(a);
    candidates.push({
      id: `p-${a.id}`,
      severity: missionSeverityFromPriority(a.priority),
      title,
      explanation,
      ctaLabel,
      href: a.href,
      bucket: a.bucket
    });
  }

  const sevOrder = (s: MissionSeverity) => ({ critical: 0, urgent: 1, warning: 2, info: 3, healthy: 4 } as const)[s];
  candidates.sort((x, y) => {
    const d = sevOrder(x.severity) - sevOrder(y.severity);
    if (d !== 0) return d;
    return x.title.localeCompare(y.title);
  });

  return candidates.slice(0, 5);
}
