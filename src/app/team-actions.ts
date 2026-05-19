"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { requirePermission } from "@/lib/permissions";
import { buildDefaultSubscription, canAddWorkspaceMember, type WorkspaceSubscription } from "@/lib/billing";

/**
 * Invite a teammate to the workspace.
 */
export async function inviteTeammateAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "team.manage", "Only admins and owners can invite team members.");

  const email = formData.get("email")?.toString().trim().toLowerCase();
  const role = formData.get("role")?.toString().trim() || "staff";

  if (!email) throw new Error("Email is required.");

  const [
    { data: subscriptionRow, error: subscriptionError },
    { count: activeMembers, error: activeMembersError },
    { count: pendingInvitations, error: pendingInvitationsError },
    { data: existingInvitation, error: existingInvitationError }
  ] = await Promise.all([
    supabase.from("workspace_subscriptions").select("*").eq("workspace_id", ctx.workspaceId).maybeSingle(),
    supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspaceId).eq("status", "active"),
    supabase
      .from("workspace_invitations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase
      .from("workspace_invitations")
      .select("id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("email", email)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()
  ]);

  if (subscriptionError) throw new Error(subscriptionError.message);
  if (activeMembersError) throw new Error(activeMembersError.message);
  if (pendingInvitationsError) throw new Error(pendingInvitationsError.message);
  if (existingInvitationError) throw new Error(existingInvitationError.message);
  if (existingInvitation) throw new Error("There is already a pending invitation for this email.");

  const subscription = ((subscriptionRow as WorkspaceSubscription | null) ?? buildDefaultSubscription(ctx.workspaceId, ctx.userId));
  const seatCheck = canAddWorkspaceMember({
    subscription,
    activeMembers: activeMembers ?? 0,
    pendingInvitations: pendingInvitations ?? 0
  });

  if (!seatCheck.allowed) {
    throw new Error(seatCheck.reason);
  }

  // Create invitation
  const { error } = await supabase.from("workspace_invitations").insert({
    workspace_id: ctx.workspaceId,
    email,
    role,
    invited_by: ctx.userId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

/**
 * Change a team member's role.
 */
export async function changeTeamMemberRoleAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "team.manage", "Only admins and owners can change roles.");

  const memberId = formData.get("member_id")?.toString();
  const newRole = formData.get("role")?.toString();

  if (!memberId || !newRole) throw new Error("Member ID and role are required.");
  if (newRole === "owner") throw new Error("Cannot assign owner role. Use ownership transfer instead.");

  const { error } = await supabase
    .from("workspace_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

/**
 * Remove a team member from the workspace.
 */
export async function removeTeamMemberAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "team.manage", "Only admins and owners can remove members.");

  const memberId = formData.get("member_id")?.toString();
  if (!memberId) throw new Error("Member ID is required.");

  // Prevent removing yourself
  const { data: member } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (!member) throw new Error("Member not found.");
  if (member.user_id === ctx.userId) throw new Error("Cannot remove yourself.");
  if (member.role === "owner") throw new Error("Cannot remove the workspace owner.");

  const { error } = await supabase
    .from("workspace_members")
    .update({ status: "removed" })
    .eq("id", memberId)
    .eq("workspace_id", ctx.workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

/**
 * Cancel a pending invitation.
 */
export async function cancelInvitationAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "team.manage");

  const invitationId = formData.get("invitation_id")?.toString();
  if (!invitationId) throw new Error("Invitation ID is required.");

  const { error } = await supabase
    .from("workspace_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("workspace_id", ctx.workspaceId);

  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

/**
 * Request an approval for an action (void, high-value, etc.)
 */
export async function requestApprovalAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "approvals.request");

  const type = formData.get("type")?.toString();
  const referenceId = formData.get("reference_id")?.toString();
  const referenceType = formData.get("reference_type")?.toString();
  const note = formData.get("note")?.toString() || null;

  if (!type || !referenceId) throw new Error("Approval type and reference are required.");

  const { error } = await supabase.from("workspace_approvals").insert({
    workspace_id: ctx.workspaceId,
    type,
    reference_id: referenceId,
    reference_type: referenceType || null,
    requested_by: ctx.userId,
    note,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

/**
 * Resolve an approval request (approve or reject).
 */
export async function resolveApprovalAction(formData: FormData) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  requirePermission(ctx.role, "approvals.resolve");

  const approvalId = formData.get("approval_id")?.toString();
  const decision = formData.get("decision")?.toString(); // "approved" or "rejected"
  const note = formData.get("note")?.toString() || null;

  if (!approvalId || !decision) throw new Error("Approval ID and decision are required.");
  if (decision !== "approved" && decision !== "rejected") throw new Error("Decision must be 'approved' or 'rejected'.");

  const { error } = await supabase
    .from("workspace_approvals")
    .update({
      status: decision,
      approved_by: ctx.userId,
      note,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", approvalId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
  revalidatePath("/team");
}
