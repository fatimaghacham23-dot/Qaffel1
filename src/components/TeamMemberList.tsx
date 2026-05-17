"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { ROLE_LABELS, ASSIGNABLE_ROLES, type WorkspaceRole } from "@/lib/permissions";
import { UserCircle, MoreHorizontal, ShieldCheck, Trash2 } from "lucide-react";

type Member = {
  id: string;
  userId: string;
  role: string;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
  fullName: string;
};

export function TeamMemberList({
  members,
  currentUserId,
  currentRole,
  workspaceId,
  canManage,
}: {
  members: Member[];
  currentUserId: string;
  currentRole: WorkspaceRole;
  workspaceId: string;
  canManage: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function changeRole(memberId: string, newRole: string) {
    setLoading(memberId);
    const supabase = createClient();
    await supabase
      .from("workspace_members")
      .update({ role: newRole })
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);
    router.refresh();
    setLoading(null);
  }

  async function removeMember(memberId: string) {
    if (!confirm("Remove this team member? They will lose access to workspace data.")) return;
    setLoading(memberId);
    const supabase = createClient();
    await supabase
      .from("workspace_members")
      .update({ status: "removed" })
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const isCurrentUser = member.userId === currentUserId;
        const isOwner = member.role === "owner";
        const canEdit = canManage && !isCurrentUser && !isOwner;

        return (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/50 bg-white/80 px-4 py-3 transition-[border-color] duration-q hover:border-slate-200/80"
            style={{ boxShadow: "var(--q-shadow-xs)" }}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
                <UserCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {member.fullName}
                  {isCurrentUser ? (
                    <span className="ml-1.5 text-xs text-slate-400">(you)</span>
                  ) : null}
                </p>
                <p className="text-xs text-slate-400">
                  {ROLE_LABELS[member.role as WorkspaceRole] ?? member.role}
                  {member.status === "pending" ? " · Invitation pending" : ""}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {canEdit ? (
                <>
                  <select
                    className="rounded-lg border border-slate-200/70 bg-white/90 px-2 py-1.5 text-xs font-medium text-slate-600 outline-none transition-[border-color] duration-q focus:border-cedar/50"
                    value={member.role}
                    onChange={(e) => changeRole(member.id, e.target.value)}
                    disabled={loading === member.id}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors duration-q hover:bg-red-50 hover:text-red-600"
                    onClick={() => removeMember(member.id)}
                    disabled={loading === member.id}
                    title="Remove member"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <span className="rounded-full border border-slate-200/50 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  {ROLE_LABELS[member.role as WorkspaceRole] ?? member.role}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
