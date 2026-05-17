import type { WorkspaceRole } from "@/lib/permissions";

export type AssignmentTargetType =
  | "invoice"
  | "proof"
  | "recovery"
  | "approval"
  | "payment_plan"
  | "client_follow_up";

export type AssignmentType =
  | "reviewer"
  | "recovery_owner"
  | "finance_owner"
  | "operations_owner"
  | "follow_up_owner"
  | "approval_owner"
  | "payment_plan_owner";

export type AssignmentStatus = "open" | "in_progress" | "waiting" | "completed" | "cancelled";
export type AssignmentPriority = "low" | "normal" | "high" | "urgent";
export type AssignmentNoteType = "assignment" | "handoff" | "finance" | "recovery" | "context";

export type AssignmentMemberOption = {
  userId: string;
  name: string;
  role: WorkspaceRole;
  initials: string;
};

export type AssignmentNoteRow = {
  id: string;
  assignment_id: string;
  note_type: AssignmentNoteType;
  body: string;
  created_at: string;
  author_name?: string | null;
};

export type OperationalAssignmentRow = {
  id: string;
  workspace_id: string;
  target_type: AssignmentTargetType;
  target_id: string;
  assignment_type: AssignmentType;
  assigned_to_user_id?: string | null;
  assigned_to_role?: WorkspaceRole | null;
  assigned_by?: string | null;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  due_at?: string | null;
  context?: string | null;
  last_action_at: string;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_name?: string | null;
  assigned_to_initials?: string | null;
  assigned_by_name?: string | null;
  notes?: AssignmentNoteRow[];
  note_count?: number;
  target_label?: string;
  target_href?: string;
  client_name?: string | null;
};

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  reviewer: "Reviewer",
  recovery_owner: "Recovery owner",
  finance_owner: "Finance owner",
  operations_owner: "Operations owner",
  follow_up_owner: "Follow-up owner",
  approval_owner: "Approval owner",
  payment_plan_owner: "Payment plan owner"
};

export const ASSIGNMENT_TARGET_LABELS: Record<AssignmentTargetType, string> = {
  invoice: "Invoice",
  proof: "Proof",
  recovery: "Recovery",
  approval: "Approval",
  payment_plan: "Payment plan",
  client_follow_up: "Client follow-up"
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  completed: "Completed",
  cancelled: "Cancelled"
};

export const ASSIGNMENT_PRIORITY_LABELS: Record<AssignmentPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent"
};

export const ASSIGNMENT_NOTE_TYPE_LABELS: Record<AssignmentNoteType, string> = {
  assignment: "Assignment note",
  handoff: "Handoff",
  finance: "Finance",
  recovery: "Recovery",
  context: "Context"
};

export const ASSIGNMENT_TYPES: AssignmentType[] = [
  "reviewer",
  "recovery_owner",
  "finance_owner",
  "operations_owner",
  "follow_up_owner",
  "approval_owner",
  "payment_plan_owner"
];

export const ASSIGNMENT_PRIORITIES: AssignmentPriority[] = ["low", "normal", "high", "urgent"];
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ["open", "in_progress", "waiting", "completed", "cancelled"];
export const ASSIGNMENT_NOTE_TYPES: AssignmentNoteType[] = ["assignment", "handoff", "finance", "recovery", "context"];

const ROLE_ASSIGNEE_LABELS: Partial<Record<WorkspaceRole, string>> = {
  owner: "Owner",
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  reviewer: "Reviewer",
  staff: "Staff"
};

export function initialsForName(name: string | null | undefined) {
  const clean = (name || "").trim();
  if (!clean) return "QA";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || clean.slice(0, 2).toUpperCase();
}

export function formatAssignee(assignment: Pick<OperationalAssignmentRow, "assigned_to_name" | "assigned_to_role">) {
  if (assignment.assigned_to_name) return assignment.assigned_to_name;
  if (assignment.assigned_to_role) return ROLE_ASSIGNEE_LABELS[assignment.assigned_to_role] || assignment.assigned_to_role;
  return "Unassigned";
}

export function assignmentInitials(assignment: Pick<OperationalAssignmentRow, "assigned_to_initials" | "assigned_to_name" | "assigned_to_role">) {
  if (assignment.assigned_to_initials) return assignment.assigned_to_initials;
  if (assignment.assigned_to_name) return initialsForName(assignment.assigned_to_name);
  if (assignment.assigned_to_role) return initialsForName(ROLE_ASSIGNEE_LABELS[assignment.assigned_to_role] || assignment.assigned_to_role);
  return "QA";
}

export function isOpenAssignment(status: AssignmentStatus | string | null | undefined) {
  return status === "open" || status === "in_progress" || status === "waiting";
}

export function isOverdueAssignment(assignment: Pick<OperationalAssignmentRow, "due_at" | "status">, now = new Date()) {
  if (!isOpenAssignment(assignment.status) || !assignment.due_at) return false;
  const due = new Date(assignment.due_at);
  return Number.isFinite(due.getTime()) && due.getTime() < now.getTime();
}

export function assignmentAgeDays(assignment: Pick<OperationalAssignmentRow, "last_action_at" | "created_at">, now = new Date()) {
  const stamp = assignment.last_action_at || assignment.created_at;
  const parsed = new Date(stamp).getTime();
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor((now.getTime() - parsed) / 86400000));
}

export function assignmentPriorityRank(priority: AssignmentPriority | string | null | undefined) {
  if (priority === "urgent") return 0;
  if (priority === "high") return 1;
  if (priority === "normal") return 2;
  return 3;
}

export function assignmentStatusRank(status: AssignmentStatus | string | null | undefined) {
  if (status === "waiting") return 0;
  if (status === "open") return 1;
  if (status === "in_progress") return 2;
  if (status === "completed") return 3;
  return 4;
}

export function sortAssignments(a: OperationalAssignmentRow, b: OperationalAssignmentRow) {
  const overdue = Number(isOverdueAssignment(b)) - Number(isOverdueAssignment(a));
  if (overdue !== 0) return overdue;
  const pr = assignmentPriorityRank(a.priority) - assignmentPriorityRank(b.priority);
  if (pr !== 0) return pr;
  const sr = assignmentStatusRank(a.status) - assignmentStatusRank(b.status);
  if (sr !== 0) return sr;
  const dueA = a.due_at ? new Date(a.due_at).getTime() : Number.POSITIVE_INFINITY;
  const dueB = b.due_at ? new Date(b.due_at).getTime() : Number.POSITIVE_INFINITY;
  if (dueA !== dueB) return dueA - dueB;
  return (b.last_action_at || b.created_at).localeCompare(a.last_action_at || a.created_at);
}

export function ownershipLine(assignment: OperationalAssignmentRow) {
  const assignee = formatAssignee(assignment);
  if (assignment.status === "waiting") return `Waiting for ${assignee}`;
  if (assignment.status === "completed") return `Handled by ${assignee}`;
  if (assignment.assignment_type === "recovery_owner") return `Recovery owned by ${assignee}`;
  if (assignment.assignment_type === "finance_owner") return `Assigned to ${assignee}`;
  if (assignment.assignment_type === "reviewer") return `Waiting for ${assignee}`;
  return `Handled by ${assignee}`;
}

export function assignmentTargetHref(targetType: AssignmentTargetType, targetId: string, invoiceId?: string | null) {
  if (targetType === "proof") return invoiceId ? `/invoices/${invoiceId}#proofs-review` : "/proofs";
  if (targetType === "client_follow_up") return `/clients/${targetId}`;
  if (targetType === "approval") return "/team";
  if (targetType === "recovery") return invoiceId ? `/invoices/${invoiceId}` : "/recoveries";
  return `/invoices/${targetId}`;
}

