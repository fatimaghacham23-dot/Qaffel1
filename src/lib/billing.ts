import { hasPermission, type WorkspaceRole } from "@/lib/permissions";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "grace_period"
  | "past_due"
  | "paused"
  | "canceled"
  | "archived";

export type WorkspacePlanKey = "solo" | "team" | "business" | "enterprise";

export type BillingFeatureKey =
  | "workspace_members"
  | "finance"
  | "exports"
  | "intelligence"
  | "collaboration"
  | "advanced_operations";

export type WorkspaceSubscription = {
  workspace_id: string;
  plan_key: string | null;
  status: string | null;
  billing_owner_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_subscription_item_id?: string | null;
  stripe_price_id?: string | null;
  stripe_latest_invoice_id?: string | null;
  stripe_cancel_at_period_end?: boolean | null;
  stripe_last_event_id?: string | null;
  stripe_synced_at?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  current_period_started_at?: string | null;
  current_period_ends_at?: string | null;
  grace_period_ends_at?: string | null;
  paused_at?: string | null;
  canceled_at?: string | null;
  archived_at?: string | null;
  read_only_at?: string | null;
  seat_limit?: number | null;
  feature_overrides?: Record<string, unknown> | null;
  status_reason?: string | null;
};

export type BillingUsage = {
  activeMembers: number;
  pendingInvitations?: number;
  monthlyExports?: number;
  openInvoices?: number;
  auditEvents?: number;
};

export type WorkspacePlanDefinition = {
  key: WorkspacePlanKey;
  label: string;
  description: string;
  includedFeatures: BillingFeatureKey[];
  limits: {
    members: number | null;
    monthlyExports: number | null;
  };
};

export type FeatureAccess =
  | {
      state: "available";
      label: string;
      reason: string;
      preserveOperationalAccess: true;
    }
  | {
      state: "grace";
      label: string;
      reason: string;
      preserveOperationalAccess: true;
    }
  | {
      state: "limited";
      label: string;
      reason: string;
      preserveOperationalAccess: true;
    }
  | {
      state: "read_only";
      label: string;
      reason: string;
      preserveOperationalAccess: true;
    };

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "trial",
  "active",
  "grace_period",
  "past_due",
  "paused",
  "canceled",
  "archived"
];

export const WORKSPACE_PLAN_DEFINITIONS: Record<WorkspacePlanKey, WorkspacePlanDefinition> = {
  solo: {
    key: "solo",
    label: "Solo",
    description: "Single-operator workspace foundation.",
    includedFeatures: ["exports"],
    limits: { members: 1, monthlyExports: 5 }
  },
  team: {
    key: "team",
    label: "Team",
    description: "Small team operations with shared work queues.",
    includedFeatures: ["workspace_members", "exports", "collaboration"],
    limits: { members: 5, monthlyExports: 25 }
  },
  business: {
    key: "business",
    label: "Business",
    description: "Finance controls, intelligence, and larger operational volume.",
    includedFeatures: ["workspace_members", "finance", "exports", "intelligence", "collaboration", "advanced_operations"],
    limits: { members: 15, monthlyExports: null }
  },
  enterprise: {
    key: "enterprise",
    label: "Enterprise",
    description: "Configurable limits and governance for larger teams.",
    includedFeatures: ["workspace_members", "finance", "exports", "intelligence", "collaboration", "advanced_operations"],
    limits: { members: null, monthlyExports: null }
  }
};

export const SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  trial: ["active", "grace_period", "canceled", "archived"],
  active: ["grace_period", "past_due", "paused", "canceled", "archived"],
  grace_period: ["active", "past_due", "canceled", "archived"],
  past_due: ["active", "grace_period", "paused", "canceled", "archived"],
  paused: ["active", "canceled", "archived"],
  canceled: ["active", "archived"],
  archived: []
};

export function normalizeSubscriptionStatus(value: string | null | undefined): SubscriptionStatus {
  return SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus) ? (value as SubscriptionStatus) : "trial";
}

export function normalizePlanKey(value: string | null | undefined): WorkspacePlanKey {
  return value && value in WORKSPACE_PLAN_DEFINITIONS ? (value as WorkspacePlanKey) : "solo";
}

export function getPlanDefinition(planKey: string | null | undefined): WorkspacePlanDefinition {
  return WORKSPACE_PLAN_DEFINITIONS[normalizePlanKey(planKey)];
}

export function subscriptionStatusLabel(status: string | null | undefined) {
  const normalized = normalizeSubscriptionStatus(status);
  const labels: Record<SubscriptionStatus, string> = {
    trial: "Trial",
    active: "Active",
    grace_period: "Grace period",
    past_due: "Past due",
    paused: "Paused",
    canceled: "Canceled",
    archived: "Archived"
  };
  return labels[normalized];
}

export function canTransitionSubscriptionStatus(from: string | null | undefined, to: string | null | undefined) {
  const current = normalizeSubscriptionStatus(from);
  const next = normalizeSubscriptionStatus(to);
  if (current === next) return true;
  return SUBSCRIPTION_TRANSITIONS[current].includes(next);
}

export function buildDefaultSubscription(workspaceId: string, billingOwnerId?: string | null): WorkspaceSubscription {
  return {
    workspace_id: workspaceId,
    plan_key: "solo",
    status: "trial",
    billing_owner_id: billingOwnerId ?? null,
    feature_overrides: {},
    seat_limit: null
  };
}

export function canRoleViewBilling(role: WorkspaceRole | null | undefined) {
  return hasPermission(role, "billing.view");
}

export function canRoleManageBilling(role: WorkspaceRole | null | undefined) {
  return hasPermission(role, "billing.manage");
}

export function canManageBilling(input: {
  role: WorkspaceRole | null | undefined;
  userId: string | null | undefined;
  billingOwnerId?: string | null;
  billingAdminUserIds?: string[];
}) {
  if (!input.userId) return false;
  return (
    canRoleManageBilling(input.role) ||
    input.billingOwnerId === input.userId ||
    Boolean(input.billingAdminUserIds?.includes(input.userId))
  );
}

export function planIncludesFeature(planKey: string | null | undefined, feature: BillingFeatureKey) {
  return getPlanDefinition(planKey).includedFeatures.includes(feature);
}

export function subscriptionReadOnlyRecommended(status: string | null | undefined) {
  const normalized = normalizeSubscriptionStatus(status);
  return normalized === "paused" || normalized === "canceled" || normalized === "archived";
}

export function getFeatureAccess(subscription: WorkspaceSubscription, feature: BillingFeatureKey): FeatureAccess {
  const status = normalizeSubscriptionStatus(subscription.status);
  const plan = getPlanDefinition(subscription.plan_key);
  const hasFeature = plan.includedFeatures.includes(feature);

  if (status === "archived") {
    return {
      state: "read_only",
      label: "Read-only",
      reason: "Archived workspaces preserve records and audit history without new operational changes.",
      preserveOperationalAccess: true
    };
  }

  if (status === "paused" || status === "canceled") {
    return {
      state: "read_only",
      label: "Continuity mode",
      reason: "Existing data remains visible and exportable while new subscription-sensitive activity can be restricted.",
      preserveOperationalAccess: true
    };
  }

  if (status === "grace_period" || status === "past_due") {
    return {
      state: "grace",
      label: "Grace",
      reason: "Workspace operations continue during billing recovery. Avoid destructive lockouts.",
      preserveOperationalAccess: true
    };
  }

  if (!hasFeature) {
    return {
      state: "limited",
      label: "Plan-limited",
      reason: `${plan.label} does not include this capability by default. Existing records stay available.`,
      preserveOperationalAccess: true
    };
  }

  return {
    state: "available",
    label: "Available",
    reason: `${plan.label} includes this capability.`,
    preserveOperationalAccess: true
  };
}

export function evaluateDowngradeSafety(input: {
  currentPlanKey: string | null | undefined;
  targetPlanKey: string | null | undefined;
  usage: BillingUsage;
}) {
  const targetPlan = getPlanDefinition(input.targetPlanKey);
  const warnings: string[] = [];

  if (targetPlan.limits.members !== null && input.usage.activeMembers > targetPlan.limits.members) {
    warnings.push(
      `Active members (${input.usage.activeMembers}) exceed the ${targetPlan.label} member limit (${targetPlan.limits.members}). Keep access readable and require an admin decision before inviting more people.`
    );
  }

  if (
    targetPlan.limits.monthlyExports !== null &&
    typeof input.usage.monthlyExports === "number" &&
    input.usage.monthlyExports > targetPlan.limits.monthlyExports
  ) {
    warnings.push(
      `Monthly exports (${input.usage.monthlyExports}) exceed the ${targetPlan.label} export allowance (${targetPlan.limits.monthlyExports}). Retain generated export history.`
    );
  }

  return {
    targetPlan,
    safe: warnings.length === 0,
    warnings,
    retentionGuarantees: [
      "Invoices, proofs, receipts, finance close records, and audit events are retained.",
      "Downgrades should restrict future capacity before touching historical records.",
      "Exports remain available for continuity and accounting review."
    ]
  };
}

export function canAddWorkspaceMember(input: { subscription: WorkspaceSubscription; activeMembers: number; pendingInvitations?: number }) {
  const plan = getPlanDefinition(input.subscription.plan_key);
  const seatLimit = input.subscription.seat_limit ?? plan.limits.members;
  const committedSeats = input.activeMembers + (input.pendingInvitations ?? 0);

  if (seatLimit === null) {
    return {
      allowed: true,
      seatLimit,
      committedSeats,
      reason: "This plan has flexible workspace seats."
    };
  }

  return {
    allowed: committedSeats < seatLimit,
    seatLimit,
    committedSeats,
    reason:
      committedSeats < seatLimit
        ? `${seatLimit - committedSeats} seat${seatLimit - committedSeats === 1 ? "" : "s"} available on the current plan.`
        : `The current plan includes ${seatLimit} seat${seatLimit === 1 ? "" : "s"}. Existing members keep access; manage billing or remove unused invitations before inviting more people.`
  };
}

export function buildBillingSummary(subscription: WorkspaceSubscription, usage: BillingUsage) {
  const plan = getPlanDefinition(subscription.plan_key);
  const status = normalizeSubscriptionStatus(subscription.status);
  const seatLimit = subscription.seat_limit ?? plan.limits.members;
  const seatsOverLimit = seatLimit !== null && usage.activeMembers > seatLimit;
  const readOnlyRecommended = subscriptionReadOnlyRecommended(status);

  return {
    plan,
    status,
    statusLabel: subscriptionStatusLabel(status),
    seatLimit,
    seatsUsed: usage.activeMembers,
    seatsOverLimit,
    readOnlyRecommended,
    continuityMode: status === "grace_period" || status === "past_due" || readOnlyRecommended,
    billingHealth:
      status === "active" || status === "trial"
        ? "healthy"
        : status === "grace_period" || status === "past_due"
          ? "attention"
          : "restricted"
  };
}
