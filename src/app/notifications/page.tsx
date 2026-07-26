import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { dashboardScope } from "@/lib/dashboard-scope";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import {
  buildDerivedNotifications,
  deriveNotifications,
  filterNotifications,
  notificationFilter,
  type DerivedNotification,
  type NotificationFilter,
  type NotificationInvoice
} from "@/lib/notifications";
import { requireUser } from "@/lib/supabase/server";

const QUERY_LIMIT = 80;
const filters: { id: NotificationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "action", label: "Action required" },
  { id: "onboarding", label: "Onboarding" },
  { id: "payments", label: "Payments" },
  { id: "team", label: "Team" },
  { id: "system", label: "System" }
];

function filterHref(filter: NotificationFilter) {
  return filter === "all" ? "/notifications" : `/notifications?filter=${filter}`;
}

function sectionItems(items: DerivedNotification[], section: "action" | "onboarding" | "payments" | "team" | "system") {
  if (section === "action") return items.filter((item) => item.severity !== "info");
  if (section === "payments") return items.filter((item) => item.category === "payments" || item.category === "collections");
  return items.filter((item) => item.category === section);
}

function NotificationRows({ items, empty }: { items: DerivedNotification[]; empty: string }) {
  if (!items.length) return <p className="py-5 text-sm text-slate-600">{empty}</p>;
  return <ul className="divide-y divide-slate-100" aria-label="Notifications">
    {items.map((item) => <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={item.severity === "critical" ? "rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700" : item.severity === "warning" ? "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800" : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"}>{item.severity === "critical" ? "Action required" : item.severity === "warning" ? "Attention" : "Info"}</span>
          <p className="font-semibold text-ink">{item.title}</p>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.description}</p>
      </div>
      <Link href={item.destinationUrl} className="btn btn-secondary shrink-0 text-sm">{item.actionLabel || "Open"}</Link>
    </li>)}
  </ul>;
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const [{ supabase }, ctx, params] = await Promise.all([requireUser(), getWorkspaceContext(), searchParams]);
  const scope = dashboardScope(ctx.workspaceId);
  const canManageSettings = hasPermission(ctx.role, "settings.manage");
  const canViewInvoices = hasPermission(ctx.role, "invoices.view");
  const canReviewProofs = hasPermission(ctx.role, "proofs.review");
  const canManageTeam = hasPermission(ctx.role, "team.manage");
  const canWorkAssignments = hasPermission(ctx.role, "assignments.work");

  const profileQuery = canManageSettings ? supabase.from("profiles").select("business_name,phone,support_email,logo_storage_path").eq("id", ctx.userId).maybeSingle() : Promise.resolve({ data: null });
  const methodQuery = canManageSettings ? supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq(...scope.workspace).eq("is_active", true) : Promise.resolve({ count: 0 });
  const clientQuery = hasPermission(ctx.role, "clients.create") ? supabase.from("clients").select("id", { count: "exact", head: true }).eq(...scope.workspace) : Promise.resolve({ count: 0 });
  const invoiceCountQuery = hasPermission(ctx.role, "invoices.create") ? supabase.from("invoices").select("id", { count: "exact", head: true }).eq(...scope.workspace).or("document_type.is.null,document_type.neq.quote") : Promise.resolve({ count: 0 });
  const shareQuery = hasPermission(ctx.role, "invoices.send") ? supabase.from("invoice_events").select("id", { count: "exact", head: true }).eq(...scope.workspace).eq("event_type", "reminder_copied") : Promise.resolve({ count: 0 });
  const pendingProofQuery = canReviewProofs ? supabase.from("payment_proofs").select("id,invoices!inner(workspace_id)", { count: "exact", head: true }).eq(...scope.proofWorkspace).eq("status", "pending") : Promise.resolve({ count: 0 });
  const rejectedProofQuery = canReviewProofs ? supabase.from("payment_proofs").select("id,invoices!inner(workspace_id)", { count: "exact", head: true }).eq(...scope.proofWorkspace).eq("status", "rejected") : Promise.resolve({ count: 0 });
  const invoicesQuery = canViewInvoices ? supabase.from("invoices").select("id,status,document_type,currency,amount_usd,amount_lbp,due_date,created_at,payment_proofs(status,amount_usd,amount_lbp,voided_at)").eq(...scope.workspace).order("due_date", { ascending: true, nullsFirst: false }).limit(QUERY_LIMIT) : Promise.resolve({ data: [] });
  const invitationQuery = canManageTeam ? supabase.from("workspace_invitations").select("id", { count: "exact", head: true }).eq(...scope.workspace).is("accepted_at", null) : Promise.resolve({ count: 0 });
  const assignmentQuery = canWorkAssignments ? supabase.from("operational_assignments").select("id", { count: "exact", head: true }).eq(...scope.workspace).in("status", ["open", "in_progress", "waiting"]).or(`assigned_to_user_id.eq.${ctx.userId},assigned_to_role.eq.${ctx.role}`) : Promise.resolve({ count: 0 });

  const [profileResult, methodResult, clientResult, invoiceCountResult, shareResult, pendingResult, rejectedResult, invoicesResult, invitationResult, assignmentResult] = await Promise.all([
    profileQuery, methodQuery, clientQuery, invoiceCountQuery, shareQuery, pendingProofQuery, rejectedProofQuery, invoicesQuery, invitationQuery, assignmentQuery
  ]);
  const items = deriveNotifications(buildDerivedNotifications({
    profile: profileResult.data,
    activePaymentMethodCount: methodResult.count || 0,
    clientCount: clientResult.count || 0,
    invoiceCount: invoiceCountResult.count || 0,
    sharedInvoiceCount: shareResult.count || 0,
    pendingProofCount: pendingResult.count || 0,
    rejectedProofCount: rejectedResult.count || 0,
    pendingInvitationCount: invitationResult.count || 0,
    assignmentCount: assignmentResult.count || 0,
    invoices: (invoicesResult.data || []) as unknown as NotificationInvoice[]
  }), ctx.role);
  const activeFilter = notificationFilter(params.filter);
  const filtered = filterNotifications(items, activeFilter);

  return <AppShell role={ctx.role}><PageContainer width="default" className="space-y-5">
    <PageHeader eyebrow="Workspace" title="Notifications" description="Action items are derived from your current workspace state and are not stored." />
    <nav className="flex flex-wrap gap-2" aria-label="Notification filters">
      {filters.map((filter) => <Link key={filter.id} href={filterHref(filter.id)} aria-current={activeFilter === filter.id ? "page" : undefined} className={activeFilter === filter.id ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"}>{filter.label}</Link>)}
    </nav>
    <SectionCard title="Action required" description="Urgent items that need a decision or follow-up."><NotificationRows items={sectionItems(filtered, "action")} empty="No actions require attention right now." /></SectionCard>
    <SectionCard title="Onboarding" description="Setup items based on real workspace configuration."><NotificationRows items={sectionItems(filtered, "onboarding")} empty="No onboarding items match this filter." /></SectionCard>
    <SectionCard title="Payments and collections" description="Proof review and invoice follow-up supported by your role."><NotificationRows items={sectionItems(filtered, "payments")} empty="No payment or collection items match this filter." /></SectionCard>
    <SectionCard title="Team and operations" description="Invitations and assigned work available to you."><NotificationRows items={sectionItems(filtered, "team")} empty="No team or operational items match this filter." /></SectionCard>
    <SectionCard title="System" description="Safe configuration warnings appear here when supported."><NotificationRows items={sectionItems(filtered, "system")} empty="No system notifications are available." /></SectionCard>
  </PageContainer></AppShell>;
}
