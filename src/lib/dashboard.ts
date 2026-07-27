import { isQuoteDocument } from "@/lib/documents";
import {
  emptyCurrencyTotals,
  getOutstandingBalance,
  isAcceptedNonVoidedPayment,
  isDueWithinSevenDays,
  isOverdueInvoice,
  isOutstandingInvoice,
  remainingForInvoice,
  type CollectionInvoice,
  type CurrencyTotals
} from "@/lib/collection";
import { hasPermission, type WorkspaceRole } from "@/lib/permissions";
import type { OnboardingEvidence } from "@/lib/onboarding-evidence";

export const DASHBOARD_INVOICE_LIMIT = 600;
export const DASHBOARD_PROOF_LIMIT = 40;
export const DASHBOARD_ASSIGNMENT_LIMIT = 30;
export const DASHBOARD_EVENT_QUERY_LIMIT = 40;
export const DASHBOARD_ATTENTION_LIMIT = 5;
export const DASHBOARD_ACTIVITY_LIMIT = 5;

export type DashboardCapabilities = {
  showFinancialSummary: boolean;
  showProofWorkload: boolean;
  showAssignments: boolean;
  showActivity: boolean;
  canCreateInvoice: boolean;
  canRecordPayment: boolean;
  canReviewProofs: boolean;
};

export function dashboardCapabilities(role: WorkspaceRole): DashboardCapabilities {
  return {
    showFinancialSummary: hasPermission(role, "reports.view") && role !== "reviewer",
    showProofWorkload: hasPermission(role, "proofs.view"),
    showAssignments: hasPermission(role, "assignments.view"),
    showActivity: hasPermission(role, "invoices.view"),
    canCreateInvoice: hasPermission(role, "invoices.create"),
    // The current manual-payment action is owner-scoped by invoice ownership.
    canRecordPayment: role === "owner",
    canReviewProofs: hasPermission(role, "proofs.review")
  };
}

export type DashboardQueryPlan = {
  invoices: boolean;
  proofs: boolean;
  assignments: boolean;
  events: boolean;
};

export function dashboardQueryPlan(role: WorkspaceRole): DashboardQueryPlan {
  const capabilities = dashboardCapabilities(role);
  return {
    invoices: capabilities.showFinancialSummary || capabilities.canCreateInvoice,
    proofs: capabilities.showProofWorkload || capabilities.showFinancialSummary,
    assignments: capabilities.showAssignments,
    events: capabilities.showActivity
  };
}

export type DashboardInvoice = CollectionInvoice & {
  title?: string | null;
  invoice_number?: string | null;
  valid_until?: string | null;
  public_token?: string | null;
  clients?: { name?: string | null; workspace_id?: string | null } | null;
};

export type DashboardPayment = {
  id: string;
  invoice_id?: string | null;
  status?: string | null;
  amount_usd?: number | null;
  amount_lbp?: number | null;
  uploaded_at?: string | null;
  confirmed_at?: string | null;
  reviewed_at?: string | null;
  voided_at?: string | null;
  method?: string | null;
  invoices?: {
    id: string;
    title?: string | null;
    invoice_number?: string | null;
    currency?: string | null;
    workspace_id?: string | null;
    clients?: { name?: string | null; workspace_id?: string | null } | null;
  } | null;
};

export type DashboardAssignment = {
  id: string;
  target_type: string;
  target_id: string;
  assignment_type?: string | null;
  status?: string | null;
  priority?: string | null;
  due_at?: string | null;
  context?: string | null;
  created_at: string;
};

export type DashboardEvent = {
  id: string;
  invoice_id?: string | null;
  event_type: string;
  message?: string | null;
  created_at: string;
};

export type DashboardMetrics = {
  collected: CurrencyTotals;
  outstanding: CurrencyTotals;
  overdue: CurrencyTotals;
  expectedNextSevenDays: CurrencyTotals;
};

function currencyFor(row: { currency?: string | null; amount_lbp?: number | null }) {
  return (row.currency || (row.amount_lbp != null ? "LBP" : "USD")).toUpperCase() === "LBP" ? "LBP" : "USD";
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function dashboardMetrics(input: {
  invoices: DashboardInvoice[];
  payments: DashboardPayment[];
  now?: Date;
}): DashboardMetrics {
  const now = input.now || new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const today = dateOnly(now);
  const sevenDays = new Date(now);
  sevenDays.setDate(sevenDays.getDate() + 7);
  const sevenDaysIso = dateOnly(sevenDays);
  const collected = emptyCurrencyTotals();

  for (const payment of input.payments) {
    if (!isAcceptedNonVoidedPayment(payment)) continue;
    const stamp = payment.confirmed_at || payment.reviewed_at;
    if (!stamp) continue;
    const paidAt = new Date(stamp);
    if (!Number.isFinite(paidAt.getTime()) || paidAt < monthStart || paidAt >= nextMonth) continue;
    const currency = currencyFor({ currency: payment.invoices?.currency, amount_lbp: payment.amount_lbp });
    collected[currency] += currency === "LBP" ? Number(payment.amount_lbp || 0) : Number(payment.amount_usd || 0);
  }

  const billable = input.invoices.filter((invoice) => !isQuoteDocument(invoice));
  const outstanding = emptyCurrencyTotals();
  const overdue = emptyCurrencyTotals();
  const expectedNextSevenDays = emptyCurrencyTotals();
  for (const invoice of billable) {
    const balance = getOutstandingBalance(invoice);
    if (isOutstandingInvoice(invoice)) outstanding[balance.primaryCurrency] += balance.primaryBalance;
    if (isOverdueInvoice(invoice, today)) overdue[balance.primaryCurrency] += balance.primaryBalance;
    if (isDueWithinSevenDays(invoice, today, sevenDaysIso)) expectedNextSevenDays[balance.primaryCurrency] += balance.primaryBalance;
  }

  return { collected, outstanding, overdue, expectedNextSevenDays };
}

export type DashboardActionItem = {
  id: string;
  type: "proof_review" | "overdue_invoice" | "incomplete_payment" | "quote_response" | "assignment";
  priority: number;
  title: string;
  context: string;
  timestamp: string;
  actionLabel: string;
  href: string;
};

const assignmentPriority: Record<string, number> = { urgent: 0, high: 2, normal: 5, low: 7 };

function invoiceLabel(invoice: DashboardInvoice | DashboardPayment["invoices"] | null | undefined) {
  return invoice?.invoice_number || invoice?.title || "Invoice";
}

export function dashboardAttention(input: {
  invoices: DashboardInvoice[];
  payments: DashboardPayment[];
  assignments: DashboardAssignment[];
  capabilities: DashboardCapabilities;
  now?: Date;
  limit?: number;
}) {
  const items: DashboardActionItem[] = [];
  const now = input.now || new Date();
  const overdueInvoices = input.invoices.filter((invoice) => isOutstandingInvoice(invoice) && invoice.due_date && invoice.due_date < dateOnly(now));

  if (input.capabilities.showProofWorkload) {
    for (const proof of input.payments.filter((payment) => payment.status === "pending")) {
      items.push({
        id: `proof:${proof.id}`,
        type: "proof_review",
        priority: 1,
        title: invoiceLabel(proof.invoices),
        context: `${proof.invoices?.clients?.name || "Client"} submitted payment proof.`,
        timestamp: proof.uploaded_at || now.toISOString(),
        actionLabel: input.capabilities.canReviewProofs ? "Review" : "View",
        href: "/payments?view=awaiting"
      });
    }
  }

  if (input.capabilities.showFinancialSummary) {
    for (const invoice of overdueInvoices) {
      const remaining = remainingForInvoice(invoice);
      items.push({
        id: `overdue:${invoice.id}`,
        type: "overdue_invoice",
        priority: 3,
        title: invoiceLabel(invoice),
        context: `${invoice.clients?.name || "Client"} has an overdue ${remaining.primaryCurrency} balance.`,
        timestamp: invoice.due_date || now.toISOString(),
        actionLabel: "Open invoice",
        href: `/invoices/${invoice.id}`
      });
    }

    for (const proof of input.payments.filter((payment) => payment.status === "rejected")) {
      items.push({
        id: `rejected:${proof.id}`,
        type: "incomplete_payment",
        priority: 4,
        title: invoiceLabel(proof.invoices),
        context: `${proof.invoices?.clients?.name || "Client"} needs payment follow-up.`,
        timestamp: proof.reviewed_at || proof.uploaded_at || now.toISOString(),
        actionLabel: "Follow up",
        href: proof.invoice_id ? `/invoices/${proof.invoice_id}` : "/payments?view=rejected"
      });
    }

    for (const quote of input.invoices.filter((invoice) => isQuoteDocument(invoice) && ["sent", "unpaid"].includes(invoice.status))) {
      items.push({
        id: `quote:${quote.id}`,
        type: "quote_response",
        priority: 6,
        title: invoiceLabel(quote),
        context: `${quote.clients?.name || "Client"} has not responded to this quote.`,
        timestamp: quote.valid_until || quote.created_at || now.toISOString(),
        actionLabel: "Open quote",
        href: `/invoices/${quote.id}`
      });
    }
  }

  if (input.capabilities.showAssignments) {
    for (const assignment of input.assignments.filter((row) => ["open", "in_progress", "waiting"].includes(row.status || ""))) {
      items.push({
        id: `assignment:${assignment.id}`,
        type: "assignment",
        priority: assignmentPriority[assignment.priority || "normal"] ?? 5,
        title: assignment.context || "Operational assignment",
        context: assignment.due_at && assignment.due_at < now.toISOString() ? "This assignment is overdue." : "An assigned task needs action.",
        timestamp: assignment.due_at || assignment.created_at,
        actionLabel: "Open task",
        href: "/inbox"
      });
    }
  }

  return items
    .sort((a, b) => a.priority - b.priority || a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id))
    .slice(0, Math.min(Math.max(input.limit || DASHBOARD_ATTENTION_LIMIT, 1), DASHBOARD_ATTENTION_LIMIT));
}

export type DashboardActivityItem = {
  id: string;
  type: "payment_received" | "proof_submitted" | "payment_approved" | "payment_rejected" | "invoice_created" | "invoice_viewed" | "receipt_viewed";
  label: string;
  timestamp: string;
  href: string;
};

const activityLabels: Record<string, { type: DashboardActivityItem["type"]; label: string }> = {
  manual_payment: { type: "payment_received", label: "Manual payment recorded" },
  proof_uploaded: { type: "proof_submitted", label: "Payment proof submitted" },
  proof_accepted: { type: "payment_approved", label: "Payment approved" },
  proof_rejected: { type: "payment_rejected", label: "Payment proof rejected" },
  invoice_created: { type: "invoice_created", label: "Invoice created" },
  invoice_viewed: { type: "invoice_viewed", label: "Invoice viewed" },
  receipt_viewed: { type: "receipt_viewed", label: "Receipt viewed" }
};

export function dashboardActivity(events: DashboardEvent[], limit = DASHBOARD_ACTIVITY_LIMIT) {
  return events
    .filter((event) => Boolean(activityLabels[event.event_type]))
    .map((event): DashboardActivityItem => ({
      id: `event:${event.id}`,
      type: activityLabels[event.event_type].type,
      label: activityLabels[event.event_type].label,
      timestamp: event.created_at,
      href: event.invoice_id ? `/invoices/${event.invoice_id}` : "/invoices"
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id))
    .slice(0, Math.min(Math.max(limit, 1), DASHBOARD_ACTIVITY_LIMIT));
}

export type DashboardOnboardingStep = { id: "client" | "invoice" | "share"; label: string; detail: string; complete: boolean; href: string; action: string };

export function dashboardOnboarding(input: { role: WorkspaceRole; evidence: OnboardingEvidence }): DashboardOnboardingStep[] | null {
  if (input.role !== "owner" && input.role !== "admin") return null;
  const { evidence } = input;
  const steps: DashboardOnboardingStep[] = [
    { id: "client", label: "Add your first client", detail: "Save the person or business you want to collect from.", complete: evidence.hasClient, href: "/clients/new", action: "Add client" },
    { id: "invoice", label: "Create your first invoice", detail: "Set the amount, due date, and accepted payment methods.", complete: evidence.hasInvoice, href: "/invoices/new", action: "Create invoice" },
    { id: "share", label: "Share the payment link", detail: "Open your invoice and prepare the WhatsApp payment request.", complete: evidence.hasSharedPaymentRequest, href: "/invoices", action: "Open invoices" }
  ];
  return steps.every((step) => step.complete) ? null : steps;
}

export type DashboardOnboardingAction = { id: string; title: string; href: string; label: string };
export type DashboardOnboardingState = { primaryAction: DashboardOnboardingAction; setupItems: DashboardOnboardingAction[]; showNewWorkspaceState: boolean; notificationDestination: "/notifications" };
export function deriveDashboardOnboardingState(input: { onboardingEvidence: OnboardingEvidence; role: WorkspaceRole; operationalAttention?: DashboardOnboardingAction[] }): DashboardOnboardingState {
  const e = input.onboardingEvidence;
  const can = (permission: Parameters<typeof hasPermission>[1]) => hasPermission(input.role, permission);
  const candidates: DashboardOnboardingAction[] = [];
  if (!e.hasCompleteBusinessIdentity && can("settings.manage")) candidates.push({ id: e.missingBusinessIdentityFields.includes("business_name") ? "setup:business-profile" : "setup:support-contact", title: e.missingBusinessIdentityFields.includes("business_name") ? "Complete your business profile" : "Add support contact details", href: "/settings/profile", label: "Edit profile" });
  if (!e.hasClient && can("clients.create")) candidates.push({ id: "setup:first-client", title: "Create your first client", href: "/clients/new", label: "Add client" });
  if (!e.hasInvoice && can("invoices.create")) candidates.push({ id: "setup:first-invoice", title: "Create your first invoice", href: "/invoices/new", label: "Create invoice" });
  if (!e.hasActivePaymentMethod && can("settings.manage")) candidates.push({ id: "setup:payment-method", title: "Add a payment method", href: "/settings/payment-methods", label: "Add payment method" });
  if (e.hasInvoice && !e.hasSharedPaymentRequest && can("invoices.send")) candidates.push({ id: "setup:share-payment-request", title: "Share your first payment request", href: "/invoices", label: "Open invoices" });
  if (e.requiresTeamSetup && can("team.manage")) candidates.push({ id: "setup:team", title: "Set up your team", href: "/team", label: "Open team" });
  if (e.requiresBillingSetup && can("billing.manage")) candidates.push({ id: "setup:billing", title: "Complete billing setup", href: "/settings/billing", label: "Open billing" });
  const unique = [...new Map(candidates.map((item) => [`${item.title}:${item.href}`, item])).values()].slice(0, 5);
  const primaryAction = unique[0] || input.operationalAttention?.[0] || { id: "fallback:invoices", title: "Open invoices", href: "/invoices", label: "Open invoices" };
  return { primaryAction, setupItems: unique.filter((item) => item.id !== primaryAction.id), showNewWorkspaceState: !e.hasClient && !e.hasInvoice, notificationDestination: "/notifications" };
}
export function dashboardGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
