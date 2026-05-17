import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttentionCenterView } from "@/components/AttentionCenterView";
import { OperationalPresenceHeartbeat } from "@/components/OperationalPresenceHeartbeat";
import { getAssignmentMembers, getWorkspaceAssignments } from "@/lib/assignment-data";
import { assignmentTargetHref, type OperationalAssignmentRow } from "@/lib/assignments";
import { getWorkspaceContext } from "@/lib/get-workspace";
import {
  buildAttentionCenterModel,
  type AttentionApprovalRow,
  type AttentionEventRow,
  type AttentionInvoiceRow,
  type AttentionProofRow
} from "@/lib/operational-notifications";
import { buildOperationalPresenceModel, type PresenceSessionRow } from "@/lib/operational-presence";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/supabase/server";

type InvoiceLabelRow = {
  id: string;
  invoice_number?: string | null;
  title?: string | null;
  clients?: { name?: string | null } | null;
};

type ProofLabelRow = {
  id: string;
  invoice_id?: string | null;
  invoices?: InvoiceLabelRow | InvoiceLabelRow[] | null;
};

type ClientLabelRow = {
  id: string;
  name?: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function invoiceLabel(row: InvoiceLabelRow | null | undefined) {
  if (!row) return "Invoice";
  return row.invoice_number ? `${row.invoice_number} - ${row.title || "Invoice"}` : row.title || "Invoice";
}

function hydrateAssignmentLabels(
  assignments: OperationalAssignmentRow[],
  invoices: InvoiceLabelRow[],
  proofs: ProofLabelRow[],
  clients: ClientLabelRow[]
) {
  const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const proofMap = new Map(proofs.map((proof) => [proof.id, proof]));
  const clientMap = new Map(clients.map((client) => [client.id, client]));

  return assignments.map((assignment) => {
    const proof = assignment.target_type === "proof" ? proofMap.get(assignment.target_id) : null;
    const proofInvoice = one(proof?.invoices);
    const invoice =
      proofInvoice ||
      (proof?.invoice_id ? invoiceMap.get(proof.invoice_id) : null) ||
      invoiceMap.get(assignment.target_id) ||
      null;

    const targetLabel =
      assignment.target_type === "proof"
        ? `Proof waiting: ${invoiceLabel(invoice)}`
        : assignment.target_type === "recovery"
          ? `Recovery: ${invoiceLabel(invoice)}`
          : assignment.target_type === "payment_plan"
            ? `Payment plan: ${invoiceLabel(invoice)}`
            : assignment.target_type === "client_follow_up"
              ? `Client follow-up: ${clientMap.get(assignment.target_id)?.name || "Client"}`
              : assignment.target_type === "approval"
                ? "Approval request"
                : invoiceLabel(invoice);

    return {
      ...assignment,
      target_label: targetLabel,
      target_href: assignmentTargetHref(assignment.target_type, assignment.target_id, proof?.invoice_id || invoice?.id || null),
      client_name: invoice?.clients?.name || clientMap.get(assignment.target_id)?.name || assignment.client_name || null
    };
  });
}

export default async function OperationalInboxPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();

  if (!hasPermission(ctx.role, "assignments.view")) {
    redirect("/dashboard");
  }

  const presenceCutoff = new Date();
  presenceCutoff.setMinutes(presenceCutoff.getMinutes() - 10);
  const members = await getAssignmentMembers(supabase, ctx.workspaceId);
  const [assignments, proofResult, invoiceResult, eventResult, approvalResult, clientResult, presenceResult] = await Promise.all([
    getWorkspaceAssignments({ supabase, workspaceId: ctx.workspaceId, members }),
    supabase
      .from("payment_proofs")
      .select(
        "id, invoice_id, status, uploaded_at, reviewed_at, confirmed_at, method, amount_usd, amount_lbp, payment_date, invoices!inner(id, title, invoice_number, status, document_type, client_id, amount_usd, amount_lbp, currency, due_date, valid_until, created_at, payment_plan, exchange_rate_lbp_per_usd, workspace_id, clients(id, name, phone, email))"
      )
      .eq("invoices.workspace_id", ctx.workspaceId)
      .order("uploaded_at", { ascending: false })
      .limit(500),
    supabase
      .from("invoices")
      .select(
        "id, title, invoice_number, status, document_type, client_id, amount_usd, amount_lbp, currency, due_date, valid_until, created_at, payment_plan, exchange_rate_lbp_per_usd, clients(id, name, phone, email), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, reviewed_at, payment_date, method)"
      )
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1200),
    supabase
      .from("invoice_events")
      .select("id, invoice_id, event_type, message, created_at, actor_id, actor_name, actor_role, metadata")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(2500),
    supabase
      .from("workspace_approvals")
      .select("id, type, reference_id, reference_type, requested_by, status, note, threshold_usd, created_at, resolved_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("clients")
      .select("id, name")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1200),
    supabase
      .from("operational_presence_sessions")
      .select("id, user_id, user_name, user_role, scope, entity_type, entity_id, label, target_href, last_seen_at, expires_at")
      .eq("workspace_id", ctx.workspaceId)
      .gt("expires_at", presenceCutoff.toISOString())
      .order("last_seen_at", { ascending: false })
      .limit(80)
  ]);

  const proofRows = ((proofResult.data || []) as unknown as AttentionProofRow[]).map((proof) => ({
    ...proof,
    invoices: one(proof.invoices)
  }));
  const invoiceRows = (invoiceResult.data || []) as AttentionInvoiceRow[];
  const enrichedAssignments = hydrateAssignmentLabels(
    assignments,
    invoiceRows as InvoiceLabelRow[],
    proofRows as ProofLabelRow[],
    (clientResult.data || []) as ClientLabelRow[]
  );

  const model = buildAttentionCenterModel({
    userId: ctx.userId,
    role: ctx.role,
    invoices: invoiceRows,
    proofs: proofRows,
    assignments: enrichedAssignments,
    events: (eventResult.data || []) as AttentionEventRow[],
    approvals: (approvalResult.data || []) as AttentionApprovalRow[],
    members
  });
  const presenceModel = buildOperationalPresenceModel({
    userId: ctx.userId,
    role: ctx.role,
    invoices: invoiceRows,
    proofs: proofRows,
    assignments: enrichedAssignments,
    events: (eventResult.data || []) as AttentionEventRow[],
    approvals: (approvalResult.data || []) as AttentionApprovalRow[],
    sessions: (presenceResult.data || []) as PresenceSessionRow[]
  });

  return (
    <AppShell>
      <OperationalPresenceHeartbeat scope="assignments" label="Attention center" targetHref="/inbox" />
      <AttentionCenterView model={model} presenceModel={presenceModel} />
    </AppShell>
  );
}
