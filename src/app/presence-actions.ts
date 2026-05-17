"use server";

import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/supabase/server";
import type { OperationalPresenceEntityType, OperationalPresenceScope } from "@/lib/operational-presence";

const SCOPES = new Set<OperationalPresenceScope>([
  "proofs",
  "recoveries",
  "invoices",
  "exports",
  "finance_close",
  "approvals",
  "assignments"
]);

const ENTITY_TYPES = new Set<OperationalPresenceEntityType>([
  "invoice",
  "proof",
  "recovery",
  "approval",
  "export",
  "finance_close",
  "assignment",
  "workspace"
]);

type RecordOperationalPresenceInput = {
  scope: OperationalPresenceScope;
  entityType?: OperationalPresenceEntityType;
  entityId?: string;
  label?: string;
  targetHref?: string;
};

function canRecordScope(role: Parameters<typeof hasPermission>[0], scope: OperationalPresenceScope) {
  if (scope === "proofs") return hasPermission(role, "proofs.view");
  if (scope === "recoveries") return hasPermission(role, "recoveries.view");
  if (scope === "invoices") return hasPermission(role, "invoices.view");
  if (scope === "assignments") return hasPermission(role, "assignments.view");
  if (scope === "approvals") return hasPermission(role, "approvals.request") || hasPermission(role, "approvals.resolve");
  if (scope === "exports") return hasPermission(role, "exports.download") || hasPermission(role, "reports.view");
  if (scope === "finance_close") return hasPermission(role, "reports.view");
  return false;
}

function cleanText(value: string | undefined, fallback: string, max = 120) {
  const text = (value || "").trim();
  return (text || fallback).slice(0, max);
}

function cleanHref(value: string | undefined, fallback: string) {
  const text = (value || "").trim();
  if (!text.startsWith("/") || text.startsWith("//")) return fallback;
  return text.slice(0, 180);
}

export async function recordOperationalPresenceAction(input: RecordOperationalPresenceInput) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();

  if (!SCOPES.has(input.scope) || !canRecordScope(ctx.role, input.scope)) {
    throw new Error("You do not have access to record presence for this workspace area.");
  }

  const entityType = input.entityType && ENTITY_TYPES.has(input.entityType) ? input.entityType : "workspace";
  const entityId = cleanText(input.entityId, "workspace", 80);
  const targetHref = cleanHref(input.targetHref, input.scope === "finance_close" ? "/finance" : "/inbox");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 60_000);
  const presenceKey = `${input.scope}:${entityType}:${entityId}`;

  const { error } = await supabase.from("operational_presence_sessions").upsert(
    {
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      user_name: ctx.userFullName,
      user_role: ctx.role,
      scope: input.scope,
      presence_key: presenceKey,
      entity_type: entityType,
      entity_id: entityId,
      label: cleanText(input.label, input.scope.replaceAll("_", " "), 140),
      target_href: targetHref,
      last_seen_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString()
    },
    { onConflict: "workspace_id,user_id,presence_key" }
  );

  if (error) throw new Error(error.message);
}
