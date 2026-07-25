import { createClient } from "@supabase/supabase-js";
import { E2E_PASSWORD, E2E_USERS } from "./fixtures";
import { hostedE2ESafetyError, isHostedE2E } from "@/lib/e2e-production-safe";

export default async function globalSetup() {
  const hostedSafetyError = hostedE2ESafetyError();
  if (hostedSafetyError) {
    throw new Error(hostedSafetyError);
  }

  if (isHostedE2E()) {
    throw new Error(
      "Hosted QA execution requires the dedicated production-safe test suite; local fixture setup is intentionally disabled."
    );
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) {
    throw new Error(
      "Playwright fixtures require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for a disposable local Supabase stack."
    );
  }

  const parsedUrl = new URL(url);
  const isLocalSupabase = ["127.0.0.1", "localhost", "::1"].includes(parsedUrl.hostname);
  if (!isLocalSupabase || process.env.E2E_ALLOW_FIXTURE_RESET !== "true") {
    throw new Error(
      "Refusing to reset browser-test fixtures. Use a disposable localhost Supabase stack and set E2E_ALLOW_FIXTURE_RESET=true."
    );
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const emails = Object.values(E2E_USERS);
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  for (const user of listed.users.filter((candidate) => emails.includes(candidate.email as (typeof emails)[number]))) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  async function createUser(email: string, fullName: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: E2E_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName, business_name: "Qaffel E2E" }
    });
    if (error || !data.user) throw error || new Error(`Could not create ${email}`);
    return data.user;
  }

  const created = {
    owner: await createUser(E2E_USERS.owner, "E2E Owner"),
    admin: await createUser(E2E_USERS.admin, "E2E Admin"),
    finance: await createUser(E2E_USERS.finance, "E2E Finance"),
    operations: await createUser(E2E_USERS.operations, "E2E Operations"),
    reviewer: await createUser(E2E_USERS.reviewer, "E2E Reviewer"),
    staff: await createUser(E2E_USERS.staff, "E2E Staff")
  };

  const { data: ownerMembership, error: ownerMembershipError } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", created.owner.id)
    .eq("status", "active")
    .single();
  if (ownerMembershipError || !ownerMembership) {
    throw ownerMembershipError || new Error("Owner workspace was not created.");
  }
  const workspaceId = ownerMembership.workspace_id;

  for (const role of ["admin", "finance", "operations", "reviewer", "staff"] as const) {
    const member = created[role];
    const { error: removeWorkspaceError } = await admin.from("workspaces").delete().eq("owner_id", member.id);
    if (removeWorkspaceError) throw removeWorkspaceError;
    const { error: memberError } = await admin.from("workspace_members").upsert(
      {
        workspace_id: workspaceId,
        user_id: member.id,
        role,
        status: "active",
        accepted_at: new Date().toISOString()
      },
      { onConflict: "workspace_id,user_id" }
    );
    if (memberError) throw memberError;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ business_name: "Qaffel E2E Studio", full_name: "E2E Owner", phone: "+96170000000" })
    .eq("id", created.owner.id);
  if (profileError) throw profileError;

  const { error: methodError } = await admin.from("payment_methods").insert({
    user_id: created.owner.id,
    workspace_id: workspaceId,
    type: "bank_transfer",
    label: "E2E Bank Transfer",
    instructions: "Use the invoice number as the transfer reference.",
    is_active: true
  });
  if (methodError) throw methodError;
}