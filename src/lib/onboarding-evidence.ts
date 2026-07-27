import "server-only";

import { dashboardScope } from "@/lib/dashboard-scope";
import { filterCanonicalActiveWorkspaceInvoices } from "@/lib/canonical-invoices";
import type { WorkspaceContext } from "@/lib/get-workspace";
import { type PreviewDiagnosticTracker, throwInvalidFacts, throwSupabaseQueryFailure } from "@/lib/preview-render-diagnostics";
import type { createClient } from "@/lib/supabase/server";

export type OnboardingEvidence = {
  hasClient: boolean; hasInvoice: boolean; hasCompleteBusinessIdentity: boolean; hasVisualBranding: boolean;
  hasActivePaymentMethod: boolean; hasSharedPaymentRequest: boolean; hasAdditionalTeamMember: boolean;
  hasPendingTeamInvitation: boolean; requiresTeamSetup: boolean; hasBillingSetup: boolean; requiresBillingSetup: boolean;
  missingBusinessIdentityFields: string[];
};
export type OnboardingEvidenceInput = {
  clientCount: number; realInvoiceCount: number; businessName?: string | null; phone?: string | null; supportEmail?: string | null;
  hasVisualBranding?: boolean; activePaymentMethodCount: number; validPaymentTokenCount: number; shareEventCount: number;
  additionalMemberCount: number; pendingInvitationCount: number; requiresTeamSetup?: boolean; hasBillingSetup?: boolean; requiresBillingSetup?: boolean;
};
const truth = (value: string | null | undefined) => Boolean(value?.trim());
export function deriveOnboardingEvidence(input: OnboardingEvidenceInput): OnboardingEvidence {
  const missingBusinessIdentityFields = [!truth(input.businessName) ? "business_name" : null, !truth(input.phone) && !truth(input.supportEmail) ? "support_contact" : null].filter((value): value is string => Boolean(value));
  return {
    hasClient: input.clientCount > 0, hasInvoice: input.realInvoiceCount > 0,
    hasCompleteBusinessIdentity: missingBusinessIdentityFields.length === 0, hasVisualBranding: Boolean(input.hasVisualBranding),
    hasActivePaymentMethod: input.activePaymentMethodCount > 0, hasSharedPaymentRequest: input.validPaymentTokenCount > 0 || input.shareEventCount > 0,
    hasAdditionalTeamMember: input.additionalMemberCount > 0, hasPendingTeamInvitation: input.pendingInvitationCount > 0,
    requiresTeamSetup: Boolean(input.requiresTeamSetup), hasBillingSetup: Boolean(input.hasBillingSetup), requiresBillingSetup: Boolean(input.requiresBillingSetup), missingBusinessIdentityFields
  };
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;
function requireOnboardingQuery<T extends { error?: unknown }>(result: T, tracker: PreviewDiagnosticTracker | undefined) {
  if (result.error) {
    if (tracker) throwSupabaseQueryFailure(tracker, "ONBOARDING_EVIDENCE_QUERY", result.error);
    throw result.error;
  }
  return result;
}

export async function getWorkspaceOnboardingEvidence(supabase: ServerClient, ctx: WorkspaceContext, tracker?: PreviewDiagnosticTracker): Promise<OnboardingEvidence> {
  const scope = dashboardScope(ctx.workspaceId);
  const now = new Date().toISOString().slice(0, 10);
  tracker?.set("ONBOARDING_EVIDENCE_QUERY");
  const [profile, clients, invoices, methods, shares, members, invitations] = await Promise.all([
    supabase.from("profiles").select("business_name,phone,support_email,logo_storage_path").eq("id", ctx.userId).maybeSingle(),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq(...scope.workspace),
    supabase.from("invoices").select("id,workspace_id,client_id,document_type,status,public_token,revoked_at,valid_until,clients(workspace_id)").eq(...scope.workspace),
    supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq(...scope.workspace).eq("is_active", true),
    supabase.from("invoice_events").select("id", { count: "exact", head: true }).eq(...scope.workspace).in("event_type", ["reminder_copied", "payment_link_copied", "payment_link_opened"]),
    supabase.from("workspace_members").select("user_id", { count: "exact", head: true }).eq(...scope.workspace).eq("status", "active").neq("user_id", ctx.userId),
    supabase.from("workspace_invitations").select("id", { count: "exact", head: true }).eq(...scope.workspace).is("accepted_at", null)
  ]);
  requireOnboardingQuery(profile, tracker);
  requireOnboardingQuery(clients, tracker);
  requireOnboardingQuery(invoices, tracker);
  requireOnboardingQuery(methods, tracker);
  requireOnboardingQuery(shares, tracker);
  requireOnboardingQuery(members, tracker);
  requireOnboardingQuery(invitations, tracker);
  if (!invoices.data) {
    if (tracker) throwInvalidFacts(tracker, "CANONICAL_INVOICE_LOADING", "CANONICAL_INVOICE_FACTS_INVALID", "Expected onboarding invoice facts were unavailable.");
    throw new Error("Expected onboarding invoice facts were unavailable.");
  }

  tracker?.set("CANONICAL_INVOICE_LOADING");
  let rows;
  try {
    rows = filterCanonicalActiveWorkspaceInvoices(invoices.data, ctx.workspaceId);
  } catch (error) {
    if (tracker) throwInvalidFacts(tracker, "CANONICAL_INVOICE_LOADING", "RELATIONSHIP_SHAPE_INVALID", "Workspace invoice relationships could not be interpreted.");
    throw error;
  }
  const realInvoiceCount = rows.length;
  const validPaymentTokenCount = rows.filter((row) => Boolean(row.public_token) && !row.revoked_at && (!row.valid_until || row.valid_until >= now)).length;
  return deriveOnboardingEvidence({ clientCount: clients.count || 0, realInvoiceCount, businessName: profile.data?.business_name, phone: profile.data?.phone, supportEmail: profile.data?.support_email, hasVisualBranding: Boolean(profile.data?.logo_storage_path), activePaymentMethodCount: methods.count || 0, validPaymentTokenCount, shareEventCount: shares.count || 0, additionalMemberCount: members.count || 0, pendingInvitationCount: invitations.count || 0 });
}
