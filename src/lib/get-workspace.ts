import { cache } from "react";
import { createClient, requireUser } from "@/lib/supabase/server";
import {
  workspaceContextFromMembership,
  type AuthorizedWorkspaceContext
} from "@/lib/workspace-authorization";

export type WorkspaceContext = AuthorizedWorkspaceContext;

/**
 * Resolve the current user's workspace context from an active persisted
 * membership. The workspace migration backfills owner memberships, therefore
 * absence is an authorization failure rather than an implicit owner fallback.
 *
 * Future: support an explicit, validated workspace selection when users can
 * belong to more than one workspace.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const { supabase, user } = await requireUser();
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select(`
      workspace_id,
      role,
      workspaces!inner ( name, owner_id )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Workspace membership could not be verified.");
  }

  return workspaceContextFromMembership(user, membership);
});

/**
 * Lightweight authenticated context for public-adjacent or setup pages.
 * Missing membership returns null and never grants an implicit role.
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
