import { AppShell } from "@/components/AppShell";
import { PaymentProofsTable, type PaymentProofTableItem } from "@/components/PaymentProofsTable";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getAssignmentMembers, getAssignmentsForTargets } from "@/lib/assignment-data";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/supabase/server";

export default async function ProofsPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  const { data: proofs } = await supabase
    .from("payment_proofs")
    .select("*, invoices!inner(id, title, invoice_number, status, amount_usd, amount_lbp, user_id, workspace_id, clients(name))")
    .eq("invoices.workspace_id", ctx.workspaceId)
    .order("uploaded_at", { ascending: false });

  const assignmentMembers = await getAssignmentMembers(supabase, ctx.workspaceId);
  const assignmentsByProof = await getAssignmentsForTargets({
    supabase,
    workspaceId: ctx.workspaceId,
    targetType: "proof",
    targetIds: (proofs || []).map((proof) => proof.id),
    members: assignmentMembers
  });

  // Generate signed URLs for payment proofs
  const proofsWithSignedUrls = await Promise.all(
    (proofs || []).map(async (proof) => {
      const withAssignments = {
        ...proof,
        assignments: assignmentsByProof.get(proof.id) || []
      };
      if (!proof.image_url) return withAssignments;
      if (proof.image_url.startsWith("http")) return withAssignments;

      const { data } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(proof.image_url, 3600);

      return {
        ...withAssignments,
        image_url: data?.signedUrl || proof.image_url,
      };
    })
  );
  const pendingCount = proofsWithSignedUrls.filter((proof) => proof.status === "pending").length;
  const acceptedCount = proofsWithSignedUrls.filter((proof) => proof.status === "accepted").length;
  const voidedCount = proofsWithSignedUrls.filter((proof) => proof.status === "voided").length;

  return (
    <AppShell>
      <SettingsPageHeader
        title="Payment proofs"
        subtitle="Review payment proofs, accept full or partial payments, and track invoice balances."
      />

      <div className="mb-6 rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Proof review queue</p>
            <p className="mt-1.5 text-sm text-slate-600">Pending uploads, accepted payments, and voided payments stay visible for audit review.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={pendingCount > 0 ? "pending" : "complete"} label={`${pendingCount} pending`} />
            <StatusBadge status="accepted" label={`${acceptedCount} accepted`} />
            <StatusBadge status={voidedCount > 0 ? "voided" : "neutral"} label={`${voidedCount} voided`} />
          </div>
        </div>
      </div>

      <div className="min-w-0 w-full max-w-none">
        <PaymentProofsTable
          assignmentMembers={assignmentMembers}
          canManageAssignments={hasPermission(ctx.role, "assignments.manage")}
          initialProofs={proofsWithSignedUrls as PaymentProofTableItem[]}
        />
      </div>
    </AppShell>
  );
}
