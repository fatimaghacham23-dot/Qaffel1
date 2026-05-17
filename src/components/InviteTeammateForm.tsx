"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/permissions";
import { Mail, UserPlus } from "lucide-react";

export function InviteTeammateForm({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter an email address.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Check if already invited
    const { data: existing } = await supabase
      .from("workspace_invitations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", email.trim().toLowerCase())
      .is("accepted_at", null)
      .limit(1);

    if (existing && existing.length > 0) {
      setError("This email has already been invited.");
      setLoading(false);
      return;
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("id, profiles!inner(full_name)")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .limit(100);

    // Create invitation
    const { error: insertError } = await supabase
      .from("workspace_invitations")
      .insert({
        workspace_id: workspaceId,
        email: email.trim().toLowerCase(),
        role,
      });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setMessage(`Invitation sent to ${email.trim()}.`);
    setEmail("");
    setRole("staff");
    setLoading(false);
    router.refresh();
  }

  return (
    <form
      className="rounded-xl border border-slate-200/50 bg-white/80 p-5"
      style={{ boxShadow: "var(--q-shadow-card)" }}
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_160px_auto]">
        <div>
          <label className="label" htmlFor="invite-email">
            Email address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              className="field pl-9"
              id="invite-email"
              type="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="invite-role">
            Role
          </label>
          <select
            className="field"
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            className="btn btn-primary gap-1.5"
            type="submit"
            disabled={loading}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {loading ? "Sending…" : "Invite"}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className="mt-4 rounded-xl border border-emerald-200/60 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800"
          style={{ boxShadow: "var(--q-shadow-xs)" }}
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          className="mt-4 rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700"
          style={{ boxShadow: "var(--q-shadow-xs)" }}
        >
          {error}
        </div>
      ) : null}
    </form>
  );
}
