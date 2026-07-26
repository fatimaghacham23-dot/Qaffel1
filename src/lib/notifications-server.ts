import "server-only";

import { dashboardScope } from "@/lib/dashboard-scope";
import { type WorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import { buildDerivedNotifications, deriveNotifications, type NotificationInvoice } from "@/lib/notifications";
import { type createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
const QUERY_LIMIT = 80;

export async function getWorkspaceNotifications(supabase: ServerClient, ctx: WorkspaceContext) {
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
  const pendingQuery = canReviewProofs ? supabase.from("payment_proofs").select("id,invoices!inner(workspace_id)", { count: "exact", head: true }).eq(...scope.proofWorkspace).eq("status", "pending") : Promise.resolve({ count: 0 });
  const rejectedQuery = canReviewProofs ? supabase.from("payment_proofs").select("id,invoices!inner(workspace_id)", { count: "exact", head: true }).eq(...scope.proofWorkspace).eq("status", "rejected") : Promise.resolve({ count: 0 });
  const invoicesQuery = canViewInvoices ? supabase.from("invoices").select("id,status,document_type,currency,amount_usd,amount_lbp,due_date,created_at,payment_proofs(status,amount_usd,amount_lbp,voided_at)").eq(...scope.workspace).order("due_date", { ascending: true, nullsFirst: false }).limit(QUERY_LIMIT) : Promise.resolve({ data: [] });
  const invitationsQuery = canManageTeam ? supabase.from("workspace_invitations").select("id", { count: "exact", head: true }).eq(...scope.workspace).is("accepted_at", null) : Promise.resolve({ count: 0 });
  const assignmentsQuery = canWorkAssignments ? supabase.from("operational_assignments").select("id", { count: "exact", head: true }).eq(...scope.workspace).in("status", ["open", "in_progress", "waiting"]).or(`assigned_to_user_id.eq.${ctx.userId},assigned_to_role.eq.${ctx.role}`) : Promise.resolve({ count: 0 });
  const [profile, methods, clients, invoicesCount, shares, pending, rejected, invoices, invitations, assignments] = await Promise.all([profileQuery, methodQuery, clientQuery, invoiceCountQuery, shareQuery, pendingQuery, rejectedQuery, invoicesQuery, invitationsQuery, assignmentsQuery]);
  return deriveNotifications(buildDerivedNotifications({
    profile: profile.data,
    activePaymentMethodCount: methods.count || 0, clientCount: clients.count || 0, invoiceCount: invoicesCount.count || 0,
    sharedInvoiceCount: shares.count || 0, pendingProofCount: pending.count || 0, rejectedProofCount: rejected.count || 0,
    pendingInvitationCount: invitations.count || 0, assignmentCount: assignments.count || 0,
    invoices: (invoices.data || []) as unknown as NotificationInvoice[]
  }), ctx.role);
}
