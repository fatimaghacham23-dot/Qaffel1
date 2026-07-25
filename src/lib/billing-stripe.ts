import "server-only";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnvironment, requireStripeWebhookSecret } from "@/lib/env-server";
import { shouldApplyStripeEvent } from "@/lib/stripe-webhook";
import {
  WORKSPACE_PLAN_DEFINITIONS,
  normalizePlanKey,
  type SubscriptionStatus,
  type WorkspacePlanKey,
  type WorkspaceSubscription
} from "@/lib/billing";

type JsonRecord = Record<string, unknown>;
type BillingSyncStatus = "succeeded" | "skipped";

export type BillingSyncResult = {
  status: BillingSyncStatus;
  workspaceId?: string;
  message?: string;
};

type SyncContext = {
  eventId?: string | null;
  eventType: string;
  eventCreatedAt?: string | null;
};

type WorkspaceRow = {
  id: string;
  name?: string | null;
  owner_id?: string | null;
};

type StripeSubscriptionLookup = {
  workspaceId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
};

const PLAN_PRICE_ENV_KEYS: Record<WorkspacePlanKey, string> = {
  solo: "STRIPE_PRICE_SOLO",
  team: "STRIPE_PRICE_TEAM",
  business: "STRIPE_PRICE_BUSINESS",
  enterprise: "STRIPE_PRICE_ENTERPRISE"
};

const READ_ONLY_STATUSES = new Set<SubscriptionStatus>(["paused", "canceled", "archived"]);

let stripeClient: Stripe | null = null;

function billingBaseUrl() {
  return getServerEnvironment().appUrl;
}

function getStripeSecretKey() {
  return getServerEnvironment().stripeSecretKey || "";
}

export function getStripe() {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    throw new Error("Stripe billing is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  return requireStripeWebhookSecret();
}

export function isStripeProviderConfigured() {
  return Boolean(getStripeSecretKey());
}

export function getStripePriceIdForPlan(planKey: WorkspacePlanKey) {
  return process.env[PLAN_PRICE_ENV_KEYS[planKey]]?.trim() || null;
}

export function getConfiguredStripePlans() {
  return (Object.keys(WORKSPACE_PLAN_DEFINITIONS) as WorkspacePlanKey[])
    .map((planKey) => ({
      ...WORKSPACE_PLAN_DEFINITIONS[planKey],
      priceId: getStripePriceIdForPlan(planKey)
    }))
    .filter((plan) => Boolean(plan.priceId));
}

export function planKeyFromStripePriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  const match = (Object.keys(PLAN_PRICE_ENV_KEYS) as WorkspacePlanKey[]).find((planKey) => getStripePriceIdForPlan(planKey) === priceId);
  return match ?? null;
}

export function mapStripeSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  if (status === "trialing") return "trial";
  if (status === "active") return "active";
  if (status === "incomplete") return "grace_period";
  if (status === "past_due" || status === "unpaid" || status === "incomplete_expired") return "past_due";
  if (status === "paused") return "paused";
  if (status === "canceled") return "canceled";
  return "grace_period";
}

export function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const id = (value as JsonRecord).id;
    if (typeof id === "string" && id.trim()) return id;
  }
  return null;
}

export function stripeUnixToIso(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function readString(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function metadataValue(record: JsonRecord, key: string) {
  const metadata = asRecord(record.metadata);
  return readString(metadata, key);
}

function firstSubscriptionItem(subscription: Stripe.Subscription) {
  const items = asRecord(asRecord(subscription as unknown).items);
  const data = Array.isArray(items.data) ? items.data : [];
  return asRecord(data[0]);
}

function subscriptionItemDetails(subscription: Stripe.Subscription) {
  const item = firstSubscriptionItem(subscription);
  return {
    subscriptionItemId: readString(item, "id"),
    priceId: stripeObjectId(item.price)
  };
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const subscriptionRecord = asRecord(subscription as unknown);
  const item = firstSubscriptionItem(subscription);

  return {
    currentPeriodStartedAt: stripeUnixToIso(readNumber(subscriptionRecord, "current_period_start") ?? readNumber(item, "current_period_start")),
    currentPeriodEndsAt: stripeUnixToIso(readNumber(subscriptionRecord, "current_period_end") ?? readNumber(item, "current_period_end")),
    trialStartedAt: stripeUnixToIso(readNumber(subscriptionRecord, "trial_start")),
    trialEndsAt: stripeUnixToIso(readNumber(subscriptionRecord, "trial_end"))
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const invoiceRecord = asRecord(invoice as unknown);
  const parent = asRecord(invoiceRecord.parent);
  const subscriptionDetails = asRecord(parent.subscription_details);
  return stripeObjectId(invoiceRecord.subscription) ?? stripeObjectId(subscriptionDetails.subscription);
}

function invoicePeriod(invoice: Stripe.Invoice) {
  const invoiceRecord = asRecord(invoice as unknown);
  const lines = asRecord(invoiceRecord.lines);
  const lineData = Array.isArray(lines.data) ? lines.data : [];
  const firstLinePeriod = asRecord(asRecord(lineData[0]).period);

  return {
    periodStart: stripeUnixToIso(readNumber(invoiceRecord, "period_start") ?? readNumber(firstLinePeriod, "start")),
    periodEnd: stripeUnixToIso(readNumber(invoiceRecord, "period_end") ?? readNumber(firstLinePeriod, "end"))
  };
}

async function getWorkspace(admin: SupabaseClient, workspaceId: string) {
  const { data, error } = await admin.from("workspaces").select("id, name, owner_id").eq("id", workspaceId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as WorkspaceRow | null;
}

async function getSubscription(admin: SupabaseClient, workspaceId: string) {
  const { data, error } = await admin.from("workspace_subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as WorkspaceSubscription | null;
}

async function resolveWorkspaceId(admin: SupabaseClient, lookup: StripeSubscriptionLookup) {
  if (lookup.workspaceId) {
    return lookup.workspaceId;
  }

  if (lookup.subscriptionId) {
    const { data, error } = await admin
      .from("workspace_subscriptions")
      .select("workspace_id")
      .eq("stripe_subscription_id", lookup.subscriptionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.workspace_id) return String(data.workspace_id);
  }

  if (lookup.customerId) {
    const { data, error } = await admin
      .from("workspace_subscriptions")
      .select("workspace_id")
      .eq("stripe_customer_id", lookup.customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.workspace_id) return String(data.workspace_id);
  }

  return null;
}

async function recordBillingAudit(
  admin: SupabaseClient,
  workspaceId: string,
  payload: {
    eventType: string;
    previousState?: JsonRecord | null;
    nextState?: JsonRecord | null;
    reason?: string | null;
  }
) {
  const { error } = await admin.from("workspace_billing_audit_events").insert({
    workspace_id: workspaceId,
    actor_id: null,
    event_type: payload.eventType,
    previous_state: payload.previousState ?? null,
    next_state: payload.nextState ?? null,
    reason: payload.reason ?? null
  });

  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function ensureStripeCustomerForWorkspace(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userEmail?: string | null;
  currentCustomerId?: string | null;
}) {
  if (input.currentCustomerId?.trim()) {
    return input.currentCustomerId.trim();
  }

  const customer = await getStripe().customers.create(
    {
      name: input.workspaceName,
      email: input.userEmail ?? undefined,
      metadata: {
        workspace_id: input.workspaceId,
        billing_owner_id: input.userId
      }
    },
    {
      idempotencyKey: `qaffel-customer-${input.workspaceId}`
    }
  );

  const { error } = await input.supabase.from("workspace_subscriptions").upsert(
    {
      workspace_id: input.workspaceId,
      billing_owner_id: input.userId,
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString()
    },
    { onConflict: "workspace_id" }
  );

  if (error) throw new Error(error.message);

  return customer.id;
}

export async function createWorkspaceCheckoutSession(input: {
  customerId: string;
  workspaceId: string;
  planKey: WorkspacePlanKey;
  activeMembers: number;
}) {
  const priceId = getStripePriceIdForPlan(input.planKey);
  if (!priceId) {
    throw new Error(`${WORKSPACE_PLAN_DEFINITIONS[input.planKey].label} is not configured for Stripe checkout yet.`);
  }

  const baseUrl = billingBaseUrl();
  const seatQuantity = Math.max(1, input.activeMembers);

  return getStripe().checkout.sessions.create(
    {
      mode: "subscription",
      customer: input.customerId,
      client_reference_id: input.workspaceId,
      line_items: [{ price: priceId, quantity: seatQuantity }],
      success_url: `${baseUrl}/settings/billing?billing=checkout-success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/billing?billing=checkout-canceled`,
      allow_promotion_codes: true,
      metadata: {
        workspace_id: input.workspaceId,
        plan_key: input.planKey,
        qaffel_flow: "workspace_subscription"
      },
      subscription_data: {
        metadata: {
          workspace_id: input.workspaceId,
          plan_key: input.planKey
        }
      }
    },
    {
      idempotencyKey: `qaffel-checkout-${input.workspaceId}-${input.planKey}-${new Date().toISOString().slice(0, 10)}`
    }
  );
}

export async function createWorkspaceBillingPortalSession(customerId: string) {
  const configuration = process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim();

  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${billingBaseUrl()}/settings/billing?billing=portal-return`,
    ...(configuration ? { configuration } : {})
  });
}

async function retrieveStripeSubscription(subscriptionId: string) {
  return getStripe().subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price", "latest_invoice"]
  });
}

export async function syncWorkspaceSubscriptionFromStripeSubscription(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  context: SyncContext
): Promise<BillingSyncResult> {
  const subscriptionRecord = asRecord(subscription as unknown);
  const customerId = stripeObjectId(subscriptionRecord.customer);
  const subscriptionId = readString(subscriptionRecord, "id");
  const { subscriptionItemId, priceId } = subscriptionItemDetails(subscription);
  const metadataWorkspaceId = metadataValue(subscriptionRecord, "workspace_id");
  const workspaceId = await resolveWorkspaceId(admin, {
    workspaceId: metadataWorkspaceId,
    customerId,
    subscriptionId
  });

  if (!workspaceId) {
    return { status: "skipped", message: "Stripe subscription is not linked to a Qaffel workspace." };
  }

  const workspace = await getWorkspace(admin, workspaceId);
  if (!workspace) {
    return { status: "skipped", message: "Linked workspace no longer exists." };
  }

  const existing = await getSubscription(admin, workspaceId);
  const persistedEventCreatedAt = (existing as (WorkspaceSubscription & { stripe_last_event_created_at?: string | null }) | null)
    ?.stripe_last_event_created_at;
  if (!shouldApplyStripeEvent(context.eventCreatedAt, persistedEventCreatedAt)) {
    return { status: "skipped", workspaceId, message: "A newer Stripe subscription event is already applied." };
  }
  const stripeStatus = readString(subscriptionRecord, "status");
  const status = mapStripeSubscriptionStatus(stripeStatus);
  const planKey = normalizePlanKey(metadataValue(subscriptionRecord, "plan_key") ?? planKeyFromStripePriceId(priceId) ?? existing?.plan_key);
  const period = subscriptionPeriod(subscription);
  const now = new Date().toISOString();
  const latestInvoiceId = stripeObjectId(subscriptionRecord.latest_invoice);
  const cancelAtPeriodEnd = readBoolean(subscriptionRecord, "cancel_at_period_end") ?? false;
  const readOnlyAt = READ_ONLY_STATUSES.has(status) ? existing?.read_only_at ?? now : null;
  const gracefulStatus = status === "grace_period" || status === "past_due";

  const nextState = {
    workspace_id: workspaceId,
    billing_owner_id: existing?.billing_owner_id ?? workspace.owner_id ?? null,
    plan_key: planKey,
    status,
    trial_started_at: period.trialStartedAt ?? existing?.trial_started_at ?? null,
    trial_ends_at: period.trialEndsAt ?? existing?.trial_ends_at ?? null,
    current_period_started_at: period.currentPeriodStartedAt,
    current_period_ends_at: period.currentPeriodEndsAt,
    grace_period_ends_at: gracefulStatus ? existing?.grace_period_ends_at ?? addDaysIso(7) : null,
    paused_at: status === "paused" ? existing?.paused_at ?? now : null,
    canceled_at: status === "canceled" ? stripeUnixToIso(readNumber(subscriptionRecord, "canceled_at")) ?? existing?.canceled_at ?? now : null,
    archived_at: existing?.archived_at ?? null,
    read_only_at: readOnlyAt,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_subscription_item_id: subscriptionItemId,
    stripe_price_id: priceId,
    stripe_latest_invoice_id: latestInvoiceId,
    stripe_cancel_at_period_end: cancelAtPeriodEnd,
    stripe_last_event_id: context.eventId ?? null,
    stripe_last_event_created_at: context.eventCreatedAt ?? null,
    stripe_synced_at: now,
    status_reason: `Stripe ${context.eventType}`,
    updated_at: now
  };

  const previousState = existing
    ? {
        plan_key: existing.plan_key,
        status: existing.status,
        stripe_subscription_id: existing.stripe_subscription_id ?? null,
        stripe_price_id: existing.stripe_price_id ?? null
      }
    : null;

  const { error } = await admin.from("workspace_subscriptions").upsert(nextState, { onConflict: "workspace_id" });
  if (error) throw new Error(error.message);

  await recordBillingAudit(admin, workspaceId, {
    eventType: "stripe_subscription_synced",
    previousState,
    nextState: {
      plan_key: planKey,
      status,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      stripe_event_id: context.eventId ?? null
    },
    reason: context.eventType
  });

  return { status: "succeeded", workspaceId };
}

export async function syncWorkspaceBillingInvoiceFromStripeInvoice(
  admin: SupabaseClient,
  invoice: Stripe.Invoice,
  context: SyncContext
): Promise<BillingSyncResult> {
  const invoiceRecord = asRecord(invoice as unknown);
  const invoiceId = readString(invoiceRecord, "id");
  const customerId = stripeObjectId(invoiceRecord.customer);
  const subscriptionId = invoiceSubscriptionId(invoice);
  const workspaceId = await resolveWorkspaceId(admin, {
    workspaceId: metadataValue(invoiceRecord, "workspace_id"),
    customerId,
    subscriptionId
  });

  if (!invoiceId) {
    return { status: "skipped", message: "Stripe invoice does not include an invoice id." };
  }

  if (!workspaceId) {
    return { status: "skipped", message: "Stripe invoice is not linked to a Qaffel workspace." };
  }

  const { data: existingInvoice, error: existingInvoiceError } = await admin
    .from("workspace_billing_invoices")
    .select("stripe_last_event_created_at")
    .eq("stripe_invoice_id", invoiceId)
    .maybeSingle();
  if (existingInvoiceError) throw new Error(existingInvoiceError.message);
  if (!shouldApplyStripeEvent(context.eventCreatedAt, existingInvoice?.stripe_last_event_created_at)) {
    return { status: "skipped", workspaceId, message: "A newer Stripe invoice event is already applied." };
  }

  const period = invoicePeriod(invoice);
  const status = readString(invoiceRecord, "status");
  const invoicePayload = {
    stripe_invoice_id: invoiceId,
    workspace_id: workspaceId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    status,
    collection_method: readString(invoiceRecord, "collection_method"),
    currency: readString(invoiceRecord, "currency"),
    amount_due: readNumber(invoiceRecord, "amount_due"),
    amount_paid: readNumber(invoiceRecord, "amount_paid"),
    hosted_invoice_url: readString(invoiceRecord, "hosted_invoice_url"),
    invoice_pdf: readString(invoiceRecord, "invoice_pdf"),
    period_start: period.periodStart,
    period_end: period.periodEnd,
    invoice_created_at: stripeUnixToIso(readNumber(invoiceRecord, "created")),
    stripe_last_event_created_at: context.eventCreatedAt ?? null,
    updated_at: new Date().toISOString()
  };

  const { error } = await admin.from("workspace_billing_invoices").upsert(invoicePayload, { onConflict: "stripe_invoice_id" });
  if (error) throw new Error(error.message);

  if (context.eventType === "invoice.payment_failed" || context.eventType === "invoice.payment_action_required" || context.eventType === "invoice.paid") {
    await recordBillingAudit(admin, workspaceId, {
      eventType:
        context.eventType === "invoice.paid"
          ? "stripe_invoice_paid"
          : context.eventType === "invoice.payment_action_required"
            ? "stripe_invoice_action_required"
            : "stripe_invoice_payment_failed",
      nextState: {
        stripe_invoice_id: invoiceId,
        status,
        amount_due: invoicePayload.amount_due,
        amount_paid: invoicePayload.amount_paid,
        stripe_event_id: context.eventId ?? null
      },
      reason: context.eventType
    });
  }

  return { status: "succeeded", workspaceId };
}

export async function processStripeWebhookEvent(admin: SupabaseClient, event: Stripe.Event): Promise<BillingSyncResult> {
  const context = {
    eventId: event.id,
    eventType: event.type,
    eventCreatedAt: stripeUnixToIso(event.created)
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionRecord = asRecord(session as unknown);
    const subscriptionId = stripeObjectId(sessionRecord.subscription);

    if (!subscriptionId) {
      return { status: "skipped", message: "Checkout session completed without a subscription." };
    }

    const subscription = await retrieveStripeSubscription(subscriptionId);
    return syncWorkspaceSubscriptionFromStripeSubscription(admin, subscription, context);
  }

  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object as Stripe.Subscription;
    return syncWorkspaceSubscriptionFromStripeSubscription(admin, subscription, context);
  }

  if (event.type.startsWith("invoice.")) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    let subscriptionResult: BillingSyncResult | null = null;

    if (subscriptionId) {
      const subscription = await retrieveStripeSubscription(subscriptionId);
      subscriptionResult = await syncWorkspaceSubscriptionFromStripeSubscription(admin, subscription, context);
    }

    const invoiceResult = await syncWorkspaceBillingInvoiceFromStripeInvoice(admin, invoice, context);
    if (invoiceResult.status === "succeeded") return invoiceResult;
    return subscriptionResult ?? invoiceResult;
  }

  return { status: "skipped", message: "Stripe event type does not affect workspace billing state." };
}
