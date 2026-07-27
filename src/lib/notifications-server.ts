import "server-only";

import { dashboardScope } from "@/lib/dashboard-scope";
import { filterCanonicalWorkspaceInvoices } from "@/lib/canonical-invoices";
import { type WorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import { buildDerivedNotifications, deriveNotifications, type NotificationInvoice } from "@/lib/notifications";
import { type createClient } from "@/lib/supabase/server";
import { getWorkspaceOnboardingEvidence, type OnboardingEvidence } from "@/lib/onboarding-evidence";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
const QUERY_LIMIT = 80;

export async function getWorkspaceNotifications(supabase: ServerClient, ctx: WorkspaceContext, onboardingEvidence?: OnboardingEvidence) {
  const scope = dashboardScope(ctx.workspaceId);
  const canManageSettings = hasPermission(ctx.role, "settings.manage");
  const canViewInvoices = hasPermission(ctx.role, "invoices.view");
  const canReviewProofs = hasPermission(ctx.role, "proofs.review");
  const canManageTeam = hasPermission(ctx.role, "team.manage");
  const canWorkAssignments = hasPermission(ctx.role, "assignments.work");
  const evidenceQuery = onboardingEvidence ? Promise.resolve(onboardingEvidence) : getWorkspaceOnboardingEvidence(supabase, ctx);
  const pendingQuery = canReviewProofs ? supabase.from("payment_proofs").select("id,invoices!inner(workspace_id)", { count: "exact", head: true }).eq(...scope.proofWorkspace).eq("status", "pending") : Promise.resolve({ count: 0 });
  const rejectedQuery = canReviewProofs ? supabase.from("payment_proofs").select("id,invoices!inner(workspace_id)", { count: "exact", head: true }).eq(...scope.proofWorkspace).eq("status", "rejected") : Promise.resolve({ count: 0 });
  const invoicesQuery = canViewInvoices ? supabase.from("invoices").select("id,workspace_id,client_id,status,document_type,currency,amount_usd,amount_lbp,due_date,created_at,clients(workspace_id),payment_proofs(status,amount_usd,amount_lbp,voided_at)").eq(...scope.workspace).order("due_date", { ascending: true, nullsFirst: false }).limit(QUERY_LIMIT) : Promise.resolve({ data: [] });
  const invitationsQuery = canManageTeam ? supabase.from("workspace_invitations").select("id", { count: "exact", head: true }).eq(...scope.workspace).is("accepted_at", null) : Promise.resolve({ count: 0 });
  const assignmentsQuery = canWorkAssignments ? supabase.from("operational_assignments").select("id", { count: "exact", head: true }).eq(...scope.workspace).in("status", ["open", "in_progress", "waiting"]).or(`assigned_to_user_id.eq.${ctx.userId},assigned_to_role.eq.${ctx.role}`) : Promise.resolve({ count: 0 });
  const [evidence, pending, rejected, invoices, invitations, assignments] = await Promise.all([evidenceQuery, pendingQuery, rejectedQuery, invoicesQuery, invitationsQuery, assignmentsQuery]);
  return deriveNotifications(buildDerivedNotifications({
    onboardingEvidence: evidence, pendingProofCount: pending.count || 0, rejectedProofCount: rejected.count || 0,
    pendingInvitationCount: invitations.count || 0, assignmentCount: assignments.count || 0,
    invoices: filterCanonicalWorkspaceInvoices(invoices.data || [], ctx.workspaceId) as NotificationInvoice[]
  }), ctx.role);
}
