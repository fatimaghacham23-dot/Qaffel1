import "server-only";
import type { Permission, WorkspaceRole } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions";

export type ActiveWorkspaceMembership = {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces?:
    | { name?: string | null; owner_id?: string | null }
    | { name?: string | null; owner_id?: string | null }[]
    | null;
};

export type AuthorizedWorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  workspaceOwnerId: string;
  userId: string;
  userFullName: string;
  role: WorkspaceRole;
};

type AuthenticatedUserIdentity = {
  id: string;
  user_metadata?: {
    full_name?: string | null;
  } | null;
};

function firstWorkspace(
  value: ActiveWorkspaceMembership["workspaces"]
): { name?: string | null; owner_id?: string | null } | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Convert an active persisted membership into request authorization context.
 *
 * Deliberately fail closed when membership is absent. Migration
 * 20260515200000_workspaces_team.sql backfills owner memberships, so treating an
 * arbitrary authenticated user as an owner would bypass the durable role model.
 */
export function workspaceContextFromMembership(
  user: AuthenticatedUserIdentity,
  membership: ActiveWorkspaceMembership | null | undefined
): AuthorizedWorkspaceContext {
  if (!membership?.workspace_id || !membership.role) {
    throw new Error("No active workspace membership was found for this account.");
  }

  const workspace = firstWorkspace(membership.workspaces);
  if (!workspace?.owner_id) {
    throw new Error("The active workspace owner could not be verified.");
  }
  return {
    workspaceId: membership.workspace_id,
    workspaceName: workspace?.name?.trim() || "Workspace",
    workspaceOwnerId: workspace.owner_id,
    userId: user.id,
    userFullName: user.user_metadata?.full_name?.trim() || "Unknown",
    role: membership.role
  };
}

export function requireWorkspaceCapability(
  context: AuthorizedWorkspaceContext,
  permission: Permission,
  message?: string
) {
  requirePermission(context.role, permission, message);
  return context;
}

export function assertResourceInWorkspace<T extends { workspace_id?: string | null }>(
  resource: T | null | undefined,
  workspaceId: string,
  message = "Record not found or access denied."
): asserts resource is T {
  if (!resource || resource.workspace_id !== workspaceId) {
    throw new Error(message);
  }
}
