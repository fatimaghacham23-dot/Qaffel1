import { sortOpsAlerts, type AlertBucket, type OpsAlert } from "@/lib/operations-center";

export type OpsQueueClusterKey =
  | "expiring_links"
  | "overdue_invoices"
  | "unpaid_deposits"
  | "pending_proofs"
  | "voided_payments"
  | "invoice_overpaid"
  | "client_followups"
  | "workspace_payment_setup"
  | "other";

export type OpsQueueCluster = {
  key: OpsQueueClusterKey;
  alerts: OpsAlert[];
};

const CLUSTER_MIN = 2;

function clusterKeyFor(a: OpsAlert): OpsQueueClusterKey | null {
  switch (a.alertType) {
    case "expiring_link":
      return "expiring_links";
    case "overdue_invoice":
      return "overdue_invoices";
    case "unpaid_deposit":
      return "unpaid_deposits";
    case "proof_waiting":
      return "pending_proofs";
    case "voided_payment":
      return "voided_payments";
    case "invoice_overpaid":
      return "invoice_overpaid";
    case "client_late_pattern":
    case "client_missing_contact":
      return "client_followups";
    case "missing_payment_methods":
    case "payment_methods_incomplete":
      return "workspace_payment_setup";
    default:
      return null;
  }
}

function priorityRank(p: OpsAlert["priority"]): number {
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

export function clusterTitle(key: OpsQueueClusterKey, count: number): string {
  const n = count.toLocaleString();
  switch (key) {
    case "expiring_links":
      return `${n} payment links expiring soon`;
    case "overdue_invoices":
      return `${n} invoices overdue`;
    case "unpaid_deposits":
      return `${n} unpaid deposits`;
    case "pending_proofs":
      return `${n} proofs awaiting review`;
    case "voided_payments":
      return `${n} voided payment records`;
    case "invoice_overpaid":
      return `${n} overpaid invoices`;
    case "client_followups":
      return `${n} client follow-ups`;
    case "workspace_payment_setup":
      return `${n} payment setup items`;
    default:
      return `${n} items`;
  }
}

/** Build grouped clusters (≥2 same-type) + remaining singles, preserving urgency order. */
export function buildOperationsQueueClusters(alerts: OpsAlert[]): { clusters: OpsQueueCluster[]; singles: OpsAlert[] } {
  const sorted = [...alerts].sort(sortOpsAlerts);
  const byKey = new Map<OpsQueueClusterKey, OpsAlert[]>();
  const unclustered: OpsAlert[] = [];

  for (const a of sorted) {
    const k = clusterKeyFor(a);
    if (!k) {
      unclustered.push(a);
      continue;
    }
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(a);
  }

  const clusters: OpsQueueCluster[] = [];
  const singles: OpsAlert[] = [...unclustered];

  const CLUSTER_ORDER: OpsQueueClusterKey[] = [
    "expiring_links",
    "overdue_invoices",
    "unpaid_deposits",
    "pending_proofs",
    "voided_payments",
    "invoice_overpaid",
    "client_followups",
    "workspace_payment_setup"
  ];

  for (const key of CLUSTER_ORDER) {
    const arr = byKey.get(key);
    if (!arr || arr.length < CLUSTER_MIN) {
      if (arr) singles.push(...arr);
      continue;
    }
    clusters.push({ key, alerts: arr });
  }

  singles.sort(sortOpsAlerts);
  clusters.sort((a, b) => {
    const ra = Math.min(...a.alerts.map((x) => priorityRank(x.priority)));
    const rb = Math.min(...b.alerts.map((x) => priorityRank(x.priority)));
    if (ra !== rb) return ra - rb;
    return CLUSTER_ORDER.indexOf(a.key) - CLUSTER_ORDER.indexOf(b.key);
  });

  return { clusters, singles };
}

export function worstClusterPriority(alerts: OpsAlert[]): OpsAlert["priority"] {
  let best = 3;
  for (const a of alerts) {
    best = Math.min(best, priorityRank(a.priority));
  }
  if (best === 0) return "critical";
  if (best === 1) return "high";
  if (best === 2) return "medium";
  return "low";
}

export function bucketForCluster(key: OpsQueueClusterKey): AlertBucket {
  switch (key) {
    case "pending_proofs":
      return "proofs";
    case "client_followups":
      return "clients";
    case "workspace_payment_setup":
    case "unpaid_deposits":
    case "voided_payments":
    case "invoice_overpaid":
      return "payments";
    case "expiring_links":
    case "overdue_invoices":
      return "invoices";
    default:
      return "invoices";
  }
}
