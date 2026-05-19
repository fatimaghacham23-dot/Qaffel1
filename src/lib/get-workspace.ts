import { cache } from "react";
import { createClient, requireUser } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/lib/permissions";

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userFullName: string;
  role: WorkspaceRole;
};

/**
 * Resolve the current user's workspace context.
 * Uses React `cache()` to deduplicate within a single request.
 *
 * For solo users, workspace_id === user_id (set during signup).
 * For team members, we return the first active workspace membership.
 *
 * Future: support switching between multiple workspaces.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const { supabase, user } = await requireUser();

  // Get the user's active workspace membership
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select(`
      workspace_id,
      role,
      workspaces!inner ( name )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !membership) {
    // Fallback for users who haven't been migrated yet:
    // Their workspace_id is their user_id (from the backfill)
    return {
      workspaceId: user.id,
      workspaceName: user.user_metadata?.business_name ?? "My Workspace",
      userId: user.id,
      userFullName: user.user_metadata?.full_name ?? "Unknown",
      role: "owner",
    };
  }

  const ws = membership.workspaces as unknown as { name: string };

  return {
    workspaceId: membership.workspace_id,
    workspaceName: ws?.name ?? "Workspace",
    userId: user.id,
    userFullName: user.user_metadata?.full_name ?? "Unknown",
    role: membership.role as WorkspaceRole,
  };
});

/**
 * Lightweight version that only checks if the user is authenticated.
 * Does NOT require workspace membership.
 * Use for public-adjacent pages or migration states.
 */
export const getOptionalWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  if (!user) return null;

  try {
    return await getWorkspaceContext();
  } catch {
    return null;
  }
});
