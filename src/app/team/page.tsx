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
import { deriveTeamRoster } from "@/lib/team-roster";
import { TeamSummary } from "@/components/TeamSummary";

export default async function TeamPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();

  if (!hasPermission(ctx.role, "team.view")) {
    redirect("/dashboard");
  }

  const canManage = hasPermission(ctx.role, "team.manage");

  const [{ data: workspace }, { data: members }, { data: invitations }] = await Promise.all([
    supabase.from("workspaces").select("owner_id").eq("id", ctx.workspaceId).maybeSingle(),
    supabase.from("workspace_members").select("id, user_id, role, status, invited_at, accepted_at, profiles!inner(full_name, business_name, email)").eq("workspace_id", ctx.workspaceId).neq("status", "removed").order("created_at", { ascending: true }).limit(200),
    canManage ? supabase.from("workspace_invitations").select("id, email, role, invited_by, expires_at, accepted_at, created_at").eq("workspace_id", ctx.workspaceId).is("accepted_at", null).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] })
  ]);
  const ownerId = workspace?.owner_id || null;
  const { data: ownerProfile } = ownerId ? await supabase.from("profiles").select("full_name, email").eq("id", ownerId).maybeSingle() : { data: null };
  const roster = deriveTeamRoster({ workspaceId: ctx.workspaceId, ownerId, ownerProfile: ownerProfile ? { fullName: ownerProfile.full_name, email: ownerProfile.email } : null, memberships: (members || []).map((member) => ({ workspaceId: ctx.workspaceId, userId: member.user_id, role: member.role as typeof ctx.role, status: member.status, profile: { fullName: (member.profiles as { full_name?: string } | null)?.full_name, email: (member.profiles as { email?: string } | null)?.email } })), pendingInvitations: (invitations || []).map((invitation) => ({ key: invitation.id, email: invitation.email, role: invitation.role, status: "pending" })), viewerRole: ctx.role });  return (
    <AppShell role={ctx.role}><PageContainer width="wide" className="space-y-8 py-2"><PageHeader eyebrow="Workspace" title="Team" description="Manage your workspace team. Invite teammates, assign roles, and control access to your operational data." />

      {/* Team members */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">
            People <span className="ms-2 text-sm font-normal text-slate-400">{roster.totalPeople}</span>
            <TeamSummary additionalMemberCount={roster.additionalMemberCount} pendingInvitationCount={roster.pendingInvitationCount} />
          </h2>
        </div>
        <TeamMemberList
          members={[...(roster.owner ? [{ id: roster.owner.key, userId: ownerId || "", role: "owner", status: roster.owner.status, invitedAt: "", acceptedAt: null, fullName: roster.owner.displayName }] : []), ...roster.members.map((member) => ({ id: member.key, userId: member.key, role: member.role, status: member.status, invitedAt: "", acceptedAt: null, fullName: member.displayName }))]}          currentUserId={ctx.userId}
          currentRole={ctx.role}
          workspaceId={ctx.workspaceId}
          canManage={canManage}
        />
      </section>

      {roster.additionalMemberCount === 0 ? <p className="-mt-2 text-sm text-slate-500">No additional members yet.</p> : null}

      {/* Pending invitations */}
      {canManage && roster.pendingInvitations.length > 0 ? (
        <section>
          <h2 className="mb-4 text-base font-semibold text-ink">
            Pending invitations
            <span className="ml-2 text-sm font-normal text-slate-400">{roster.pendingInvitationCount}</span>
          </h2>
          <div className="space-y-2">
            {roster.pendingInvitations.map((inv) => (
              <div
                key={inv.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/50 bg-white/80 px-4 py-3"
                style={{ boxShadow: "var(--q-shadow-xs)" }}
              >
                <div>
                  <p className="text-sm font-medium text-ink">{inv.email}</p>
                  <p className="text-xs text-slate-400">
                    Invited as {ROLE_LABELS[inv.role as keyof typeof ROLE_LABELS] ?? inv.role}
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
