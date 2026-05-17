import {
  assignmentTargetHref,
  formatAssignee,
  isOpenAssignment,
  ownershipLine,
  type AssignmentTargetType,
  type OperationalAssignmentRow
} from "@/lib/assignments";
import { hasPermission, ROLE_LABELS, type WorkspaceRole } from "@/lib/permissions";

export type OperationalPresenceScope =
  | "proofs"
  | "recoveries"
  | "invoices"
  | "exports"
  | "finance_close"
  | "approvals"
  | "assignments";

export type OperationalPresenceEntityType =
  | "invoice"
  | "proof"
  | "recovery"
  | "approval"
  | "export"
  | "finance_close"
  | "assignment"
  | "workspace";

export type OperationalPresenceTone = "neutral" | "review" | "recovery" | "finance" | "approval" | "complete" | "watch";

export type OperationalPresenceSignal = {
  id: string;
  scope: OperationalPresenceScope;
  entityType: OperationalPresenceEntityType;
  entityId: string;
  targetLabel: string;
  targetHref: string;
  actorName?: string | null;
  actorRole?: string | null;
  verb: string;
  detail: string;
  occurredAt: string;
  ageLabel: string;
  tone: OperationalPresenceTone;
  source: "event" | "assignment" | "approval" | "export" | "close_task" | "session";
  priority: number;
};

export type OperationalPresenceStripItem = {
  id: string;
  scope: OperationalPresenceScope;
  label: string;
  detail: string;
  href: string;
  count: number;
  tone: OperationalPresenceTone;
  actorNames: string[];
  latestAt: string;
};

export type EntityPresenceSummary = {
  entityKey: string;
  entityType: OperationalPresenceEntityType;
  entityId: string;
  targetLabel: string;
  href: string;
  primaryLine: string;
  secondaryLine: string;
  updatedAt: string;
  signals: OperationalPresenceSignal[];
  activeHandlers: string[];
};

export type ContinuityPresenceWarning = {
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: OperationalPresenceTone;
};

export type OperationalPresenceModel = {
  generatedAt: string;
  role: WorkspaceRole;
  strip: OperationalPresenceStripItem[];
  activeNow: OperationalPresenceSignal[];
  recentActivity: OperationalPresenceSignal[];
  entitySummaries: EntityPresenceSummary[];
  continuityWarnings: ContinuityPresenceWarning[];
  counts: {
    activeNow: number;
    recentActivity: number;
    activeReviewers: number;
    financeSignals: number;
    recoverySignals: number;
    ownershipSignals: number;
  };
};

export type PresenceEventRow = {
  id?: string | null;
  invoice_id?: string | null;
  event_type: string;
  message?: string | null;
  created_at: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_role?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PresenceInvoiceRow = {
  id: string;
  title?: string | null;
  invoice_number?: string | null;
  clients?: { name?: string | null } | null;
};

export type PresenceProofRow = {
  id: string;
  invoice_id?: string | null;
  invoices?: PresenceInvoiceRow | PresenceInvoiceRow[] | null;
};

export type PresenceApprovalRow = {
  id: string;
  type?: string | null;
  reference_id?: string | null;
  reference_type?: string | null;
  status: string;
  note?: string | null;
  created_at: string;
  resolved_at?: string | null;
};

export type PresenceExportRunRow = {
  id?: string | null;
  period_month?: string | null;
  export_type: string;
  title: string;
  row_count?: number | null;
  generated_by_name?: string | null;
  generated_at: string;
};

export type PresenceCloseTaskRow = {
  task_key: string;
  status: string;
  note?: string | null;
  completed_by_name?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
  period_month?: string | null;
};

export type PresenceSessionRow = {
  id?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  user_role?: string | null;
  scope: OperationalPresenceScope;
  entity_type?: OperationalPresenceEntityType | null;
  entity_id?: string | null;
  label?: string | null;
  target_href?: string | null;
  last_seen_at: string;
  expires_at: string;
};

type BuildOperationalPresenceInput = {
  userId: string;
  role: WorkspaceRole;
  invoices?: PresenceInvoiceRow[];
  proofs?: PresenceProofRow[];
  events?: PresenceEventRow[];
  assignments?: OperationalAssignmentRow[];
  approvals?: PresenceApprovalRow[];
  exportRuns?: PresenceExportRunRow[];
  closeTasks?: PresenceCloseTaskRow[];
  sessions?: PresenceSessionRow[];
  now?: Date;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const LOOKBACK_MS = 7 * DAY;
const STRIP_LOOKBACK_MS = 24 * HOUR;
const ACTIVE_SESSION_GRACE_MS = 10 * MINUTE;

const scopeLabels: Record<OperationalPresenceScope, string> = {
  proofs: "Proof review active",
  recoveries: "Recoveries being handled",
  invoices: "Invoice work active",
  exports: "Exports reviewed recently",
  finance_close: "Finance close in motion",
  approvals: "Approvals moving",
  assignments: "Ownership updates"
};

function parseTime(value?: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function byLatest(a: { occurredAt: string }, b: { occurredAt: string }) {
  return (parseTime(b.occurredAt) || 0) - (parseTime(a.occurredAt) || 0);
}

function ageLabel(value: string, now: Date) {
  const time = parseTime(value);
  if (time === null) return "time not recorded";
  const diff = Math.max(0, now.getTime() - time);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MINUTE))}m ago`;
  if (diff < DAY) return `${Math.max(1, Math.floor(diff / HOUR))}h ago`;
  if (diff < 2 * DAY) return "yesterday";
  return `${Math.max(2, Math.floor(diff / DAY))}d ago`;
}

function roleLabel(role?: string | null) {
  if (!role) return null;
  return ROLE_LABELS[role as WorkspaceRole] || role;
}

function canSeeScope(role: WorkspaceRole, scope: OperationalPresenceScope) {
  if (scope === "proofs") return hasPermission(role, "proofs.view");
  if (scope === "recoveries") return hasPermission(role, "recoveries.view");
  if (scope === "invoices") return hasPermission(role, "invoices.view");
  if (scope === "assignments") return hasPermission(role, "assignments.view");
  if (scope === "approvals") return hasPermission(role, "approvals.request") || hasPermission(role, "approvals.resolve");
  if (scope === "exports") return hasPermission(role, "exports.download") || hasPermission(role, "reports.view");
  if (scope === "finance_close") return hasPermission(role, "reports.view");
  return false;
}

function invoiceLabel(invoice: PresenceInvoiceRow | null | undefined) {
  if (!invoice) return "Invoice";
  const title = invoice.title || "Invoice";
  return invoice.invoice_number ? `${invoice.invoice_number} - ${title}` : title;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function targetHref(entityType: OperationalPresenceEntityType, entityId: string) {
  if (entityType === "invoice" || entityType === "recovery") return `/invoices/${entityId}`;
  if (entityType === "proof") return "/proofs";
  if (entityType === "approval") return "/team";
  if (entityType === "export") return "/export";
  if (entityType === "finance_close") return "/finance";
  return "/inbox";
}

function eventSpec(eventType: string): {
  scope: OperationalPresenceScope;
  entityType: OperationalPresenceEntityType;
  verb: string;
  detail: string;
  tone: OperationalPresenceTone;
  priority: number;
} | null {
  switch (eventType) {
    case "proof_uploaded":
      return {
        scope: "proofs",
        entityType: "invoice",
        verb: "Proof uploaded",
        detail: "Payment proof is waiting for review.",
        tone: "review",
        priority: 2
      };
    case "proof_accepted":
      return {
        scope: "proofs",
        entityType: "invoice",
        verb: "Proof accepted",
        detail: "Payment proof was reviewed and accepted.",
        tone: "complete",
        priority: 3
      };
    case "proof_rejected":
      return {
        scope: "proofs",
        entityType: "invoice",
        verb: "Proof rejected",
        detail: "Payment proof was reviewed and needs follow-through.",
        tone: "watch",
        priority: 1
      };
    case "manual_payment":
      return {
        scope: "finance_close",
        entityType: "invoice",
        verb: "Manual payment recorded",
        detail: "Finance-impacting payment activity was recorded.",
        tone: "finance",
        priority: 2
      };
    case "payment_voided":
      return {
        scope: "finance_close",
        entityType: "invoice",
        verb: "Payment voided",
        detail: "Voided payment remains visible for finance review.",
        tone: "finance",
        priority: 1
      };
    case "reminder_copied":
      return {
        scope: "recoveries",
        entityType: "recovery",
        verb: "Reminder prepared",
        detail: "Follow-up continuity was recorded without automatic outreach.",
        tone: "recovery",
        priority: 2
      };
    case "assignment_created":
      return {
        scope: "assignments",
        entityType: "assignment",
        verb: "Assignment created",
        detail: "Ownership was added for an operational item.",
        tone: "neutral",
        priority: 3
      };
    case "assignment_reassigned":
      return {
        scope: "assignments",
        entityType: "assignment",
        verb: "Assignment reassigned",
        detail: "Ownership changed recently.",
        tone: "watch",
        priority: 1
      };
    case "assignment_status_changed":
      return {
        scope: "assignments",
        entityType: "assignment",
        verb: "Assignment updated",
        detail: "Assignment status changed.",
        tone: "neutral",
        priority: 3
      };
    case "assignment_completed":
    case "handoff_completed":
      return {
        scope: "assignments",
        entityType: "assignment",
        verb: "Handoff completed",
        detail: "Operational continuity was closed out.",
        tone: "complete",
        priority: 3
      };
    case "assignment_note_added":
      return {
        scope: "assignments",
        entityType: "assignment",
        verb: "Context note added",
        detail: "Operational context was recorded for continuity.",
        tone: "neutral",
        priority: 4
      };
    case "payment_plan_updated":
    case "payment_plan_saved":
    case "payment_plan_cleared":
    case "payment_plan_milestone_updated":
      return {
        scope: "finance_close",
        entityType: "invoice",
        verb: "Payment plan updated",
        detail: "Payment-plan continuity changed.",
        tone: "finance",
        priority: 2
      };
    case "deposit_requested":
    case "deposit_satisfied":
      return {
        scope: "finance_close",
        entityType: "invoice",
        verb: eventType === "deposit_satisfied" ? "Deposit satisfied" : "Deposit requested",
        detail: "Deposit state changed for finance review.",
        tone: "finance",
        priority: 2
      };
    default:
      return null;
  }
}

function scopeForAssignment(assignment: OperationalAssignmentRow): OperationalPresenceScope {
  if (assignment.assignment_type === "reviewer" || assignment.target_type === "proof") return "proofs";
  if (assignment.assignment_type === "recovery_owner" || assignment.assignment_type === "follow_up_owner") return "recoveries";
  if (assignment.assignment_type === "finance_owner" || assignment.assignment_type === "payment_plan_owner") return "finance_close";
  if (assignment.assignment_type === "approval_owner" || assignment.target_type === "approval") return "approvals";
  if (assignment.target_type === "invoice") return "invoices";
  return "assignments";
}

function entityTypeForAssignment(targetType: AssignmentTargetType): OperationalPresenceEntityType {
  if (targetType === "client_follow_up") return "recovery";
  if (targetType === "payment_plan") return "invoice";
  return targetType;
}

function assignmentTone(scope: OperationalPresenceScope): OperationalPresenceTone {
  if (scope === "proofs") return "review";
  if (scope === "recoveries") return "recovery";
  if (scope === "finance_close") return "finance";
  if (scope === "approvals") return "approval";
  return "neutral";
}

function addSignal(
  signals: Map<string, OperationalPresenceSignal>,
  signal: Omit<OperationalPresenceSignal, "ageLabel">,
  now: Date,
  role: WorkspaceRole
) {
  if (!canSeeScope(role, signal.scope)) return;
  const time = parseTime(signal.occurredAt);
  if (time === null) return;
  if (now.getTime() - time > LOOKBACK_MS) return;

  const existing = signals.get(signal.id);
  const withAge = { ...signal, ageLabel: ageLabel(signal.occurredAt, now) };
  if (!existing || (parseTime(withAge.occurredAt) || 0) > (parseTime(existing.occurredAt) || 0)) {
    signals.set(signal.id, withAge);
  }
}

function buildStrip(signals: OperationalPresenceSignal[], now: Date) {
  const byScope = new Map<OperationalPresenceScope, OperationalPresenceSignal[]>();
  for (const signal of signals) {
    const time = parseTime(signal.occurredAt);
    if (time === null || now.getTime() - time > STRIP_LOOKBACK_MS) continue;
    const list = byScope.get(signal.scope) || [];
    list.push(signal);
    byScope.set(signal.scope, list);
  }

  return [...byScope.entries()]
    .map(([scope, list]) => {
      const sorted = list.sort(byLatest);
      const latest = sorted[0];
      const actorNames = Array.from(new Set(sorted.map((signal) => signal.actorName).filter(Boolean) as string[])).slice(0, 3);
      return {
        id: `strip:${scope}`,
        scope,
        label: scopeLabels[scope],
        detail: actorNames.length > 0 ? `${actorNames.join(", ")} - ${latest.targetLabel}` : latest.targetLabel,
        href: latest.targetHref,
        count: sorted.length,
        tone: latest.tone,
        actorNames,
        latestAt: latest.occurredAt
      };
    })
    .sort((a, b) => {
      const priority = (b.count > 0 ? 0 : 1) - (a.count > 0 ? 0 : 1);
      if (priority !== 0) return priority;
      return (parseTime(b.latestAt) || 0) - (parseTime(a.latestAt) || 0);
    })
    .slice(0, 6);
}

function buildEntitySummaries(signals: OperationalPresenceSignal[], assignments: OperationalAssignmentRow[]) {
  const byEntity = new Map<string, OperationalPresenceSignal[]>();
  for (const signal of signals) {
    if (signal.entityType === "workspace") continue;
    const key = `${signal.entityType}:${signal.entityId}`;
    const list = byEntity.get(key) || [];
    list.push(signal);
    byEntity.set(key, list);
  }

  const openAssignmentHandlers = new Map<string, string[]>();
  for (const assignment of assignments) {
    if (!isOpenAssignment(assignment.status)) continue;
    const entityType = entityTypeForAssignment(assignment.target_type);
    const key = `${entityType}:${assignment.target_id}`;
    const list = openAssignmentHandlers.get(key) || [];
    list.push(formatAssignee(assignment));
    openAssignmentHandlers.set(key, Array.from(new Set(list)));
  }

  return [...byEntity.entries()]
    .map(([key, list]) => {
      const sorted = list.sort(byLatest);
      const latest = sorted[0];
      const actor = latest.actorName || roleLabel(latest.actorRole);
      return {
        entityKey: key,
        entityType: latest.entityType,
        entityId: latest.entityId,
        targetLabel: latest.targetLabel,
        href: latest.targetHref,
        primaryLine: `${latest.verb}${actor ? ` by ${actor}` : ""} ${latest.ageLabel}`,
        secondaryLine: latest.detail,
        updatedAt: latest.occurredAt,
        signals: sorted.slice(0, 3),
        activeHandlers: openAssignmentHandlers.get(key) || []
      };
    })
    .sort((a, b) => (parseTime(b.updatedAt) || 0) - (parseTime(a.updatedAt) || 0))
    .slice(0, 80);
}

function buildContinuityWarnings(assignments: OperationalAssignmentRow[], signals: OperationalPresenceSignal[], role: WorkspaceRole, now: Date) {
  if (!canSeeScope(role, "assignments")) return [];

  const warnings: ContinuityPresenceWarning[] = [];
  const byTarget = new Map<string, OperationalAssignmentRow[]>();
  for (const assignment of assignments.filter((assignment) => isOpenAssignment(assignment.status))) {
    const key = `${assignment.target_type}:${assignment.target_id}`;
    const list = byTarget.get(key) || [];
    list.push(assignment);
    byTarget.set(key, list);
  }

  for (const [key, list] of byTarget.entries()) {
    const assignees = Array.from(new Set(list.map((assignment) => formatAssignee(assignment))));
    if (assignees.length <= 1 || list.length <= 1) continue;
    const latest = list.sort((a, b) => (parseTime(b.last_action_at) || 0) - (parseTime(a.last_action_at) || 0))[0];
    warnings.push({
      id: `overlap:${key}`,
      title: "Multiple handlers visible",
      detail: `${assignees.slice(0, 3).join(", ")} are attached to ${latest.target_label || key}.`,
      href: latest.target_href || assignmentTargetHref(latest.target_type, latest.target_id),
      tone: "watch"
    });
  }

  for (const assignment of assignments) {
    if (assignment.status !== "in_progress") continue;
    const time = parseTime(assignment.last_action_at || assignment.updated_at);
    if (time === null || now.getTime() - time > 2 * HOUR) continue;
    warnings.push({
      id: `handling:${assignment.id}`,
      title: "Handler active recently",
      detail: `${formatAssignee(assignment)} is handling ${assignment.target_label || assignment.target_type}.`,
      href: assignment.target_href || assignmentTargetHref(assignment.target_type, assignment.target_id),
      tone: assignmentTone(scopeForAssignment(assignment))
    });
  }

  for (const signal of signals) {
    if (signal.verb !== "Assignment reassigned") continue;
    const time = parseTime(signal.occurredAt);
    if (time === null || now.getTime() - time > DAY) continue;
    warnings.push({
      id: `reassigned:${signal.id}`,
      title: "Ownership changed recently",
      detail: `${signal.targetLabel} was reassigned ${signal.ageLabel}.`,
      href: signal.targetHref,
      tone: "watch"
    });
  }

  return warnings.slice(0, 8);
}

export function buildOperationalPresenceModel(input: BuildOperationalPresenceInput): OperationalPresenceModel {
  const now = input.now || new Date();
  const signals = new Map<string, OperationalPresenceSignal>();
  const invoiceMap = new Map((input.invoices || []).map((invoice) => [invoice.id, invoice]));
  const proofMap = new Map((input.proofs || []).map((proof) => [proof.id, proof]));

  for (const event of input.events || []) {
    const spec = eventSpec(event.event_type);
    if (!spec) continue;
    const invoiceId = event.invoice_id || metadataString(event.metadata, "invoice_id") || "";
    const invoice = invoiceId ? invoiceMap.get(invoiceId) : null;
    const entityId = invoiceId || metadataString(event.metadata, "target_id") || event.id || event.created_at;
    const label = metadataString(event.metadata, "target_label") || invoiceLabel(invoice);
    const href = invoiceId ? `/invoices/${invoiceId}` : targetHref(spec.entityType, entityId);
    addSignal(
      signals,
      {
        id: `event:${event.id || `${entityId}:${event.event_type}:${event.created_at}`}`,
        scope: spec.scope,
        entityType: spec.entityType,
        entityId,
        targetLabel: label,
        targetHref: href,
        actorName: event.actor_name || null,
        actorRole: event.actor_role || null,
        verb: spec.verb,
        detail: event.message || spec.detail,
        occurredAt: event.created_at,
        tone: spec.tone,
        source: "event",
        priority: spec.priority
      },
      now,
      input.role
    );
  }

  for (const assignment of input.assignments || []) {
    if (!isOpenAssignment(assignment.status) && assignment.status !== "completed") continue;
    const scope = scopeForAssignment(assignment);
    const entityType = entityTypeForAssignment(assignment.target_type);
    const proof = assignment.target_type === "proof" ? proofMap.get(assignment.target_id) : null;
    const proofInvoice = one(proof?.invoices);
    const invoiceId = proof?.invoice_id || proofInvoice?.id || (assignment.target_type === "invoice" ? assignment.target_id : null);
    const entityId = entityType === "invoice" && invoiceId ? invoiceId : assignment.target_id;
    const label = assignment.target_label || (invoiceId ? invoiceLabel(invoiceMap.get(invoiceId) || proofInvoice) : assignment.target_type);
    const href = assignment.target_href || assignmentTargetHref(assignment.target_type, assignment.target_id, invoiceId);
    const assignee = formatAssignee(assignment);
    const statusVerb = assignment.status === "completed" ? "Completed" : assignment.status === "in_progress" ? "Handling" : "Assigned";
    addSignal(
      signals,
      {
        id: `assignment:${assignment.id}`,
        scope,
        entityType,
        entityId,
        targetLabel: label,
        targetHref: href,
        actorName: assignee,
        actorRole: assignment.assigned_to_role || null,
        verb: statusVerb,
        detail: ownershipLine(assignment),
        occurredAt: assignment.last_action_at || assignment.updated_at || assignment.created_at,
        tone: assignment.status === "completed" ? "complete" : assignmentTone(scope),
        source: "assignment",
        priority: assignment.status === "in_progress" ? 0 : 2
      },
      now,
      input.role
    );
  }

  for (const approval of input.approvals || []) {
    const occurredAt = approval.resolved_at || approval.created_at;
    const referenceId = approval.reference_id || approval.id;
    addSignal(
      signals,
      {
        id: `approval:${approval.id}:${approval.status}`,
        scope: "approvals",
        entityType: "approval",
        entityId: approval.id,
        targetLabel: `${approval.type || "Approval"} ${approval.status}`,
        targetHref: approval.reference_type === "invoice" && approval.reference_id ? `/invoices/${approval.reference_id}` : "/team",
        actorName: null,
        actorRole: null,
        verb: approval.status === "pending" ? "Approval waiting" : "Approval resolved",
        detail: approval.note || `Approval state is ${approval.status}.`,
        occurredAt,
        tone: approval.status === "pending" ? "approval" : "complete",
        source: "approval",
        priority: approval.status === "pending" ? 1 : 3
      },
      now,
      input.role
    );

    if (approval.reference_type === "invoice" && approval.reference_id) {
      const invoice = invoiceMap.get(referenceId);
      addSignal(
        signals,
        {
          id: `approval-entity:${approval.id}:${approval.status}`,
          scope: "approvals",
          entityType: "invoice",
          entityId: referenceId,
          targetLabel: invoiceLabel(invoice),
          targetHref: `/invoices/${referenceId}`,
          actorName: null,
          actorRole: null,
          verb: approval.status === "pending" ? "Approval waiting" : "Approval resolved",
          detail: approval.note || `Approval state is ${approval.status}.`,
          occurredAt,
          tone: approval.status === "pending" ? "approval" : "complete",
          source: "approval",
          priority: approval.status === "pending" ? 1 : 3
        },
        now,
        input.role
      );
    }
  }

  for (const run of input.exportRuns || []) {
    addSignal(
      signals,
      {
        id: `export:${run.id || `${run.export_type}:${run.generated_at}`}`,
        scope: "exports",
        entityType: "export",
        entityId: run.id || run.export_type,
        targetLabel: run.title,
        targetHref: "/export",
        actorName: run.generated_by_name || null,
        actorRole: "finance",
        verb: "Export generated",
        detail: `${Number(run.row_count || 0).toLocaleString()} rows prepared manually.`,
        occurredAt: run.generated_at,
        tone: "finance",
        source: "export",
        priority: 2
      },
      now,
      input.role
    );
  }

  for (const task of input.closeTasks || []) {
    const occurredAt = task.completed_at || task.updated_at;
    if (!occurredAt) continue;
    addSignal(
      signals,
      {
        id: `close-task:${task.period_month || "current"}:${task.task_key}`,
        scope: "finance_close",
        entityType: "finance_close",
        entityId: `${task.period_month || "current"}:${task.task_key}`,
        targetLabel: task.task_key.replaceAll("_", " "),
        targetHref: task.period_month ? `/finance?m=${encodeURIComponent(task.period_month)}` : "/finance",
        actorName: task.completed_by_name || null,
        actorRole: "finance",
        verb: task.status === "completed" ? "Close task completed" : "Close task updated",
        detail: task.note || `Task is ${task.status}.`,
        occurredAt,
        tone: task.status === "completed" ? "complete" : "finance",
        source: "close_task",
        priority: task.status === "completed" ? 3 : 2
      },
      now,
      input.role
    );
  }

  for (const session of input.sessions || []) {
    const expiresAt = parseTime(session.expires_at);
    const lastSeen = parseTime(session.last_seen_at);
    if (expiresAt === null || lastSeen === null) continue;
    if (expiresAt + ACTIVE_SESSION_GRACE_MS < now.getTime()) continue;
    const entityType = session.entity_type || "workspace";
    const entityId = session.entity_id || session.user_id || session.scope;
    addSignal(
      signals,
      {
        id: `session:${session.id || `${session.user_id}:${session.scope}:${entityId}`}`,
        scope: session.scope,
        entityType,
        entityId,
        targetLabel: session.label || scopeLabels[session.scope],
        targetHref: session.target_href || targetHref(entityType, entityId),
        actorName: session.user_name || "Workspace member",
        actorRole: session.user_role || null,
        verb: "Active recently",
        detail: "Lightweight operational presence. No chat or typing state.",
        occurredAt: session.last_seen_at,
        tone: assignmentTone(session.scope),
        source: "session",
        priority: 0
      },
      now,
      input.role
    );
  }

  const sortedSignals = [...signals.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return byLatest(a, b);
  });
  const latestSignals = [...signals.values()].sort(byLatest);
  const activeNow = latestSignals
    .filter((signal) => signal.source === "session" || (parseTime(signal.occurredAt) || 0) >= now.getTime() - 2 * HOUR)
    .slice(0, 8);
  const recentActivity = latestSignals.slice(0, 12);
  const assignments = input.assignments || [];

  return {
    generatedAt: now.toISOString(),
    role: input.role,
    strip: buildStrip(sortedSignals, now),
    activeNow,
    recentActivity,
    entitySummaries: buildEntitySummaries(latestSignals, assignments),
    continuityWarnings: buildContinuityWarnings(assignments, latestSignals, input.role, now),
    counts: {
      activeNow: activeNow.length,
      recentActivity: recentActivity.length,
      activeReviewers: latestSignals.filter((signal) => signal.scope === "proofs" && (parseTime(signal.occurredAt) || 0) >= now.getTime() - DAY).length,
      financeSignals: latestSignals.filter((signal) => signal.scope === "finance_close" || signal.scope === "exports").length,
      recoverySignals: latestSignals.filter((signal) => signal.scope === "recoveries").length,
      ownershipSignals: latestSignals.filter((signal) => signal.scope === "assignments").length
    }
  };
}
