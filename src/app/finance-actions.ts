"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/get-workspace";
import {
  FINANCE_CLOSE_TASKS,
  type FinanceCloseStatus,
  type FinanceCloseTaskKey,
  type FinanceCloseTaskStatus
} from "@/lib/finance-closing";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { requireUser } from "@/lib/supabase/server";

const TASK_KEYS = new Set<FinanceCloseTaskKey>(FINANCE_CLOSE_TASKS.map((task) => task.key));
const TASK_STATUSES = new Set<FinanceCloseTaskStatus>(["open", "completed", "skipped"]);
const CLOSE_STATUSES = new Set<FinanceCloseStatus>(["draft", "in_review", "signed_off", "reopened"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function periodMonth(formData: FormData) {
  const value = text(formData, "period_month");
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error("Choose a valid close month.");
  return value;
}

function requireFinanceAccess(role: Parameters<typeof hasPermission>[0]) {
  if (!hasPermission(role, "exports.finance") && !hasPermission(role, "reports.view")) {
    throw new Error("You do not have access to finance close workflows.");
  }
}

async function ensureFinanceClosePeriod(input: {
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  workspaceId: string;
  userId: string;
  period: string;
}) {
  const { data: existing, error: findError } = await input.supabase
    .from("finance_close_periods")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("period_month", input.period)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing?.id) return existing.id as string;

  const { data, error } = await input.supabase
    .from("finance_close_periods")
    .insert({
      workspace_id: input.workspaceId,
      period_month: input.period,
      status: "draft",
      created_by: input.userId,
      updated_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Could not create finance close period.");
  return data.id as string;
}

export async function updateFinanceCloseTaskAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requireFinanceAccess(ctx.role);

  const period = periodMonth(formData);
  const taskKey = text(formData, "task_key") as FinanceCloseTaskKey;
  const status = (text(formData, "status") || "open") as FinanceCloseTaskStatus;
  const note = text(formData, "note") || null;

  if (!TASK_KEYS.has(taskKey)) throw new Error("Choose a valid close task.");
  if (!TASK_STATUSES.has(status)) throw new Error("Choose a valid task status.");

  await ensureFinanceClosePeriod({
    supabase,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    period
  });

  const completed = status === "completed";
  const { error } = await supabase.from("finance_close_tasks").upsert(
    {
      workspace_id: ctx.workspaceId,
      period_month: period,
      task_key: taskKey,
      status,
      note,
      completed_by: completed ? ctx.userId : null,
      completed_by_name: completed ? ctx.userFullName : null,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "workspace_id,period_month,task_key" }
  );

  if (error) throw new Error(error.message);
  revalidatePath("/finance");
}

export async function updateFinanceCloseStatusAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "exports.finance", "Only finance-capable roles can update finance close signoff.");

  const period = periodMonth(formData);
  const status = text(formData, "status") as FinanceCloseStatus;
  const notes = text(formData, "notes") || null;

  if (!CLOSE_STATUSES.has(status)) throw new Error("Choose a valid close status.");
  const periodId = await ensureFinanceClosePeriod({
    supabase,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    period
  });

  const signedOff = status === "signed_off";
  const { error } = await supabase
    .from("finance_close_periods")
    .update({
      status,
      notes,
      signed_off_by: signedOff ? ctx.userId : null,
      signed_off_by_name: signedOff ? ctx.userFullName : null,
      signed_off_at: signedOff ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", periodId)
    .eq("workspace_id", ctx.workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/finance");
}

export async function recordFinanceExportRunAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "exports.finance", "Only finance-capable roles can record finance exports.");

  const period = periodMonth(formData);
  const exportType = text(formData, "export_type");
  const title = text(formData, "title") || "Finance export";
  const rowCount = Number(text(formData, "row_count") || 0);

  if (!exportType) throw new Error("Missing export type.");

  await ensureFinanceClosePeriod({
    supabase,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    period
  });

  const { error } = await supabase.from("finance_export_runs").insert({
    workspace_id: ctx.workspaceId,
    period_month: period,
    export_type: exportType,
    title,
    row_count: Number.isFinite(rowCount) ? rowCount : 0,
    generated_by: ctx.userId,
    generated_by_name: ctx.userFullName
  });

  if (error) throw new Error(error.message);
  revalidatePath("/finance");
}

