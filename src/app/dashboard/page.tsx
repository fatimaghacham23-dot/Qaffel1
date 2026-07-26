import { AppShell } from "@/components/AppShell";
import { DashboardHome } from "@/components/DashboardHome";
import { PageContainer } from "@/components/layout/PageContainer";
import {
  DASHBOARD_ASSIGNMENT_LIMIT,
  DASHBOARD_EVENT_QUERY_LIMIT,
  DASHBOARD_INVOICE_LIMIT,
  DASHBOARD_PROOF_LIMIT,

  dashboardCapabilities,
  dashboardGreeting,
  dashboardMetrics,
  dashboardQueryPlan,
  deriveDashboardOnboardingState,
  type DashboardAssignment,
  type DashboardInvoice,
  type DashboardPayment
} from "@/lib/dashboard";
import { getOutstandingBalance, isAcceptedNonVoidedPayment, isOutstandingInvoice } from "@/lib/collection";
import { money } from "@/lib/format";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { dashboardScope } from "@/lib/dashboard-scope";
import { notificationPreview } from "@/lib/notifications";
import { getWorkspaceNotifications } from "@/lib/notifications-server";
import { getWorkspaceOnboardingEvidence } from "@/lib/onboarding-evidence";
import { getWorkspaceRecentActivity } from "@/lib/recent-activity-server";
import { requireUser } from "@/lib/supabase/server";

type Result<T> = { data: T[] | null; error: { message?: string } | null; count?: number | null };
const emptyResult = <T,>(): Promise<Result<T>> => Promise.resolve({ data: [], error: null, count: 0 });

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function firstName(value: string | null | undefined) {
  const clean = (value || "").trim();
  return !clean || clean.toLowerCase() === "unknown" ? "there" : clean.split(/\s+/)[0];
}

function groupedMoney(values: Record<"USD" | "LBP", number>) {
  const currencies = (["USD", "LBP"] as const).filter((currency) => values[currency] > 0);
  return currencies.length ? currencies.map((currency) => money(values[currency], currency)).join(" and ") : null;
}

function cashFlowPreview(input: { invoices: DashboardInvoice[]; payments: DashboardPayment[]; now: Date }) {
  const activity = { USD: 0, LBP: 0 };
  for (const payment of input.payments) {
    if (!isAcceptedNonVoidedPayment(payment)) continue;
    activity.USD += Number(payment.amount_usd || 0);
    activity.LBP += Number(payment.amount_lbp || 0);
  }
  for (const invoice of input.invoices) {
    if (!isOutstandingInvoice(invoice)) continue;
    const remaining = getOutstandingBalance(invoice);
    activity[remaining.primaryCurrency] += remaining.primaryBalance;
  }
  const currency: "USD" | "LBP" = activity.USD > 0 || activity.LBP === 0 ? "USD" : "LBP";
  const startOfWeek = new Date(input.now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const points = [
    { label: "Last week", from: -7, to: 0 },
    { label: "This week", from: 0, to: 7 },
    { label: "Next week", from: 7, to: 14 },
    { label: "Following", from: 14, to: 21 }
  ].map((bucket) => {
    const from = new Date(startOfWeek); from.setDate(from.getDate() + bucket.from);
    const to = new Date(startOfWeek); to.setDate(to.getDate() + bucket.to);
    let collected = 0;
    let expected = 0;
    for (const payment of input.payments) {
      if (!isAcceptedNonVoidedPayment(payment)) continue;
      const timestamp = payment.confirmed_at || payment.reviewed_at;
      if (!timestamp) continue;
      const paidAt = new Date(timestamp);
      if (paidAt >= from && paidAt < to) collected += currency === "LBP" ? Number(payment.amount_lbp || 0) : Number(payment.amount_usd || 0);
    }
    for (const invoice of input.invoices) {
      if (!isOutstandingInvoice(invoice) || !invoice.due_date) continue;
      const due = new Date(`${invoice.due_date}T00:00:00`);
      const remaining = getOutstandingBalance(invoice);
      if (remaining.primaryCurrency === currency && due >= from && due < to) expected += remaining.primaryBalance;
    }
    return { label: bucket.label, collected, expected };
  });
  return { currency, points };
}

export default async function DashboardPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  const scope = dashboardScope(ctx.workspaceId);
  const now = new Date();
  const capabilities = dashboardCapabilities(ctx.role);
  const plan = dashboardQueryPlan(ctx.role);
  const cashStart = new Date(now);
  cashStart.setDate(cashStart.getDate() - 10);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paymentStart = new Date(Math.min(cashStart.getTime(), monthStart.getTime())).toISOString();

  const invoicePromise = plan.invoices
    ? supabase
        .from("invoices")
        .select("id,title,invoice_number,status,document_type,currency,amount_usd,amount_lbp,due_date,valid_until,public_token,created_at,clients(name),payment_proofs(status,amount_usd,amount_lbp,voided_at)", { count: "exact" })
        .eq(...scope.workspace)
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_INVOICE_LIMIT)
    : emptyResult<DashboardInvoice>();
  const pendingPromise = plan.proofs
    ? supabase
        .from("payment_proofs")
        .select("id,invoice_id,status,amount_usd,amount_lbp,method,uploaded_at,confirmed_at,reviewed_at,voided_at,invoices!inner(id,title,invoice_number,currency,workspace_id,clients(name))")
        .eq(...scope.proofWorkspace)
        .eq("status", "pending")
        .order("uploaded_at", { ascending: true })
        .limit(DASHBOARD_PROOF_LIMIT)
    : emptyResult<DashboardPayment>();
  const pendingCountPromise = plan.proofs
    ? supabase
        .from("payment_proofs")
        .select("id,invoices!inner(workspace_id)", { count: "exact", head: true })
        .eq(...scope.proofWorkspace)
        .eq("status", "pending")
    : emptyResult<never>();
  const acceptedPromise = capabilities.showFinancialSummary
    ? supabase
        .from("payment_proofs")
        .select("id,invoice_id,status,amount_usd,amount_lbp,method,uploaded_at,confirmed_at,reviewed_at,voided_at,invoices!inner(id,title,invoice_number,currency,workspace_id,clients(name))", { count: "exact" })
        .eq(...scope.proofWorkspace)
        .eq("status", "accepted")
        .gte("confirmed_at", paymentStart)
        .order("confirmed_at", { ascending: false })
        .limit(DASHBOARD_INVOICE_LIMIT)
    : emptyResult<DashboardPayment>();
  const rejectedPromise = capabilities.showFinancialSummary
    ? supabase
        .from("payment_proofs")
        .select("id,invoice_id,status,amount_usd,amount_lbp,method,uploaded_at,confirmed_at,reviewed_at,voided_at,invoices!inner(id,title,invoice_number,currency,workspace_id,clients(name))", { count: "exact" })
        .eq(...scope.proofWorkspace)
        .eq("status", "rejected")
        .order("reviewed_at", { ascending: false })
        .limit(10)
    : emptyResult<DashboardPayment>();
  const assignmentQuery = plan.assignments
    ? supabase
        .from("operational_assignments")
        .select("id,target_type,target_id,assignment_type,status,priority,due_at,context,created_at")
        .eq(...scope.workspace)
        .in("status", ["open", "in_progress", "waiting"])
        .or(`assigned_to_user_id.eq.${ctx.userId},assigned_to_role.eq.${ctx.role}`)
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(DASHBOARD_ASSIGNMENT_LIMIT)
    : emptyResult<DashboardAssignment>();
  const [invoiceResult, pendingResult, pendingCountResult, acceptedResult, rejectedResult, assignmentResult, eventResult] = await Promise.all([
    invoicePromise, pendingPromise, pendingCountPromise, acceptedPromise, rejectedPromise, assignmentQuery, getWorkspaceRecentActivity(supabase, ctx, 5)
  ]) as unknown as [Result<DashboardInvoice>, Result<DashboardPayment>, Result<never>, Result<DashboardPayment>, Result<DashboardPayment>, Result<DashboardAssignment>, Awaited<ReturnType<typeof getWorkspaceRecentActivity>>];

  const invoices = invoiceResult.data || [];
  const pending = pendingResult.data || [];
  const payments = [...pending, ...(acceptedResult.data || []), ...(rejectedResult.data || [])];
  const metrics = dashboardMetrics({ invoices, payments: acceptedResult.data || [], now });
  const attention = notificationPreview(await getWorkspaceNotifications(supabase, ctx)).actionItems;
  const recentActivity = eventResult;
  const onboardingEvidence = await getWorkspaceOnboardingEvidence(supabase, ctx);
  const onboardingState = deriveDashboardOnboardingState({ onboardingEvidence, role: ctx.role, operationalAttention: attention.map((item) => ({ id: item.id, title: item.title, href: item.destinationUrl, label: item.actionLabel || "Open" })) });
  const cashFlow = cashFlowPreview({ invoices, payments: acceptedResult.data || [], now });
  const collectedLabel = groupedMoney(metrics.collected);
  const actionCount = Math.max(attention.length, pendingCountResult.count || 0);
  const summary = capabilities.showFinancialSummary
    ? `${collectedLabel ? `You collected ${collectedLabel} this month.` : "No payments have been collected this month."} ${actionCount ? `${actionCount} ${actionCount === 1 ? "item needs" : "items need"} attention.` : "Nothing urgent needs attention."}`
    : capabilities.showProofWorkload
      ? `${pendingCountResult.count || 0} ${(pendingCountResult.count || 0) === 1 ? "proof is" : "proofs are"} waiting for review.`
      : "Here are the latest workspace updates available to you.";
  const partialData = [invoiceResult, pendingResult, pendingCountResult, acceptedResult, rejectedResult, assignmentResult].some((result) => Boolean(result.error)) || (invoiceResult.count || 0) > DASHBOARD_INVOICE_LIMIT || (acceptedResult.count || 0) > DASHBOARD_INVOICE_LIMIT;

  return (
    <AppShell role={ctx.role}>
      <PageContainer width="wide">
        <DashboardHome
          greeting={dashboardGreeting(now.getHours())}
          name={firstName(ctx.userFullName)}
          summary={summary}
          capabilities={capabilities}
          metrics={metrics}
          attention={attention}
          recentActivity={recentActivity}
          onboardingState={onboardingState}
          cashFlow={cashFlow.points}
          cashFlowCurrency={cashFlow.currency}
          partialData={partialData}
        />
      </PageContainer>
    </AppShell>
  );
}
