import { redirect } from "next/navigation";
import { ShieldCheck, UserRoundCog, UsersRound, Archive, AlertTriangle, History, LockKeyhole, CreditCard, ExternalLink, ReceiptText } from "lucide-react";
import {
  createStripeCheckoutSessionAction,
  createStripePortalSessionAction,
  grantBillingAdminAction,
  removeBillingAdminAction,
  transferBillingOwnerAction
} from "@/app/billing-actions";
import { AppShell } from "@/components/AppShell";
import { OperationsChecklist } from "@/components/OperationsChecklist";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  WORKSPACE_PLAN_DEFINITIONS,
  buildBillingSummary,
  buildDefaultSubscription,
  canManageBilling,
  canRoleViewBilling,
  evaluateDowngradeSafety,
  getFeatureAccess,
  getPlanDefinition,
  subscriptionStatusLabel,
  type BillingFeatureKey,
  type WorkspaceSubscription
} from "@/lib/billing";
import { getConfiguredStripePlans, isStripeProviderConfigured } from "@/lib/billing-stripe";
import { shortDate } from "@/lib/format";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { ROLE_LABELS, type WorkspaceRole } from "@/lib/permissions";
import { requireUser } from "@/lib/supabase/server";

type MemberRow = {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  status: string;
  profiles?: { full_name?: string | null; business_name?: string | null } | { full_name?: string | null; business_name?: string | null }[] | null;
};

type BillingAdminRow = {
  id: string;
  user_id: string;
  status: string;
  granted_at?: string | null;
};

type BillingAuditRow = {
  id: string;
  event_type: string;
  actor_id?: string | null;
  reason?: string | null;
  created_at: string;
};

type BillingInvoiceRow = {
  stripe_invoice_id: string;
  status?: string | null;
  currency?: string | null;
  amount_due?: number | null;
  amount_paid?: number | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  invoice_created_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
};

const featureLabels: Record<BillingFeatureKey, string> = {
  workspace_members: "Workspace members",
  finance: "Finance controls",
  exports: "Exports",
  intelligence: "Intelligence",
  collaboration: "Collaboration",
  advanced_operations: "Advanced operations"
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function memberName(member: MemberRow | undefined) {
  if (!member) return "Unknown member";
  const profile = one(member.profiles);
  return profile?.business_name || profile?.full_name || "Workspace member";
}

function billingBadgeStatus(status: string) {
  if (status === "trial" || status === "active") return "active";
  if (status === "grace_period" || status === "past_due") return "warning";
  if (status === "archived") return "voided";
  return "neutral";
}

function auditLabel(eventType: string) {
  return eventType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripeInvoiceStatusLabel(status: string | null | undefined) {
  if (!status) return "Pending";
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStripeAmount(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount === null || amount === undefined || !currency) return "-";
  const normalizedCurrency = currency.toUpperCase();
  const zeroDecimalCurrencies = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "LBP", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
  const divisor = zeroDecimalCurrencies.has(normalizedCurrency) ? 1 : 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: zeroDecimalCurrencies.has(normalizedCurrency) ? 0 : 2
  }).format(amount / divisor);
}

export default async function BillingSettingsPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();

  const monthKey = new Date().toISOString().slice(0, 7);
  const [
    { data: subscriptionRow },
    { data: membersRaw },
    { data: billingAdminsRaw },
    { data: auditEventsRaw },
    { data: billingInvoicesRaw },
    { count: pendingInvitations },
    { count: openInvoices },
    { count: monthlyExports }
  ] = await Promise.all([
    supabase.from("workspace_subscriptions").select("*").eq("workspace_id", ctx.workspaceId).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("id, user_id, role, status, profiles!inner(full_name, business_name)")
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("workspace_billing_admins")
      .select("id, user_id, status, granted_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "active")
      .order("granted_at", { ascending: true }),
    supabase
      .from("workspace_billing_audit_events")
      .select("id, event_type, actor_id, reason, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("workspace_billing_invoices")
      .select("stripe_invoice_id, status, currency, amount_due, amount_paid, hosted_invoice_url, invoice_pdf, invoice_created_at, period_start, period_end")
      .eq("workspace_id", ctx.workspaceId)
      .order("invoice_created_at", { ascending: false })
      .limit(6),
    supabase
      .from("workspace_invitations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .is("accepted_at", null),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .not("status", "eq", "paid"),
    supabase
      .from("finance_export_runs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("period_month", monthKey)
  ]);

  const subscription = ((subscriptionRow as WorkspaceSubscription | null) ?? buildDefaultSubscription(ctx.workspaceId, ctx.userId));
  const members = (membersRaw || []) as MemberRow[];
  const billingAdmins = (billingAdminsRaw || []) as BillingAdminRow[];
  const auditEvents = (auditEventsRaw || []) as BillingAuditRow[];
  const billingInvoices = (billingInvoicesRaw || []) as BillingInvoiceRow[];
  const billingAdminUserIds = billingAdmins.map((admin) => admin.user_id);
  const userCanManageBilling = canManageBilling({
    role: ctx.role,
    userId: ctx.userId,
    billingOwnerId: subscription.billing_owner_id,
    billingAdminUserIds
  });
  const userCanViewBilling = canRoleViewBilling(ctx.role) || userCanManageBilling;

  if (!userCanViewBilling) {
    redirect("/dashboard");
  }

  const usage = {
    activeMembers: members.length,
    pendingInvitations: pendingInvitations ?? 0,
    monthlyExports: monthlyExports ?? 0,
    openInvoices: openInvoices ?? 0,
    auditEvents: auditEvents.length
  };
  const summary = buildBillingSummary(subscription, usage);
  const plan = getPlanDefinition(subscription.plan_key);
  const stripeProviderConfigured = isStripeProviderConfigured();
  const configuredStripePlans = getConfiguredStripePlans();
  const hasStripeSubscription = Boolean(subscription.stripe_subscription_id);
  const latestBillingSync = subscription.stripe_synced_at ? shortDate(subscription.stripe_synced_at) : "Not synced";
  const billingOwner = members.find((member) => member.user_id === subscription.billing_owner_id);
  const currentPlanDowngrade = evaluateDowngradeSafety({
    currentPlanKey: subscription.plan_key,
    targetPlanKey: subscription.plan_key,
    usage
  });
  const manageableMembers = members.filter((member) => member.user_id !== subscription.billing_owner_id);

  return (
    <AppShell>
      <PageContainer width="default">
      <PageHeader
        title="Workspace billing"
        description="Subscription state, billing authority, seats, and operational continuity for this workspace."
      />

      <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="q-section-label text-slate-500">Subscription state</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{plan.label}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{plan.description}</p>
            </div>
            <StatusBadge status={billingBadgeStatus(summary.status)} label={subscriptionStatusLabel(summary.status)} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Seats</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-ink">
                {summary.seatsUsed}
                <span className="text-sm font-medium text-slate-400"> / {summary.seatLimit ?? "unlimited"}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Open work</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-ink">{usage.openInvoices}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Exports this month</p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-ink">{usage.monthlyExports}</p>
            </div>
          </div>
        </section>

        <OperationsChecklist
          title="Billing safety"
          description="Continuity checks for subscription-aware operations."
          items={[
            {
              id: "owner",
              label: "Billing owner assigned",
              ok: Boolean(subscription.billing_owner_id),
              hint: "Assign a workspace member before future subscription collection is enabled."
            },
            {
              id: "seats",
              label: "Seats within plan boundary",
              ok: !summary.seatsOverLimit,
              hint: "Existing members keep visibility; restrict future invitations before removing access."
            },
            {
              id: "retention",
              label: "Downgrade retention policy present",
              ok: currentPlanDowngrade.retentionGuarantees.length > 0
            }
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="q-section-label text-slate-500">Secure billing</p>
                <h2 className="mt-2 text-lg font-semibold text-ink">Subscription payments</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Stripe manages collection, payment methods, invoices, and subscription changes while Qaffel preserves operational continuity.
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-cedar" aria-hidden="true" />
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Customer</p>
                <p className="mt-2 truncate text-sm font-semibold tabular-nums text-ink">{subscription.stripe_customer_id ?? "Not created"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Subscription</p>
                <p className="mt-2 truncate text-sm font-semibold tabular-nums text-ink">{subscription.stripe_subscription_id ?? "No active Stripe link"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Last sync</p>
                <p className="mt-2 text-sm font-semibold tabular-nums text-ink">{latestBillingSync}</p>
              </div>
            </div>

            {subscription.stripe_cancel_at_period_end ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-5 text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>This subscription is scheduled to cancel at period end. Workspace records, exports, and audit history remain available.</p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 border-t border-slate-100 pt-5">
              {stripeProviderConfigured ? (
                userCanManageBilling ? (
                  hasStripeSubscription ? (
                    <form action={createStripePortalSessionAction}>
                      <button className="btn btn-primary inline-flex items-center gap-2 text-sm" type="submit">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Open billing portal
                      </button>
                    </form>
                  ) : configuredStripePlans.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {configuredStripePlans.map((definition) => (
                        <form key={definition.key} action={createStripeCheckoutSessionAction} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                          <input type="hidden" name="plan_key" value={definition.key} />
                          <p className="text-sm font-semibold text-ink">{definition.label}</p>
                          <p className="mt-1 min-h-10 text-xs leading-5 text-slate-600">{definition.description}</p>
                          <button className="btn btn-secondary mt-4 inline-flex w-full items-center justify-center gap-2 text-sm" type="submit">
                            <CreditCard className="h-4 w-4" aria-hidden="true" />
                            Start subscription
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
                      Stripe is connected, but plan price identifiers are not configured yet.
                    </p>
                  )
                ) : (
                  <p className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
                    Billing owner and billing admins can manage payment methods and subscription changes.
                  </p>
                )
              ) : (
                <p className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
                  Stripe billing is not configured in this environment. Workspace billing state remains visible for operational review.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="q-section-label text-slate-500">Billing authority</p>
                <h2 className="mt-2 text-lg font-semibold text-ink">Owner and administrators</h2>
              </div>
              <ShieldCheck className="h-5 w-5 text-cedar" aria-hidden="true" />
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-cedar/15 bg-cedar/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <UserRoundCog className="mt-0.5 h-4 w-4 text-cedar" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-cedar">Billing owner</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{memberName(billingOwner)}</p>
                    <p className="mt-1 text-xs text-slate-600">Workspace owner remains a safety operator even when billing ownership moves.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                {billingAdmins.length > 0 ? (
                  billingAdmins.map((admin) => {
                    const adminMember = members.find((member) => member.user_id === admin.user_id);
                    return (
                      <div key={admin.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{memberName(adminMember)}</p>
                          <p className="text-xs text-slate-500">Billing admin{admin.granted_at ? ` since ${shortDate(admin.granted_at)}` : ""}</p>
                        </div>
                        {userCanManageBilling ? (
                          <form action={removeBillingAdminAction}>
                            <input type="hidden" name="target_user_id" value={admin.user_id} />
                            <button className="btn btn-secondary px-3 py-2 text-xs" type="submit">
                              Remove
                            </button>
                          </form>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">No billing admins assigned.</p>
                )}
              </div>
            </div>

            {userCanManageBilling ? (
              <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-2">
                <form action={transferBillingOwnerAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-sm font-semibold text-ink">Transfer billing owner</p>
                  <select className="field" name="target_user_id" defaultValue="">
                    <option value="" disabled>
                      Choose member
                    </option>
                    {members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {memberName(member)} - {ROLE_LABELS[member.role] ?? member.role}
                      </option>
                    ))}
                  </select>
                  <input className="field" name="reason" placeholder="Optional note" />
                  <button className="btn btn-primary text-sm" type="submit">
                    Save owner
                  </button>
                </form>

                <form action={grantBillingAdminAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-sm font-semibold text-ink">Grant billing admin</p>
                  <select className="field" name="target_user_id" defaultValue="">
                    <option value="" disabled>
                      Choose member
                    </option>
                    {manageableMembers.map((member) => (
                      <option key={member.user_id} value={member.user_id}>
                        {memberName(member)} - {ROLE_LABELS[member.role] ?? member.role}
                      </option>
                    ))}
                  </select>
                  <input className="field" name="reason" placeholder="Optional note" />
                  <button className="btn btn-secondary text-sm" type="submit">
                    Grant access
                  </button>
                </form>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="q-section-label text-slate-500">Feature access foundation</p>
                <h2 className="mt-2 text-lg font-semibold text-ink">Plan-aware capabilities</h2>
              </div>
              <LockKeyhole className="h-5 w-5 text-slate-500" aria-hidden="true" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {(Object.keys(featureLabels) as BillingFeatureKey[]).map((feature) => {
                const access = getFeatureAccess(subscription, feature);
                return (
                  <div key={feature} className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">{featureLabels[feature]}</p>
                      <StatusBadge
                        status={access.state === "available" ? "active" : access.state === "grace" ? "warning" : "neutral"}
                        label={access.label}
                        size="sm"
                      />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{access.reason}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-cedar" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Plan structure</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {Object.values(WORKSPACE_PLAN_DEFINITIONS).map((definition) => (
                <div
                  key={definition.key}
                  className={`rounded-xl border px-4 py-3 ${
                    definition.key === plan.key ? "border-cedar/30 bg-cedar/[0.05]" : "border-slate-200/70 bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{definition.label}</p>
                    <p className="text-xs font-medium tabular-nums text-slate-500">
                      {definition.limits.members === null ? "Flexible seats" : `${definition.limits.members} seat${definition.limits.members === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{definition.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-cedar" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Downgrade safeguards</h2>
            </div>
            <ul className="mt-4 grid gap-2">
              {currentPlanDowngrade.retentionGuarantees.map((item) => (
                <li key={item} className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs leading-5 text-slate-600">
                  {item}
                </li>
              ))}
            </ul>
            {summary.seatsOverLimit ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-5 text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>Seat usage is above the current limit. Keep access readable and block future invites before removing anyone.</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-cedar" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Subscription invoices</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {billingInvoices.length > 0 ? (
                billingInvoices.map((invoice) => (
                  <div key={invoice.stripe_invoice_id} className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink">{stripeInvoiceStatusLabel(invoice.status)}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {invoice.invoice_created_at ? shortDate(invoice.invoice_created_at) : "Awaiting invoice date"}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs font-semibold tabular-nums text-ink">{formatStripeAmount(invoice.amount_paid ?? invoice.amount_due, invoice.currency)}</p>
                    </div>
                    {invoice.hosted_invoice_url || invoice.invoice_pdf ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {invoice.hosted_invoice_url ? (
                          <a className="btn btn-secondary px-3 py-2 text-xs" href={invoice.hosted_invoice_url} rel="noreferrer" target="_blank">
                            View invoice
                          </a>
                        ) : null}
                        {invoice.invoice_pdf ? (
                          <a className="btn btn-secondary px-3 py-2 text-xs" href={invoice.invoice_pdf} rel="noreferrer" target="_blank">
                            PDF
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-3 text-sm text-slate-600">No subscription invoices synced yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-cedar" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-ink">Billing audit</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {auditEvents.length > 0 ? (
                auditEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                    <p className="text-xs font-semibold text-ink">{auditLabel(event.event_type)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{shortDate(event.created_at)}</p>
                    {event.reason ? <p className="mt-1 text-xs leading-5 text-slate-600">{event.reason}</p> : null}
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-3 text-sm text-slate-600">No billing changes recorded yet.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
      </PageContainer>
    </AppShell>
  );
}
