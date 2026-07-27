import "server-only";

import { dashboardScope } from "@/lib/dashboard-scope";
import { filterCanonicalActiveWorkspaceInvoices } from "@/lib/canonical-invoices";
import type { WorkspaceContext } from "@/lib/get-workspace";
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
export const ONBOARDING_INVOICE_FACTS_SELECT = "id,workspace_id,client_id,document_type,status,public_token,valid_until,clients(workspace_id)";

export function onboardingQueryResultOrThrow<T extends { error?: unknown }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}

export async function getWorkspaceOnboardingEvidence(supabase: ServerClient, ctx: WorkspaceContext): Promise<OnboardingEvidence> {
  const scope = dashboardScope(ctx.workspaceId);
  const now = new Date().toISOString().slice(0, 10);
  const [profile, clients, invoices, methods, shares, members, invitations] = await Promise.all([
    supabase.from("profiles").select("business_name,phone,support_email,logo_storage_path").eq("id", ctx.userId).maybeSingle(),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq(...scope.workspace),
    supabase.from("invoices").select(ONBOARDING_INVOICE_FACTS_SELECT).eq(...scope.workspace),
    supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq(...scope.workspace).eq("is_active", true),
    supabase.from("invoice_events").select("id", { count: "exact", head: true }).eq(...scope.workspace).in("event_type", ["reminder_copied", "payment_link_copied", "payment_link_opened"]),
    supabase.from("workspace_members").select("user_id", { count: "exact", head: true }).eq(...scope.workspace).eq("status", "active").neq("user_id", ctx.userId),
    supabase.from("workspace_invitations").select("id", { count: "exact", head: true }).eq(...scope.workspace).is("accepted_at", null)
  ]);
  onboardingQueryResultOrThrow(profile);
  onboardingQueryResultOrThrow(clients);
  onboardingQueryResultOrThrow(invoices);
  onboardingQueryResultOrThrow(methods);
  onboardingQueryResultOrThrow(shares);
  onboardingQueryResultOrThrow(members);
  onboardingQueryResultOrThrow(invitations);
  if (!invoices.data) throw new Error("Workspace onboarding invoice facts were unavailable.");
  const rows = filterCanonicalActiveWorkspaceInvoices(invoices.data, ctx.workspaceId);
  const realInvoiceCount = rows.length;
  const validPaymentTokenCount = rows.filter((row) => Boolean(row.public_token) && (!row.valid_until || row.valid_until >= now)).length;
  return deriveOnboardingEvidence({ clientCount: clients.count || 0, realInvoiceCount, businessName: profile.data?.business_name, phone: profile.data?.phone, supportEmail: profile.data?.support_email, hasVisualBranding: Boolean(profile.data?.logo_storage_path), activePaymentMethodCount: methods.count || 0, validPaymentTokenCount, shareEventCount: shares.count || 0, additionalMemberCount: members.count || 0, pendingInvitationCount: invitations.count || 0 });
}
