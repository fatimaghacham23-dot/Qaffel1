import { requireUser } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ASSIGNABLE_ROLES } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { TeamMemberList } from "@/components/TeamMemberList";
import { InviteTeammateForm } from "@/components/InviteTeammateForm";
import { AppShell } from "@/components/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function TeamPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();

  if (!hasPermission(ctx.role, "team.view")) {
    redirect("/dashboard");
  }

  const canManage = hasPermission(ctx.role, "team.manage");

  // Fetch workspace members
  const { data: members } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, status, invited_at, accepted_at, profiles!inner(full_name, business_name)")
    .eq("workspace_id", ctx.workspaceId)
    .neq("status", "removed")
    .order("created_at", { ascending: true });

  // Fetch pending invitations
  const { data: invitations } = canManage
    ? await supabase
        .from("workspace_invitations")
        .select("id, email, role, invited_by, expires_at, accepted_at, created_at")
        .eq("workspace_id", ctx.workspaceId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <AppShell role={ctx.role}><PageContainer width="wide" className="space-y-8 py-2"><PageHeader eyebrow="Workspace" title="Team" description="Manage your workspace team. Invite teammates, assign roles, and control access to your operational data." />

      {/* Team members */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            Members
            <span className="ml-2 text-sm font-normal text-slate-400">
              {members?.length ?? 0}
            </span>
          </h2>
        </div>
        <TeamMemberList
          members={(members ?? []).map((m) => ({
            id: m.id,
            userId: m.user_id,
            role: m.role,
            status: m.status,
            invitedAt: m.invited_at,
            acceptedAt: m.accepted_at,
            fullName: (m.profiles as unknown as { full_name: string })?.full_name ?? "Unknown",
          }))}
          currentUserId={ctx.userId}
          currentRole={ctx.role}
          workspaceId={ctx.workspaceId}
          canManage={canManage}
        />
      </section>

      {/* Pending invitations */}
      {canManage && invitations && invitations.length > 0 ? (
        <section>
          <h2 className="mb-4 text-base font-semibold text-ink">
            Pending invitations
            <span className="ml-2 text-sm font-normal text-slate-400">{invitations.length}</span>
          </h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/50 bg-white/80 px-4 py-3"
                style={{ boxShadow: "var(--q-shadow-xs)" }}
              >
                <div>
                  <p className="text-sm font-medium text-ink">{inv.email}</p>
                  <p className="text-xs text-slate-400">
                    Invited as {ROLE_LABELS[inv.role as keyof typeof ROLE_LABELS] ?? inv.role}
                    {inv.expires_at ? ` · Expires ${new Date(inv.expires_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className="rounded-full border border-amber-200/50 bg-amber-50/60 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Invite teammate */}
      {canManage ? (
        <section>
          <h2 className="mb-4 text-base font-semibold text-ink">Invite teammate</h2>
          <InviteTeammateForm workspaceId={ctx.workspaceId} />
        </section>
      ) : null}

      {/* Role reference */}
      <section>
        <h2 className="mb-4 text-base font-semibold text-ink">Role reference</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ASSIGNABLE_ROLES.map((role) => (
            <div
              key={role}
              className="rounded-xl border border-slate-200/50 bg-white/80 px-4 py-3"
              style={{ boxShadow: "var(--q-shadow-xs)" }}
            >
              <p className="text-sm font-semibold text-ink">{ROLE_LABELS[role]}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          ))}
        </div>
      </section>
    </PageContainer></AppShell>
  );
}
