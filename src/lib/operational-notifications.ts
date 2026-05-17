import { isQuoteDocument } from "@/lib/documents";
import { paymentPlanProgress, parsePaymentPlan } from "@/lib/payment-plan";
import { hasPermission, type WorkspaceRole } from "@/lib/permissions";
import { getRemainingBalance, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import type { InvoiceStatus } from "@/lib/types";
import {
  assignmentAgeDays,
  assignmentPriorityRank,
  assignmentTargetHref,
  formatAssignee,
  isOpenAssignment,
  isOverdueAssignment,
  type AssignmentMemberOption,
  type OperationalAssignmentRow
} from "@/lib/assignments";

export type OperationalNotificationKind =
  | "proof_awaiting_review"
  | "proof_rejected"
  | "overdue_assignment"
  | "assignment_stale"
  | "assignment_reassigned"
  | "recovery_follow_up_needed"
  | "reminder_follow_up_due"
  | "approval_requested"
  | "payment_plan_overdue"
  | "invoice_expiring"
  | "finance_unresolved_balance"
  | "stale_partial_payment";

export type OperationalNotificationPriority = "low" | "normal" | "high" | "critical";
export type OperationalNotificationSeverity = "routine" | "watch" | "elevated" | "escalated";
export type OperationalNotificationBucket =
  | "proofs"
  | "assignments"
  | "recoveries"
  | "approvals"
  | "payments"
  | "communication";

export type AttentionSectionKey =
  | "requiresAttention"
  | "waitingOnYou"
  | "staleItems"
  | "escalations"
  | "recentChanges";

export type AttentionOwner =
  | { type: "user"; id: string; label: string }
  | { type: "role"; role: WorkspaceRole; label: string }
  | { type: "workspace"; label: string };

export type AttentionTarget = {
  type: "invoice" | "proof" | "assignment" | "approval" | "client" | "payment_plan";
  id: string;
  label: string;
  href: string;
};

export type OperationalNotification = {
  id: string;
  kind: OperationalNotificationKind;
  bucket: OperationalNotificationBucket;
  priority: OperationalNotificationPriority;
  severity: OperationalNotificationSeverity;
  title: string;
  summary: string;
  explanation: string;
  ctaLabel: string;
  target: AttentionTarget;
  owner: AttentionOwner;
  audienceRoles: WorkspaceRole[];
  actionPermission?:
    | "proofs.review"
    | "recoveries.manage"
    | "approvals.resolve"
    | "assignments.work"
    | "invoices.edit"
    | "reports.view"
    | "exports.finance";
  waitingSince?: string | null;
  dueAt?: string | null;
  lastActionAt?: string | null;
  lastReminderAt?: string | null;
  lastContactAt?: string | null;
  assignmentId?: string | null;
  escalation?: {
    active: boolean;
    reason: string;
    threshold: string;
    startedAt?: string | null;
  };
  evidence: string[];
  createdAt: string;
};

export type AttentionInvoiceProofRow = MinimalProof & {
  id?: string | null;
  status?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  uploaded_at?: string | null;
  confirmed_at?: string | null;
  reviewed_at?: string | null;
  payment_date?: string | null;
  method?: string | null;
};

export type AttentionInvoiceRow = {
  id: string;
  title?: string | null;
  invoice_number?: string | null;
  status: InvoiceStatus;
  document_type?: string | null;
  client_id?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  currency?: string | null;
  due_date?: string | null;
  valid_until?: string | null;
  created_at?: string | null;
  payment_plan?: unknown;
  exchange_rate_lbp_per_usd?: number | string | null;
  clients?: { id?: string | null; name?: string | null; phone?: string | null; email?: string | null } | null;
  payment_proofs?: AttentionInvoiceProofRow[] | null;
};

export type AttentionProofRow = AttentionInvoiceProofRow & {
  id: string;
  invoice_id?: string | null;
  invoices?: (AttentionInvoiceRow & { workspace_id?: string | null }) | null;
};

export type AttentionEventRow = {
  id?: string | null;
  invoice_id: string;
  event_type: string;
  message?: string | null;
  created_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AttentionApprovalRow = {
  id: string;
  type?: string | null;
  reference_id?: string | null;
  reference_type?: string | null;
  requested_by?: string | null;
  status: "pending" | "approved" | "rejected" | string;
  note?: string | null;
  threshold_usd?: number | string | null;
  created_at: string;
  resolved_at?: string | null;
};

export type AttentionWorkloadRow = {
  userId: string;
  name: string;
  role: WorkspaceRole;
  initials: string;
  active: number;
  stale: number;
  overdue: number;
  completed: number;
};

export type AttentionCenterModel = {
  generatedAt: string;
  role: WorkspaceRole;
  userId: string;
  notifications: OperationalNotification[];
  sections: Record<AttentionSectionKey, OperationalNotification[]>;
  counts: {
    total: number;
    waitingOnYou: number;
    stale: number;
    escalated: number;
    recentChanges: number;
  };
  visibility: {
    canSeeTeam: boolean;
    canResolveApprovals: boolean;
    canReviewProofs: boolean;
    canManageRecoveries: boolean;
  };
  team: {
    workload: AttentionWorkloadRow[];
    roleQueues: Array<{ role: WorkspaceRole; active: number; stale: number }>;
    staleQueues: number;
    overdueOwnership: number;
    approvalBottlenecks: number;
    proofReviewDelays: number;
    recoveryAging: number;
  };
  continuity: {
    pendingProofs: number;
    agedPendingProofs: number;
    overdueWithoutRecentReminder: number;
    remindersLast7d: number;
    reassignedMultipleTimes: number;
  };
};

const ALL_ROLES: WorkspaceRole[] = ["owner", "admin", "finance", "operations", "reviewer", "staff"];
const REVIEW_ROLES: WorkspaceRole[] = ["owner", "admin", "finance", "operations", "reviewer"];
const FINANCE_OPS_ROLES: WorkspaceRole[] = ["owner", "admin", "finance", "operations"];
const MANAGER_ROLES: WorkspaceRole[] = ["owner", "admin", "finance", "operations"];
const MS_HOUR = 3600000;
const MS_DAY = 86400000;

function parseTime(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : null;
}

function hoursSince(value: string | null | undefined, now: Date) {
  const time = parseTime(value);
  if (!time) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / MS_HOUR));
}

function daysSince(value: string | null | undefined, now: Date) {
  const time = parseTime(value);
  if (!time) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / MS_DAY));
}

function daysUntil(value: string | null | undefined, now: Date) {
  const time = parseTime(value);
  if (!time) return null;
  return Math.ceil((time - now.getTime()) / MS_DAY);
}

function ageLabel(hours: number | null) {
  if (hours === null) return "unknown age";
  if (hours < 1) return "under 1h";
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function priorityRank(priority: OperationalNotificationPriority) {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

function severityRank(severity: OperationalNotificationSeverity) {
  if (severity === "escalated") return 0;
  if (severity === "elevated") return 1;
  if (severity === "watch") return 2;
  return 3;
}

function sortNotifications(a: OperationalNotification, b: OperationalNotification) {
  const pr = priorityRank(a.priority) - priorityRank(b.priority);
  if (pr !== 0) return pr;
  const sr = severityRank(a.severity) - severityRank(b.severity);
  if (sr !== 0) return sr;
  const aWait = parseTime(a.waitingSince || a.lastActionAt || a.createdAt) || 0;
  const bWait = parseTime(b.waitingSince || b.lastActionAt || b.createdAt) || 0;
  if (aWait !== bWait) return aWait - bWait;
  return a.title.localeCompare(b.title);
}

function rowProofs(inv: AttentionInvoiceRow): MinimalProof[] {
  return (inv.payment_proofs || []).map((p) => ({
    status: p.status || "",
    amount_usd: p.amount_usd == null ? null : Number(p.amount_usd),
    amount_lbp: p.amount_lbp == null ? null : Number(p.amount_lbp)
  }));
}

function balanceInput(inv: AttentionInvoiceRow) {
  return {
    amount_usd: inv.amount_usd == null ? null : Number(inv.amount_usd),
    amount_lbp: inv.amount_lbp == null ? null : Number(inv.amount_lbp),
    currency: inv.currency,
    status: inv.status
  };
}

function displayStatus(inv: AttentionInvoiceRow) {
  return reconcileInvoiceStatus(balanceInput(inv), rowProofs(inv));
}

function invoiceLabel(inv: Pick<AttentionInvoiceRow, "invoice_number" | "title"> | null | undefined) {
  if (!inv) return "Invoice";
  return inv.invoice_number ? `${inv.invoice_number} - ${inv.title || "Invoice"}` : inv.title || "Invoice";
}

function proofInvoice(proof: AttentionProofRow, invoiceMap: Map<string, AttentionInvoiceRow>) {
  if (proof.invoices?.id) return proof.invoices;
  if (proof.invoice_id) return invoiceMap.get(proof.invoice_id) || null;
  return null;
}

function targetKey(type: string, id: string) {
  return `${type}:${id}`;
}

function assignmentForTarget(
  byTarget: Map<string, OperationalAssignmentRow[]>,
  type: string,
  id: string,
  assignmentType?: string
) {
  const rows = byTarget.get(targetKey(type, id)) || [];
  return rows
    .filter((assignment) => isOpenAssignment(assignment.status))
    .filter((assignment) => !assignmentType || assignment.assignment_type === assignmentType)
    .sort((a, b) => assignmentPriorityRank(a.priority) - assignmentPriorityRank(b.priority))[0] || null;
}

function ownerFromAssignment(assignment: OperationalAssignmentRow | null, fallbackRole: WorkspaceRole, fallbackLabel: string): AttentionOwner {
  if (assignment?.assigned_to_user_id) {
    return { type: "user", id: assignment.assigned_to_user_id, label: formatAssignee(assignment) };
  }
  if (assignment?.assigned_to_role) {
    return { type: "role", role: assignment.assigned_to_role, label: formatAssignee(assignment) };
  }
  return { type: "role", role: fallbackRole, label: fallbackLabel };
}

function isMine(notification: OperationalNotification, userId: string, role: WorkspaceRole) {
  if (notification.owner.type === "user") return notification.owner.id === userId;
  if (notification.owner.type === "role") return notification.owner.role === role;
  return false;
}

function canSeeNotification(notification: OperationalNotification, userId: string, role: WorkspaceRole) {
  if (role === "owner" || role === "admin") return true;
  if (isMine(notification, userId, role)) return true;
  if (!notification.audienceRoles.includes(role)) return false;
  if (!notification.actionPermission) return true;
  return hasPermission(role, notification.actionPermission);
}

function notificationCreatedAt(input: { waitingSince?: string | null; lastActionAt?: string | null; createdAt?: string | null }, now: Date) {
  return input.waitingSince || input.lastActionAt || input.createdAt || now.toISOString();
}

function addNotification(
  map: Map<string, OperationalNotification>,
  notification: Omit<OperationalNotification, "createdAt"> & { createdAt?: string }
) {
  const complete: OperationalNotification = {
    ...notification,
    createdAt: notificationCreatedAt(notification, new Date())
  };
  const existing = map.get(complete.id);
  if (!existing) {
    map.set(complete.id, complete);
    return;
  }
  if (sortNotifications(complete, existing) < 0) {
    map.set(complete.id, {
      ...complete,
      evidence: Array.from(new Set([...existing.evidence, ...complete.evidence]))
    });
  } else {
    map.set(existing.id, {
      ...existing,
      evidence: Array.from(new Set([...existing.evidence, ...complete.evidence]))
    });
  }
}

function operationalEventsOnly(events: AttentionEventRow[]) {
  const allowed = new Set([
    "proof_uploaded",
    "proof_accepted",
    "proof_rejected",
    "manual_payment",
    "reminder_copied",
    "assignment_created",
    "assignment_reassigned",
    "assignment_status_changed",
    "assignment_completed",
    "assignment_note_added",
    "handoff_completed",
    "payment_plan_updated",
    "payment_voided"
  ]);
  return events.filter((event) => allowed.has(event.event_type));
}

function lastEvent(events: AttentionEventRow[], invoiceId: string, types: string[]) {
  const typeSet = new Set(types);
  return events
    .filter((event) => event.invoice_id === invoiceId && typeSet.has(event.event_type))
    .sort((a, b) => (parseTime(b.created_at) || 0) - (parseTime(a.created_at) || 0))[0] || null;
}

function eventAfter(events: AttentionEventRow[], invoiceId: string, types: string[], after: string | null | undefined) {
  const afterTime = parseTime(after);
  if (!afterTime) return null;
  const typeSet = new Set(types);
  return events
    .filter((event) => event.invoice_id === invoiceId && typeSet.has(event.event_type))
    .filter((event) => (parseTime(event.created_at) || 0) > afterTime)
    .sort((a, b) => (parseTime(b.created_at) || 0) - (parseTime(a.created_at) || 0))[0] || null;
}

function reassignCounts(events: AttentionEventRow[]) {
  const byAssignment = new Map<string, number>();
  const byTarget = new Map<string, number>();
  for (const event of events) {
    if (event.event_type !== "assignment_reassigned") continue;
    const meta = event.metadata || {};
    const assignmentId = typeof meta.assignment_id === "string" ? meta.assignment_id : null;
    const targetType = typeof meta.target_type === "string" ? meta.target_type : null;
    const targetId = typeof meta.target_id === "string" ? meta.target_id : null;
    if (assignmentId) byAssignment.set(assignmentId, (byAssignment.get(assignmentId) || 0) + 1);
    if (targetType && targetId) {
      const key = targetKey(targetType, targetId);
      byTarget.set(key, (byTarget.get(key) || 0) + 1);
    }
  }
  return { byAssignment, byTarget };
}

function proofSeverity(ageHours: number | null): {
  priority: OperationalNotificationPriority;
  severity: OperationalNotificationSeverity;
  escalation: OperationalNotification["escalation"];
} {
  if (ageHours !== null && ageHours >= 72) {
    return {
      priority: "critical",
      severity: "escalated",
      escalation: {
        active: true,
        reason: "Proof review has waited more than 72h.",
        threshold: "pending proof >= 72h"
      }
    };
  }
  if (ageHours !== null && ageHours >= 24) {
    return {
      priority: "high",
      severity: "elevated",
      escalation: {
        active: true,
        reason: "Proof review has waited more than 24h.",
        threshold: "pending proof >= 24h"
      }
    };
  }
  return {
    priority: "normal",
    severity: "watch",
    escalation: {
      active: false,
      reason: "Proof is pending manual review.",
      threshold: "pending proof >= 24h"
    }
  };
}

function assignmentTarget(assignment: OperationalAssignmentRow): AttentionTarget {
  return {
    type: "assignment",
    id: assignment.id,
    label: assignment.target_label || `${assignment.target_type.replaceAll("_", " ")} assignment`,
    href: assignment.target_href || assignmentTargetHref(assignment.target_type, assignment.target_id)
  };
}

function notificationSection(notification: OperationalNotification, userId: string, role: WorkspaceRole): AttentionSectionKey {
  if (notification.kind === "assignment_reassigned" || notification.kind === "proof_rejected") return "recentChanges";
  if (isMine(notification, userId, role)) return "waitingOnYou";
  if (notification.escalation?.active) return "escalations";
  if (notification.kind === "assignment_stale") return "staleItems";
  if (notification.severity === "watch" && notification.kind === "invoice_expiring") return "staleItems";
  return "requiresAttention";
}

function targetInvoiceHref(invoiceId: string, anchor?: string) {
  return `/invoices/${invoiceId}${anchor ? `#${anchor}` : ""}`;
}

function normalizeProofs(input: { proofs?: AttentionProofRow[]; invoices: AttentionInvoiceRow[] }) {
  const proofMap = new Map<string, AttentionProofRow>();
  for (const proof of input.proofs || []) {
    if (proof.id) proofMap.set(proof.id, proof);
  }
  for (const invoice of input.invoices) {
    for (const proof of invoice.payment_proofs || []) {
      if (!proof.id) continue;
      if (proofMap.has(proof.id)) continue;
      proofMap.set(proof.id, {
        ...proof,
        id: proof.id,
        invoice_id: invoice.id,
        invoices: invoice
      });
    }
  }
  return [...proofMap.values()];
}

export function buildAttentionCenterModel(input: {
  userId: string;
  role: WorkspaceRole;
  invoices: AttentionInvoiceRow[];
  proofs?: AttentionProofRow[];
  assignments: OperationalAssignmentRow[];
  events: AttentionEventRow[];
  approvals?: AttentionApprovalRow[];
  members: AssignmentMemberOption[];
  now?: Date;
}): AttentionCenterModel {
  const now = input.now || new Date();
  const generatedAt = now.toISOString();
  const invoiceMap = new Map(input.invoices.map((invoice) => [invoice.id, invoice]));
  const proofRows = normalizeProofs({ proofs: input.proofs, invoices: input.invoices });
  const operationalEvents = operationalEventsOnly(input.events);
  const assignmentTargetMap = new Map<string, OperationalAssignmentRow[]>();
  for (const assignment of input.assignments) {
    const key = targetKey(assignment.target_type, assignment.target_id);
    const rows = assignmentTargetMap.get(key) || [];
    rows.push(assignment);
    assignmentTargetMap.set(key, rows);
  }
  const counts = reassignCounts(operationalEvents);
  const notifications = new Map<string, OperationalNotification>();

  for (const proof of proofRows) {
    const status = (proof.status || "").toLowerCase();
    const inv = proofInvoice(proof, invoiceMap);
    const label = invoiceLabel(inv);
    const proofHref = inv?.id ? targetInvoiceHref(inv.id, "proofs-review") : "/proofs";

    if (status === "pending") {
      const ageHours = hoursSince(proof.uploaded_at, now);
      const sev = proofSeverity(ageHours);
      const assignment = assignmentForTarget(assignmentTargetMap, "proof", proof.id, "reviewer");
      addNotification(notifications, {
        id: `proof:${proof.id}:awaiting-review`,
        kind: "proof_awaiting_review",
        bucket: "proofs",
        priority: sev.priority,
        severity: sev.severity,
        title: "Proof awaiting review",
        summary: `${label} has a client proof pending for ${ageLabel(ageHours)}.`,
        explanation: "Payment remains unconfirmed until a workspace reviewer accepts, rejects, or voids the proof.",
        ctaLabel: "Review proof",
        target: { type: "proof", id: proof.id, label, href: proofHref },
        owner: ownerFromAssignment(assignment, "reviewer", "Reviewer"),
        audienceRoles: REVIEW_ROLES,
        actionPermission: "proofs.review",
        waitingSince: proof.uploaded_at || null,
        assignmentId: assignment?.id || null,
        escalation: sev.escalation,
        evidence: [
          "payment_proofs.status = pending",
          ageHours === null ? "uploaded_at unavailable" : `uploaded ${ageLabel(ageHours)} ago`
        ]
      });
    }

    if (status === "rejected") {
      const reviewedAt = proof.reviewed_at || proof.confirmed_at || proof.uploaded_at || generatedAt;
      const ageDays = daysSince(reviewedAt, now);
      if (ageDays !== null && ageDays <= 7) {
        addNotification(notifications, {
          id: `proof:${proof.id}:rejected`,
          kind: "proof_rejected",
          bucket: "proofs",
          priority: "normal",
          severity: "watch",
          title: "Proof rejected",
          summary: `${label} had a proof rejected ${ageDays === 0 ? "today" : `${ageDays}d ago`}.`,
          explanation: "Rejected proof is a follow-through signal. Client communication stays manual and accountable.",
          ctaLabel: "Open proof",
          target: { type: "proof", id: proof.id, label, href: proofHref },
          owner: ownerFromAssignment(assignmentForTarget(assignmentTargetMap, "proof", proof.id), "operations", "Operations"),
          audienceRoles: REVIEW_ROLES,
          waitingSince: reviewedAt,
          lastActionAt: reviewedAt,
          evidence: ["payment_proofs.status = rejected", "recent rejected proof within 7d"]
        });
      }
    }
  }

  for (const assignment of input.assignments.filter((row) => isOpenAssignment(row.status))) {
    const overdue = isOverdueAssignment(assignment, now);
    const staleDays = assignmentAgeDays(assignment, now);
    const reassigned = (counts.byAssignment.get(assignment.id) || 0) + (counts.byTarget.get(targetKey(assignment.target_type, assignment.target_id)) || 0);
    const untouched = assignment.created_at === assignment.last_action_at || Math.abs((parseTime(assignment.created_at) || 0) - (parseTime(assignment.last_action_at) || 0)) < 1000;
    const owner: AttentionOwner = assignment.assigned_to_user_id
      ? { type: "user", id: assignment.assigned_to_user_id, label: formatAssignee(assignment) }
      : assignment.assigned_to_role
        ? { type: "role", role: assignment.assigned_to_role, label: formatAssignee(assignment) }
        : { type: "workspace", label: "Workspace" };

    if (overdue) {
      const overdueDays = daysSince(assignment.due_at, now) || 0;
      addNotification(notifications, {
        id: `assignment:${assignment.id}:overdue`,
        kind: "overdue_assignment",
        bucket: "assignments",
        priority: overdueDays >= 2 ? "critical" : "high",
        severity: overdueDays >= 2 ? "escalated" : "elevated",
        title: "Overdue assignment",
        summary: `${assignment.target_label || "Operational assignment"} is past due for ${formatAssignee(assignment)}.`,
        explanation: "Ownership is explicit, but the due time has passed without completion.",
        ctaLabel: "Open work item",
        target: assignmentTarget(assignment),
        owner,
        audienceRoles: ALL_ROLES,
        actionPermission: "assignments.work",
        waitingSince: assignment.created_at,
        dueAt: assignment.due_at || null,
        lastActionAt: assignment.last_action_at,
        assignmentId: assignment.id,
        escalation: {
          active: true,
          reason: overdueDays >= 2 ? "Assignment is more than 48h overdue." : "Assignment due time has passed.",
          threshold: "open assignment past due",
          startedAt: assignment.due_at || null
        },
        evidence: [
          "operational_assignments.status is open/in_progress/waiting",
          "due_at is before now",
          reassigned >= 2 ? `${reassigned} reassignments recorded` : "single owner chain"
        ]
      });
      continue;
    }

    if (staleDays >= 3 || (untouched && staleDays >= 1) || reassigned >= 2) {
      addNotification(notifications, {
        id: `assignment:${assignment.id}:stale`,
        kind: "assignment_stale",
        bucket: "assignments",
        priority: staleDays >= 7 || reassigned >= 3 ? "high" : "normal",
        severity: staleDays >= 7 || reassigned >= 3 ? "elevated" : "watch",
        title: untouched ? "Assigned but untouched" : "Assignment stale",
        summary: `${assignment.target_label || "Operational assignment"} has had no recorded movement for ${staleDays}d.`,
        explanation: reassigned >= 2
          ? "Repeated reassignment can break continuity, so this stays visible until the owner records progress or completes it."
          : "Open assignments surface when last_action_at is old enough to risk silent drift.",
        ctaLabel: "Open assignment",
        target: assignmentTarget(assignment),
        owner,
        audienceRoles: ALL_ROLES,
        actionPermission: "assignments.work",
        waitingSince: assignment.created_at,
        lastActionAt: assignment.last_action_at,
        assignmentId: assignment.id,
        escalation: {
          active: staleDays >= 7 || reassigned >= 3,
          reason: staleDays >= 7 ? "Assignment has been stale for at least 7d." : "Assignment was reassigned repeatedly.",
          threshold: "no action >= 7d or reassigned >= 3"
        },
        evidence: [
          `${staleDays}d since last assignment action`,
          untouched ? "assigned but no follow-up action recorded" : "last_action_at is older than threshold",
          reassigned ? `${reassigned} reassignment event(s)` : "no reassignment loop"
        ]
      });
    }
  }

  for (const invoice of input.invoices) {
    if (isQuoteDocument(invoice)) continue;
    const status = displayStatus(invoice);
    const proofs = rowProofs(invoice);
    const balance = getRemainingBalance(balanceInput(invoice), proofs);
    const open = !["paid", "draft", "rejected"].includes(status) && (balance.usd > 0 || balance.lbp > 0);
    const label = invoiceLabel(invoice);
    const href = targetInvoiceHref(invoice.id);

    if (open && invoice.due_date) {
      const dueDays = daysSince(invoice.due_date, now) || 0;
      const lastReminder = lastEvent(operationalEvents, invoice.id, ["reminder_copied"]);
      const lastReminderHours = hoursSince(lastReminder?.created_at, now);
      const paymentAfterReminder = eventAfter(operationalEvents, invoice.id, ["proof_accepted", "manual_payment"], lastReminder?.created_at);
      const receiptAfterReminder = eventAfter(operationalEvents, invoice.id, ["receipt_viewed"], lastReminder?.created_at);
      const pendingProof = (invoice.payment_proofs || []).some((proof) => (proof.status || "").toLowerCase() === "pending");
      const reminderFresh = lastReminderHours !== null && lastReminderHours < 48;

      if (dueDays > 0 && !pendingProof && !reminderFresh) {
        const staleReminder = lastReminderHours === null || lastReminderHours >= 96;
        const severity: OperationalNotificationSeverity = dueDays >= 14 && staleReminder ? "escalated" : dueDays >= 7 ? "elevated" : "watch";
        const priority: OperationalNotificationPriority = severity === "escalated" ? "critical" : severity === "elevated" ? "high" : "normal";
        const assignment = assignmentForTarget(assignmentTargetMap, "recovery", invoice.id, "recovery_owner");
        addNotification(notifications, {
          id: `invoice:${invoice.id}:recovery-follow-up`,
          kind: "recovery_follow_up_needed",
          bucket: "recoveries",
          priority,
          severity,
          title: "Recovery follow-up needed",
          summary: `${label} is ${dueDays}d overdue with no recent reminder copy recorded.`,
          explanation: "This is a manual follow-through prompt. Qaffel does not send client communication automatically.",
          ctaLabel: "Open recovery",
          target: { type: "invoice", id: invoice.id, label, href: targetInvoiceHref(invoice.id, "follow-up") },
          owner: ownerFromAssignment(assignment, "operations", "Operations"),
          audienceRoles: FINANCE_OPS_ROLES,
          actionPermission: "recoveries.manage",
          waitingSince: invoice.due_date,
          lastReminderAt: lastReminder?.created_at || null,
          assignmentId: assignment?.id || null,
          escalation: {
            active: severity === "escalated" || severity === "elevated",
            reason: severity === "escalated" ? "Overdue recovery is aging and reminder continuity is stale." : "Overdue recovery is past the 7d operational threshold.",
            threshold: "overdue >= 7d, escalated at >= 14d with stale reminder"
          },
          evidence: [
            `invoice due ${dueDays}d ago`,
            lastReminder ? `last reminder ${ageLabel(lastReminderHours)} ago` : "no reminder event recorded",
            "pending proof check passed before reminder prompt"
          ]
        });
      }

      if (open && lastReminder && receiptAfterReminder && !paymentAfterReminder) {
        const receiptAgeHours = hoursSince(receiptAfterReminder.created_at, now);
        if (receiptAgeHours !== null && receiptAgeHours >= 24) {
          addNotification(notifications, {
            id: `invoice:${invoice.id}:reminder-follow-through`,
            kind: "reminder_follow_up_due",
            bucket: "communication",
            priority: receiptAgeHours >= 72 ? "high" : "normal",
            severity: receiptAgeHours >= 72 ? "elevated" : "watch",
            title: "Reminder follow-through due",
            summary: `${label} was viewed after a reminder, with no payment recorded after that.`,
            explanation: "The continuity signal is based on reminder and receipt-view events only. Follow-up remains manual.",
            ctaLabel: "Open follow-up",
            target: { type: "invoice", id: invoice.id, label, href: targetInvoiceHref(invoice.id, "follow-up") },
            owner: ownerFromAssignment(assignmentForTarget(assignmentTargetMap, "client_follow_up", invoice.client_id || ""), "operations", "Operations"),
            audienceRoles: FINANCE_OPS_ROLES,
            actionPermission: "recoveries.manage",
            waitingSince: receiptAfterReminder.created_at,
            lastReminderAt: lastReminder.created_at,
            lastContactAt: lastReminder.created_at,
            escalation: {
              active: receiptAgeHours >= 72,
              reason: "Client viewed after reminder and no payment event followed for more than 72h.",
              threshold: "view after reminder without payment >= 72h"
            },
            evidence: ["reminder_copied exists", "receipt_viewed after reminder", "no proof_accepted or manual_payment after reminder"]
          });
        }
      }
    }

    if (open) {
      const createdAge = daysSince(invoice.created_at, now) || 0;
      const dueAge = invoice.due_date ? daysSince(invoice.due_date, now) || 0 : 0;
      const financeAged = dueAge >= 30 || (!invoice.due_date && createdAge >= 45);
      if (financeAged) {
        addNotification(notifications, {
          id: `finance:${invoice.id}:unresolved-balance`,
          kind: "finance_unresolved_balance",
          bucket: "payments",
          priority: dueAge >= 60 ? "critical" : "high",
          severity: dueAge >= 60 ? "escalated" : "elevated",
          title: "Aging unresolved balance",
          summary: `${label} has remained financially unresolved${dueAge ? ` for ${dueAge}d past due` : ` for ${createdAge}d since creation`}.`,
          explanation: "Finance attention is based on remaining balance age only. No adjustment is applied to the invoice.",
          ctaLabel: "Review finance state",
          target: { type: "invoice", id: invoice.id, label, href: targetInvoiceHref(invoice.id) },
          owner: { type: "role", role: "finance", label: "Finance" },
          audienceRoles: ["owner", "admin", "finance"],
          actionPermission: "reports.view",
          waitingSince: invoice.due_date || invoice.created_at || null,
          escalation: {
            active: true,
            reason: dueAge >= 60 ? "Unresolved balance is more than 60d overdue." : "Unresolved balance crossed the finance review age threshold.",
            threshold: "overdue >= 30d or undated open invoice age >= 45d"
          },
          evidence: [
            `status ${status}`,
            `remaining USD ${balance.usd}`,
            `remaining LBP ${balance.lbp}`
          ]
        });
      }

      if (status === "partial") {
        const accepted = (invoice.payment_proofs || [])
          .filter((proof) => (proof.status || "").toLowerCase() === "accepted")
          .sort((a, b) => (parseTime(b.confirmed_at || b.uploaded_at) || 0) - (parseTime(a.confirmed_at || a.uploaded_at) || 0));
        const lastAcceptedAt = accepted[0]?.confirmed_at || accepted[0]?.uploaded_at || invoice.created_at || null;
        const partialAge = daysSince(lastAcceptedAt, now) || 0;
        if (partialAge >= 7) {
          addNotification(notifications, {
            id: `finance:${invoice.id}:stale-partial`,
            kind: "stale_partial_payment",
            bucket: "payments",
            priority: partialAge >= 21 ? "high" : "normal",
            severity: partialAge >= 21 ? "elevated" : "watch",
            title: "Stale partial payment",
            summary: `${label} is still partial ${partialAge}d after the latest accepted payment.`,
            explanation: "Partial status remains visible until the remaining balance is resolved, voided, or explicitly carried forward in finance close.",
            ctaLabel: "Review partial",
            target: { type: "invoice", id: invoice.id, label, href: targetInvoiceHref(invoice.id) },
            owner: { type: "role", role: "finance", label: "Finance" },
            audienceRoles: ["owner", "admin", "finance"],
            actionPermission: "reports.view",
            waitingSince: lastAcceptedAt,
            escalation: {
              active: partialAge >= 21,
              reason: "Partial payment has remained open beyond the finance review threshold.",
              threshold: "partial payment age >= 21d"
            },
            evidence: [
              `latest accepted payment ${partialAge}d ago`,
              `remaining USD ${balance.usd}`,
              `remaining LBP ${balance.lbp}`
            ]
          });
        }
      }
    }

    const plan = parsePaymentPlan(invoice.payment_plan);
    if (open && plan) {
      const progress = paymentPlanProgress(plan);
      const next = progress.next;
      const overdueDays = next?.due_date ? daysSince(next.due_date, now) : null;
      if (next && overdueDays !== null && overdueDays > 0) {
        const severity: OperationalNotificationSeverity = overdueDays >= 10 ? "escalated" : overdueDays >= 3 ? "elevated" : "watch";
        const assignment = assignmentForTarget(assignmentTargetMap, "payment_plan", invoice.id, "payment_plan_owner");
        addNotification(notifications, {
          id: `invoice:${invoice.id}:payment-plan-overdue`,
          kind: "payment_plan_overdue",
          bucket: "payments",
          priority: severity === "escalated" ? "critical" : severity === "elevated" ? "high" : "normal",
          severity,
          title: "Payment plan milestone overdue",
          summary: `${label} has an unsatisfied milestone ${overdueDays}d past due.`,
          explanation: "Manual payment-plan milestones need explicit follow-through when the next due date passes.",
          ctaLabel: "Open payment plan",
          target: { type: "payment_plan", id: invoice.id, label, href },
          owner: ownerFromAssignment(assignment, "finance", "Finance"),
          audienceRoles: FINANCE_OPS_ROLES,
          actionPermission: "invoices.edit",
          waitingSince: next.due_date,
          assignmentId: assignment?.id || null,
          escalation: {
            active: severity !== "watch",
            reason: severity === "escalated" ? "Payment plan milestone is more than 10d overdue." : "Payment plan milestone is more than 3d overdue.",
            threshold: "unsatisfied plan milestone past due"
          },
          evidence: ["payment_plan.milestones has next unsatisfied due date", `milestone overdue ${overdueDays}d`]
        });
      }
    }

    if (open && invoice.valid_until) {
      const days = daysUntil(invoice.valid_until, now);
      if (days !== null && days >= 0 && days <= 7) {
        addNotification(notifications, {
          id: `invoice:${invoice.id}:expiring`,
          kind: "invoice_expiring",
          bucket: "payments",
          priority: days <= 1 ? "high" : "normal",
          severity: days <= 1 ? "elevated" : "watch",
          title: "Invoice payment link expiring",
          summary: `${label} payment page expires in ${days}d.`,
          explanation: "Link validity is an operational continuity signal. Extend only when you choose to keep the payment page active.",
          ctaLabel: "Extend validity",
          target: { type: "invoice", id: invoice.id, label, href: targetInvoiceHref(invoice.id, "extend-validity") },
          owner: { type: "role", role: "operations", label: "Operations" },
          audienceRoles: FINANCE_OPS_ROLES,
          actionPermission: "invoices.edit",
          waitingSince: invoice.valid_until,
          escalation: {
            active: days <= 1,
            reason: "Payment page is within 24h of expiry.",
            threshold: "valid_until <= 1d"
          },
          evidence: ["invoice.valid_until within 7d", `expires in ${days}d`]
        });
      }
    }
  }

  for (const approval of input.approvals || []) {
    if (approval.status !== "pending") continue;
    const ageHours = hoursSince(approval.created_at, now);
    const referenceInvoice = approval.reference_type === "invoice" && approval.reference_id ? invoiceMap.get(approval.reference_id) : null;
    const label = referenceInvoice ? invoiceLabel(referenceInvoice) : `${approval.type || "Approval"} request`;
    addNotification(notifications, {
      id: `approval:${approval.id}:pending`,
      kind: "approval_requested",
      bucket: "approvals",
      priority: ageHours !== null && ageHours >= 72 ? "critical" : ageHours !== null && ageHours >= 24 ? "high" : "normal",
      severity: ageHours !== null && ageHours >= 72 ? "escalated" : ageHours !== null && ageHours >= 24 ? "elevated" : "watch",
      title: "Approval requested",
      summary: `${label} is waiting for approval${ageHours !== null ? ` for ${ageLabel(ageHours)}` : ""}.`,
      explanation: "Approval notifications are internal only and resolve when the request is approved or rejected.",
      ctaLabel: "Review approval",
      target: { type: "approval", id: approval.id, label, href: "/team" },
      owner: { type: "role", role: "finance", label: "Finance" },
      audienceRoles: ["owner", "admin", "finance"],
      actionPermission: "approvals.resolve",
      waitingSince: approval.created_at,
      escalation: {
        active: ageHours !== null && ageHours >= 24,
        reason: ageHours !== null && ageHours >= 72 ? "Approval has waited more than 72h." : "Approval has waited more than 24h.",
        threshold: "pending approval >= 24h"
      },
      evidence: ["workspace_approvals.status = pending", ageHours === null ? "created_at unavailable" : `waiting ${ageLabel(ageHours)}`]
    });
  }

  for (const event of operationalEvents.slice().sort((a, b) => (parseTime(b.created_at) || 0) - (parseTime(a.created_at) || 0)).slice(0, 40)) {
    const ageDays = daysSince(event.created_at, now);
    if (ageDays !== null && ageDays > 7) continue;
    if (event.event_type !== "assignment_reassigned") continue;
    const label = invoiceLabel(invoiceMap.get(event.invoice_id));
    addNotification(notifications, {
      id: `event:${event.id || `${event.invoice_id}:${event.created_at}`}:assignment-reassigned`,
      kind: "assignment_reassigned",
      bucket: "assignments",
      priority: "low",
      severity: "routine",
      title: "Assignment reassigned",
      summary: event.message || `${label} ownership was reassigned.`,
      explanation: "Recent reassignment is shown for continuity, not as an unread alert.",
      ctaLabel: "Open invoice",
      target: { type: "invoice", id: event.invoice_id, label, href: targetInvoiceHref(event.invoice_id) },
      owner: event.actor_id ? { type: "user", id: event.actor_id, label: event.actor_name || "Teammate" } : { type: "workspace", label: "Workspace" },
      audienceRoles: ALL_ROLES,
      waitingSince: event.created_at,
      lastActionAt: event.created_at,
      evidence: ["invoice_events.event_type = assignment_reassigned"]
    });
  }

  const visible = [...notifications.values()]
    .filter((notification) => canSeeNotification(notification, input.userId, input.role))
    .sort(sortNotifications);

  const sections: Record<AttentionSectionKey, OperationalNotification[]> = {
    requiresAttention: [],
    waitingOnYou: [],
    staleItems: [],
    escalations: [],
    recentChanges: []
  };
  const assignedSectionIds = new Set<string>();
  for (const notification of visible) {
    const section = notificationSection(notification, input.userId, input.role);
    if (assignedSectionIds.has(notification.id)) continue;
    sections[section].push(notification);
    assignedSectionIds.add(notification.id);
  }
  for (const key of Object.keys(sections) as AttentionSectionKey[]) {
    sections[key].sort(sortNotifications);
  }

  const openAssignments = input.assignments.filter((assignment) => isOpenAssignment(assignment.status));
  const completedAssignments = input.assignments.filter((assignment) => assignment.status === "completed");
  const memberMap = new Map(input.members.map((member) => [member.userId, member]));
  const workload = input.members.map((member) => {
    const active = openAssignments.filter((assignment) => assignment.assigned_to_user_id === member.userId);
    const completed = completedAssignments.filter((assignment) => assignment.assigned_to_user_id === member.userId);
    return {
      ...member,
      active: active.length,
      stale: active.filter((assignment) => assignmentAgeDays(assignment, now) >= 3).length,
      overdue: active.filter((assignment) => isOverdueAssignment(assignment, now)).length,
      completed: completed.length
    };
  });
  for (const assignment of openAssignments) {
    if (!assignment.assigned_to_user_id || memberMap.has(assignment.assigned_to_user_id)) continue;
    workload.push({
      userId: assignment.assigned_to_user_id,
      name: formatAssignee(assignment),
      role: "staff",
      initials: "QA",
      active: 1,
      stale: assignmentAgeDays(assignment, now) >= 3 ? 1 : 0,
      overdue: isOverdueAssignment(assignment, now) ? 1 : 0,
      completed: 0
    });
  }
  workload.sort((a, b) => b.active - a.active || b.overdue - a.overdue || b.stale - a.stale);

  const roleQueues = (["finance", "operations", "reviewer", "admin"] as WorkspaceRole[]).map((role) => {
    const active = openAssignments.filter((assignment) => assignment.assigned_to_role === role);
    return {
      role,
      active: active.length,
      stale: active.filter((assignment) => assignmentAgeDays(assignment, now) >= 3 || isOverdueAssignment(assignment, now)).length
    };
  });

  const pendingProofs = proofRows.filter((proof) => (proof.status || "").toLowerCase() === "pending");
  const agedPendingProofs = pendingProofs.filter((proof) => {
    const h = hoursSince(proof.uploaded_at, now);
    return h !== null && h >= 24;
  });
  const remindersLast7d = operationalEvents.filter((event) => {
    if (event.event_type !== "reminder_copied") return false;
    const d = daysSince(event.created_at, now);
    return d !== null && d <= 7;
  }).length;
  const overdueWithoutRecentReminder = input.invoices.filter((invoice) => {
    if (isQuoteDocument(invoice) || !invoice.due_date) return false;
    const status = displayStatus(invoice);
    if (["paid", "draft", "rejected"].includes(status)) return false;
    const dueDays = daysSince(invoice.due_date, now) || 0;
    if (dueDays <= 0) return false;
    const lastReminder = lastEvent(operationalEvents, invoice.id, ["reminder_copied"]);
    const lastReminderHours = hoursSince(lastReminder?.created_at, now);
    return lastReminderHours === null || lastReminderHours >= 96;
  }).length;

  const canSeeTeam = MANAGER_ROLES.includes(input.role);

  return {
    generatedAt,
    role: input.role,
    userId: input.userId,
    notifications: visible,
    sections,
    counts: {
      total: visible.length,
      waitingOnYou: sections.waitingOnYou.length,
      stale: sections.staleItems.length,
      escalated: visible.filter((notification) => notification.escalation?.active).length,
      recentChanges: sections.recentChanges.length
    },
    visibility: {
      canSeeTeam,
      canResolveApprovals: hasPermission(input.role, "approvals.resolve"),
      canReviewProofs: hasPermission(input.role, "proofs.review"),
      canManageRecoveries: hasPermission(input.role, "recoveries.manage")
    },
    team: {
      workload,
      roleQueues,
      staleQueues: openAssignments.filter((assignment) => assignmentAgeDays(assignment, now) >= 3).length,
      overdueOwnership: openAssignments.filter((assignment) => isOverdueAssignment(assignment, now)).length,
      approvalBottlenecks: (input.approvals || []).filter((approval) => approval.status === "pending" && (hoursSince(approval.created_at, now) || 0) >= 24).length,
      proofReviewDelays: agedPendingProofs.length,
      recoveryAging: overdueWithoutRecentReminder
    },
    continuity: {
      pendingProofs: pendingProofs.length,
      agedPendingProofs: agedPendingProofs.length,
      overdueWithoutRecentReminder,
      remindersLast7d,
      reassignedMultipleTimes: openAssignments.filter((assignment) => (counts.byAssignment.get(assignment.id) || 0) >= 2).length
    }
  };
}
