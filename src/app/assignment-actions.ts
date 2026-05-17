"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/get-workspace";
import {
  ASSIGNMENT_NOTE_TYPES,
  ASSIGNMENT_PRIORITIES,
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TYPES,
  ASSIGNMENT_TYPE_LABELS,
  ASSIGNMENT_TARGET_LABELS,
  type AssignmentNoteType,
  type AssignmentPriority,
  type AssignmentStatus,
  type AssignmentTargetType,
  type AssignmentType,
  type OperationalAssignmentRow
} from "@/lib/assignments";
import { requirePermission, type WorkspaceRole } from "@/lib/permissions";
import { requireUser } from "@/lib/supabase/server";

const TARGET_TYPES = new Set<AssignmentTargetType>([
  "invoice",
  "proof",
  "recovery",
  "approval",
  "payment_plan",
  "client_follow_up"
]);

const ASSIGNABLE_ROLE_SET = new Set<WorkspaceRole>(["owner", "admin", "finance", "operations", "reviewer", "staff"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function normalizeDueAt(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}

function pathForAssignmentTarget(targetType: AssignmentTargetType, targetId: string, invoiceId?: string | null) {
  if (targetType === "proof") return invoiceId ? `/invoices/${invoiceId}` : "/proofs";
  if (targetType === "recovery") return invoiceId ? `/invoices/${invoiceId}` : "/recoveries";
  if (targetType === "payment_plan") return `/invoices/${targetId}`;
  if (targetType === "client_follow_up") return `/clients/${targetId}`;
  if (targetType === "approval") return "/team";
  return `/invoices/${targetId}`;
}

function parseAssignee(raw: string) {
  if (raw.startsWith("user:")) {
    const userId = raw.slice("user:".length).trim();
    return userId ? { assigned_to_user_id: userId, assigned_to_role: null as WorkspaceRole | null } : null;
  }

  if (raw.startsWith("role:")) {
    const role = raw.slice("role:".length).trim() as WorkspaceRole;
    if (!ASSIGNABLE_ROLE_SET.has(role)) return null;
    return { assigned_to_user_id: null as string | null, assigned_to_role: role };
  }

  return null;
}

async function validateAssignee(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], workspaceId: string, userId: string | null) {
  if (!userId) return;
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Assignment owner must be an active member of this workspace.");
  }
}

async function resolveAssigneeLabel(input: {
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  workspaceId: string;
  userId: string | null;
  role: WorkspaceRole | null;
}) {
  if (input.role) {
    return input.role.charAt(0).toUpperCase() + input.role.slice(1);
  }

  if (!input.userId) return "workspace";
  const { data } = await input.supabase
    .from("profiles")
    .select("full_name, business_name")
    .eq("id", input.userId)
    .maybeSingle();

  return (data as any)?.full_name || (data as any)?.business_name || "teammate";
}

async function resolveTarget(input: {
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  workspaceId: string;
  targetType: AssignmentTargetType;
  targetId: string;
}) {
  const { supabase, workspaceId, targetType, targetId } = input;

  if (targetType === "proof") {
    const { data, error } = await supabase
      .from("payment_proofs")
      .select("id, invoice_id, invoices!inner(id, workspace_id, user_id, title, invoice_number, clients(name))")
      .eq("id", targetId)
      .maybeSingle();

    if (error || !data) throw new Error("Proof was not found in this workspace.");
    const invoice = data.invoices as any;
    if (invoice?.workspace_id && invoice.workspace_id !== workspaceId) throw new Error("Proof was not found in this workspace.");
    const label = invoice?.invoice_number ? `${invoice.invoice_number} - ${invoice.title || "Invoice"}` : invoice?.title || "Payment proof";
    return {
      invoiceId: data.invoice_id as string,
      label: `Proof for ${label}`,
      href: `/invoices/${data.invoice_id}#proofs-review`,
      clientName: invoice?.clients?.name ?? null
    };
  }

  if (targetType === "client_follow_up") {
    const { data, error } = await supabase
      .from("clients")
      .select("id, workspace_id, user_id, name")
      .eq("id", targetId)
      .maybeSingle();

    if (error || !data) throw new Error("Client was not found in this workspace.");
    if ((data as any).workspace_id && (data as any).workspace_id !== workspaceId) throw new Error("Client was not found in this workspace.");
    return {
      invoiceId: null,
      label: (data as any).name || "Client follow-up",
      href: `/clients/${targetId}`,
      clientName: (data as any).name ?? null
    };
  }

  if (targetType === "approval") {
    const { data, error } = await supabase
      .from("workspace_approvals")
      .select("id, workspace_id, type, reference_id, reference_type")
      .eq("id", targetId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (error || !data) throw new Error("Approval was not found in this workspace.");
    const referenceId = (data as any).reference_id as string | null;
    const referenceType = (data as any).reference_type as string | null;
    return {
      invoiceId: referenceType === "invoice" ? referenceId : null,
      label: `${ASSIGNMENT_TARGET_LABELS.approval}: ${(data as any).type || "request"}`,
      href: "/team",
      clientName: null
    };
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("id, workspace_id, user_id, title, invoice_number, clients(name)")
    .eq("id", targetId)
    .maybeSingle();

  if (error || !data) throw new Error("Invoice was not found in this workspace.");
  if ((data as any).workspace_id && (data as any).workspace_id !== workspaceId) throw new Error("Invoice was not found in this workspace.");
  const label = (data as any).invoice_number ? `${(data as any).invoice_number} - ${(data as any).title || "Invoice"}` : (data as any).title || "Invoice";
  return {
    invoiceId: targetId,
    label,
    href: pathForAssignmentTarget(targetType, targetId, targetId),
    clientName: (data as any).clients?.name ?? null
  };
}

async function insertAssignmentEvent(input: {
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  invoiceId: string | null;
  workspaceId: string;
  userId: string;
  actorName: string;
  actorRole: WorkspaceRole;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  if (!input.invoiceId) return;
  await input.supabase.from("invoice_events").insert({
    invoice_id: input.invoiceId,
    user_id: input.userId,
    workspace_id: input.workspaceId,
    actor_id: input.userId,
    actor_name: input.actorName,
    actor_role: input.actorRole,
    event_type: input.eventType,
    message: input.message,
    metadata: input.metadata || {}
  });
}

async function getAssignmentWithTarget(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  workspaceId: string,
  assignmentId: string
) {
  const { data, error } = await supabase
    .from("operational_assignments")
    .select("*")
    .eq("id", assignmentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) throw new Error("Assignment was not found.");
  const assignment = data as OperationalAssignmentRow;
  const target = await resolveTarget({
    supabase,
    workspaceId,
    targetType: assignment.target_type,
    targetId: assignment.target_id
  });
  return { assignment, target };
}

export async function assignOperationalWorkAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "assignments.manage", "You do not have access to assign operational work.");

  const targetType = text(formData, "target_type") as AssignmentTargetType;
  const targetId = text(formData, "target_id");
  const assignmentType = text(formData, "assignment_type") as AssignmentType;
  const priority = (text(formData, "priority") || "normal") as AssignmentPriority;
  const status = (text(formData, "status") || "open") as AssignmentStatus;
  const assignee = parseAssignee(text(formData, "assignee"));
  const dueAt = normalizeDueAt(nullableText(formData, "due_at"));
  const context = nullableText(formData, "context");

  if (!TARGET_TYPES.has(targetType) || !targetId) throw new Error("Choose the work item to assign.");
  if (!ASSIGNMENT_TYPES.includes(assignmentType)) throw new Error("Choose a valid assignment type.");
  if (!ASSIGNMENT_PRIORITIES.includes(priority)) throw new Error("Choose a valid priority.");
  if (!ASSIGNMENT_STATUSES.includes(status)) throw new Error("Choose a valid status.");
  if (!assignee) throw new Error("Choose a person or team role.");

  await validateAssignee(supabase, ctx.workspaceId, assignee.assigned_to_user_id);
  const target = await resolveTarget({ supabase, workspaceId: ctx.workspaceId, targetType, targetId });

  const { data: existing, error: existingError } = await supabase
    .from("operational_assignments")
    .select("id")
    .eq("workspace_id", ctx.workspaceId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("assignment_type", assignmentType)
    .in("status", ["open", "in_progress", "waiting"])
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const payload = {
    workspace_id: ctx.workspaceId,
    target_type: targetType,
    target_id: targetId,
    assignment_type: assignmentType,
    assigned_to_user_id: assignee.assigned_to_user_id,
    assigned_to_role: assignee.assigned_to_role,
    assigned_by: ctx.userId,
    status,
    priority,
    due_at: dueAt,
    context,
    last_action_at: new Date().toISOString(),
    completed_at: status === "completed" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  const result = existing
    ? await supabase.from("operational_assignments").update(payload).eq("id", existing.id).eq("workspace_id", ctx.workspaceId).select("*").single()
    : await supabase.from("operational_assignments").insert(payload).select("*").single();

  if (result.error || !result.data) throw new Error(result.error?.message || "Assignment could not be saved.");
  const assignment = result.data as OperationalAssignmentRow;
  const assigneeName = await resolveAssigneeLabel({
    supabase,
    workspaceId: ctx.workspaceId,
    userId: assignment.assigned_to_user_id || null,
    role: assignment.assigned_to_role || null
  });
  const message = `${ASSIGNMENT_TYPE_LABELS[assignmentType]} ${existing ? "reassigned" : "assigned"}${assigneeName ? ` to ${assigneeName}` : ""}.`;

  await insertAssignmentEvent({
    supabase,
    invoiceId: target.invoiceId,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    actorName: ctx.userFullName,
    actorRole: ctx.role,
    eventType: existing ? "assignment_reassigned" : "assignment_created",
    message,
    metadata: {
      assignment_id: assignment.id,
      assignment_type: assignmentType,
      target_type: targetType,
      assigned_to_user_id: assignee.assigned_to_user_id,
      assigned_to_role: assignee.assigned_to_role,
      priority,
      status
    }
  });

  revalidatePath("/inbox");
  revalidatePath("/team");
  revalidatePath("/proofs");
  revalidatePath("/recoveries");
  revalidatePath(pathForAssignmentTarget(targetType, targetId, target.invoiceId));
}

export async function updateAssignmentStatusAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "assignments.work", "You do not have access to update assignments.");

  const assignmentId = text(formData, "assignment_id");
  const status = text(formData, "status") as AssignmentStatus;
  if (!assignmentId) throw new Error("Missing assignment.");
  if (!ASSIGNMENT_STATUSES.includes(status)) throw new Error("Choose a valid status.");

  const { assignment, target } = await getAssignmentWithTarget(supabase, ctx.workspaceId, assignmentId);
  const completedAt = status === "completed" ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("operational_assignments")
    .update({
      status,
      completed_at: completedAt,
      last_action_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", assignmentId)
    .eq("workspace_id", ctx.workspaceId);

  if (error) throw new Error(error.message);

  await insertAssignmentEvent({
    supabase,
    invoiceId: target.invoiceId,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    actorName: ctx.userFullName,
    actorRole: ctx.role,
    eventType: status === "completed" ? "assignment_completed" : "assignment_status_changed",
    message:
      status === "completed"
        ? `${ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]} completed by ${ctx.userFullName}.`
        : `${ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]} marked ${status.replaceAll("_", " ")}.`,
    metadata: {
      assignment_id: assignment.id,
      previous_status: assignment.status,
      next_status: status
    }
  });

  revalidatePath("/inbox");
  revalidatePath("/team");
  revalidatePath("/proofs");
  revalidatePath("/recoveries");
  revalidatePath(pathForAssignmentTarget(assignment.target_type, assignment.target_id, target.invoiceId));
}

export async function addAssignmentNoteAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "assignments.work", "You do not have access to add assignment notes.");

  const assignmentId = text(formData, "assignment_id");
  const noteType = (text(formData, "note_type") || "assignment") as AssignmentNoteType;
  const body = text(formData, "body");
  if (!assignmentId || !body) throw new Error("Assignment and note body are required.");
  if (!ASSIGNMENT_NOTE_TYPES.includes(noteType)) throw new Error("Choose a valid note type.");

  const { assignment, target } = await getAssignmentWithTarget(supabase, ctx.workspaceId, assignmentId);

  const { error } = await supabase.from("assignment_notes").insert({
    workspace_id: ctx.workspaceId,
    assignment_id: assignmentId,
    author_id: ctx.userId,
    note_type: noteType,
    body
  });
  if (error) throw new Error(error.message);

  await supabase
    .from("operational_assignments")
    .update({ last_action_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("workspace_id", ctx.workspaceId);

  await insertAssignmentEvent({
    supabase,
    invoiceId: target.invoiceId,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    actorName: ctx.userFullName,
    actorRole: ctx.role,
    eventType: noteType === "handoff" ? "handoff_completed" : "assignment_note_added",
    message: noteType === "handoff" ? "Internal handoff note added." : "Internal assignment note added.",
    metadata: {
      assignment_id: assignment.id,
      note_type: noteType
    }
  });

  revalidatePath("/inbox");
  revalidatePath("/team");
  revalidatePath("/proofs");
  revalidatePath("/recoveries");
  revalidatePath(pathForAssignmentTarget(assignment.target_type, assignment.target_id, target.invoiceId));
}
