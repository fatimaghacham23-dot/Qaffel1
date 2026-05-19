"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/get-workspace";
import {
  buildDefaultSubscription,
  canManageBilling,
  canTransitionSubscriptionStatus,
  normalizePlanKey,
  normalizeSubscriptionStatus,
  type WorkspaceSubscription
} from "@/lib/billing";
import {
  createWorkspaceBillingPortalSession,
  createWorkspaceCheckoutSession,
  ensureStripeCustomerForWorkspace,
  getStripePriceIdForPlan
} from "@/lib/billing-stripe";
import { requireUser } from "@/lib/supabase/server";

type BillingAuditPayload = {
  eventType: string;
  previousState?: Record<string, unknown> | null;
  nextState?: Record<string, unknown> | null;
  reason?: string | null;
};

function text(formData: FormData, key: string) {
  return formData.get(key)?.toString().trim() || "";
}

async function getBillingAdminUserIds(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], workspaceId: string) {
  const { data } = await supabase
    .from("workspace_billing_admins")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  return (data || []).map((row) => String(row.user_id));
}

async function getSubscription(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], workspaceId: string, fallbackOwnerId: string) {
  const { data } = await supabase
    .from("workspace_subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  return (data as WorkspaceSubscription | null) ?? buildDefaultSubscription(workspaceId, fallbackOwnerId);
}

async function assertBillingOperator() {
  const { supabase, user } = await requireUser();
  const ctx = await getWorkspaceContext();
  const [subscription, billingAdminUserIds] = await Promise.all([
    getSubscription(supabase, ctx.workspaceId, ctx.userId),
    getBillingAdminUserIds(supabase, ctx.workspaceId)
  ]);

  if (
    !canManageBilling({
      role: ctx.role,
      userId: ctx.userId,
      billingOwnerId: subscription.billing_owner_id,
      billingAdminUserIds
    })
  ) {
    throw new Error("Only the billing owner or an assigned billing admin can manage workspace billing.");
  }

  return { supabase, user, ctx, subscription };
}

async function assertActiveWorkspaceMember(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  workspaceId: string,
  userId: string
) {
  const { data: member } = await supabase
    .from("workspace_members")
    .select("user_id, role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!member) throw new Error("Choose an active workspace member.");
  return member;
}

async function recordBillingAudit(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  workspaceId: string,
  actorId: string,
  payload: BillingAuditPayload
) {
  const { error } = await supabase.from("workspace_billing_audit_events").insert({
    workspace_id: workspaceId,
    actor_id: actorId,
    event_type: payload.eventType,
    previous_state: payload.previousState ?? null,
    next_state: payload.nextState ?? null,
    reason: payload.reason ?? null
  });

  if (error) throw new Error(error.message);
}

async function getWorkspaceSeatUsage(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], workspaceId: string) {
  const [{ count: activeMembers, error: activeMembersError }, { count: pendingInvitations, error: invitationsError }] = await Promise.all([
    supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active"),
    supabase
      .from("workspace_invitations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
  ]);

  if (activeMembersError) throw new Error(activeMembersError.message);
  if (invitationsError) throw new Error(invitationsError.message);

  return {
    activeMembers: activeMembers ?? 0,
    pendingInvitations: pendingInvitations ?? 0
  };
}

export async function transferBillingOwnerAction(formData: FormData) {
  const targetUserId = text(formData, "target_user_id");
  const reason = text(formData, "reason") || null;
  if (!targetUserId) throw new Error("Choose a billing owner.");

  const { supabase, ctx, subscription } = await assertBillingOperator();
  await assertActiveWorkspaceMember(supabase, ctx.workspaceId, targetUserId);

  const previousState = {
    billing_owner_id: subscription.billing_owner_id ?? null
  };
  const nextState = {
    billing_owner_id: targetUserId
  };

  const { error } = await supabase.from("workspace_subscriptions").upsert(
    {
      workspace_id: ctx.workspaceId,
      billing_owner_id: targetUserId,
      plan_key: normalizePlanKey(subscription.plan_key),
      status: normalizeSubscriptionStatus(subscription.status),
      updated_at: new Date().toISOString()
    },
    { onConflict: "workspace_id" }
  );

  if (error) throw new Error(error.message);

  await recordBillingAudit(supabase, ctx.workspaceId, ctx.userId, {
    eventType: "billing_owner_changed",
    previousState,
    nextState,
    reason
  });

  revalidatePath("/settings/billing");
}

export async function grantBillingAdminAction(formData: FormData) {
  const targetUserId = text(formData, "target_user_id");
  const reason = text(formData, "reason") || null;
  if (!targetUserId) throw new Error("Choose a billing admin.");

  const { supabase, ctx } = await assertBillingOperator();
  await assertActiveWorkspaceMember(supabase, ctx.workspaceId, targetUserId);

  const { error } = await supabase.from("workspace_billing_admins").upsert(
    {
      workspace_id: ctx.workspaceId,
      user_id: targetUserId,
      granted_by: ctx.userId,
      granted_at: new Date().toISOString(),
      removed_at: null,
      status: "active"
    },
    { onConflict: "workspace_id,user_id" }
  );

  if (error) throw new Error(error.message);

  await recordBillingAudit(supabase, ctx.workspaceId, ctx.userId, {
    eventType: "billing_admin_granted",
    nextState: { user_id: targetUserId },
    reason
  });

  revalidatePath("/settings/billing");
}

export async function removeBillingAdminAction(formData: FormData) {
  const targetUserId = text(formData, "target_user_id");
  const reason = text(formData, "reason") || null;
  if (!targetUserId) throw new Error("Choose a billing admin.");

  const { supabase, ctx } = await assertBillingOperator();

  const { error } = await supabase
    .from("workspace_billing_admins")
    .update({
      status: "removed",
      removed_at: new Date().toISOString()
    })
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", targetUserId)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  await recordBillingAudit(supabase, ctx.workspaceId, ctx.userId, {
    eventType: "billing_admin_removed",
    previousState: { user_id: targetUserId },
    reason
  });

  revalidatePath("/settings/billing");
}

export async function updateSubscriptionStateAction(formData: FormData) {
  const requestedStatus = text(formData, "status");
  const requestedPlan = text(formData, "plan_key");
  if (!requestedStatus) throw new Error("Subscription status is required.");

  const nextStatus = normalizeSubscriptionStatus(requestedStatus);
  const reason = text(formData, "reason") || null;

  const { supabase, ctx, subscription } = await assertBillingOperator();
  const currentStatus = normalizeSubscriptionStatus(subscription.status);
  const currentPlan = normalizePlanKey(subscription.plan_key);
  const nextPlan = requestedPlan ? normalizePlanKey(requestedPlan) : currentPlan;

  if (!canTransitionSubscriptionStatus(currentStatus, nextStatus)) {
    throw new Error(`Cannot transition subscription from ${currentStatus} to ${nextStatus}.`);
  }

  const previousState = {
    status: currentStatus,
    plan_key: currentPlan
  };
  const nextState = {
    status: nextStatus,
    plan_key: nextPlan
  };

  const now = new Date().toISOString();
  const { error } = await supabase.from("workspace_subscriptions").upsert(
    {
      workspace_id: ctx.workspaceId,
      billing_owner_id: subscription.billing_owner_id ?? ctx.userId,
      status: nextStatus,
      plan_key: nextPlan,
      status_reason: reason,
      paused_at: nextStatus === "paused" ? now : subscription.paused_at ?? null,
      canceled_at: nextStatus === "canceled" ? now : subscription.canceled_at ?? null,
      archived_at: nextStatus === "archived" ? now : subscription.archived_at ?? null,
      read_only_at: nextStatus === "paused" || nextStatus === "canceled" || nextStatus === "archived" ? now : null,
      updated_at: now
    },
    { onConflict: "workspace_id" }
  );

  if (error) throw new Error(error.message);

  await recordBillingAudit(supabase, ctx.workspaceId, ctx.userId, {
    eventType: "subscription_state_changed",
    previousState,
    nextState,
    reason
  });

  revalidatePath("/settings/billing");
}

export async function createStripeCheckoutSessionAction(formData: FormData) {
  const requestedPlan = normalizePlanKey(text(formData, "plan_key"));
  if (!getStripePriceIdForPlan(requestedPlan)) {
    throw new Error("This plan is not configured for secure subscription checkout yet.");
  }

  const { supabase, user, ctx, subscription } = await assertBillingOperator();
  const customerId = await ensureStripeCustomerForWorkspace({
    supabase,
    workspaceId: ctx.workspaceId,
    workspaceName: ctx.workspaceName,
    userId: ctx.userId,
    userEmail: user.email,
    currentCustomerId: subscription.stripe_customer_id
  });

  if (subscription.stripe_subscription_id) {
    const portal = await createWorkspaceBillingPortalSession(customerId);
    await recordBillingAudit(supabase, ctx.workspaceId, ctx.userId, {
      eventType: "stripe_portal_opened",
      nextState: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.stripe_subscription_id
      },
      reason: "Existing subscription management"
    });
    redirect(portal.url);
  }

  const usage = await getWorkspaceSeatUsage(supabase, ctx.workspaceId);
  const session = await createWorkspaceCheckoutSession({
    customerId,
    workspaceId: ctx.workspaceId,
    planKey: requestedPlan,
    activeMembers: usage.activeMembers
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  await recordBillingAudit(supabase, ctx.workspaceId, ctx.userId, {
    eventType: "stripe_checkout_started",
    nextState: {
      plan_key: requestedPlan,
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      active_members: usage.activeMembers,
      pending_invitations: usage.pendingInvitations
    },
    reason: "Workspace subscription checkout"
  });

  revalidatePath("/settings/billing");
  redirect(session.url);
}

export async function createStripePortalSessionAction(_formData?: FormData) {
  void _formData;
  const { supabase, user, ctx, subscription } = await assertBillingOperator();
  const customerId = await ensureStripeCustomerForWorkspace({
    supabase,
    workspaceId: ctx.workspaceId,
    workspaceName: ctx.workspaceName,
    userId: ctx.userId,
    userEmail: user.email,
    currentCustomerId: subscription.stripe_customer_id
  });
  const portal = await createWorkspaceBillingPortalSession(customerId);

  await recordBillingAudit(supabase, ctx.workspaceId, ctx.userId, {
    eventType: "stripe_portal_opened",
    nextState: {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.stripe_subscription_id ?? null
    },
    reason: "Workspace billing portal"
  });

  revalidatePath("/settings/billing");
  redirect(portal.url);
}
