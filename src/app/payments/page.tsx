import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PaymentProofsTable, type PaymentProofTableItem } from "@/components/PaymentProofsTable";
import { PaymentsView, type PaymentRow } from "@/components/PaymentsView";
import { getAssignmentMembers, getAssignmentsForTargets } from "@/lib/assignment-data";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import { canAccessPaymentView, paymentViewsForRole } from "@/lib/payment-access";
import { manualPaymentIds } from "@/lib/payment-history";
import { resolvePaymentView, type PaymentView } from "@/lib/payments-view";
import { requireUser } from "@/lib/supabase/server";
import { buildEligibleReceiptUrl } from "@/lib/urls";

const labels: Record<PaymentView, string> = { awaiting: "Awaiting review", approved: "Approved", rejected: "Rejected", manual: "Manual payments", receipts: "Receipts", history: "Recent payment activity" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  if (!hasPermission(ctx.role, "proofs.view")) return <AppShell role={ctx.role}><PageContainer width="wide"><p className="panel">You do not have access to payments.</p></PageContainer></AppShell>;
  const params = await searchParams;
  const { count } = await supabase.from("payment_proofs").select("id, invoices!inner(workspace_id)", { count: "exact", head: true }).eq("invoices.workspace_id", ctx.workspaceId).eq("status", "pending");
  const resolved = resolvePaymentView(params.view, count || 0);
  const permittedViews = paymentViewsForRole(ctx.role);
  const view = canAccessPaymentView(ctx.role, resolved) ? resolved : permittedViews[0];
  if (!view) return <AppShell role={ctx.role}><PageContainer width="wide"><p className="panel">You do not have access to payments.</p></PageContainer></AppShell>;
  const nav = <nav aria-label="Payment views" className="mb-5 flex flex-wrap gap-2">{permittedViews.map((candidate) => <Link key={candidate} href={`/payments?view=${candidate}`} aria-current={candidate === view ? "page" : undefined} className={candidate === view ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"}>{labels[candidate]}</Link>)}</nav>;
  const header = <PageHeader eyebrow="Collections" title="Payments" description="Review payment activity, proof status, and receipt eligibility in the selected collection view." />;

  if (view === "awaiting") {
    const { data } = await supabase.from("payment_proofs").select("*, invoices!inner(id,title,invoice_number,status,amount_usd,amount_lbp,user_id,workspace_id,clients(name))").eq("invoices.workspace_id", ctx.workspaceId).eq("status", "pending").order("uploaded_at", { ascending: true }).limit(50);
    const members = await getAssignmentMembers(supabase, ctx.workspaceId);
    const assignments = await getAssignmentsForTargets({ supabase, workspaceId: ctx.workspaceId, targetType: "proof", targetIds: (data || []).map((proof) => proof.id), members });
    const rows = await Promise.all((data || []).map(async (proof) => { const item: any = { ...proof, assignments: assignments.get(proof.id) || [], receipt_url: buildEligibleReceiptUrl(proof) }; if (proof.image_url && !proof.image_url.startsWith("http")) { const signed = await supabase.storage.from("payment-proofs").createSignedUrl(proof.image_url, 3600); item.image_url = signed.data?.signedUrl || null; } return item; }));
    return <AppShell role={ctx.role}><PageContainer width="wide">{header}{nav}<PaymentProofsTable initialProofs={rows as PaymentProofTableItem[]} assignmentMembers={members} canManageAssignments={hasPermission(ctx.role, "assignments.manage")} /></PageContainer></AppShell>;
  }

  let query = supabase.from("payment_proofs").select("id,status,amount_usd,amount_lbp,method,uploaded_at,confirmed_at,reviewed_at,payment_date,voided_at,reviewer_decision_note,receipt_token,invoice_id,invoices!inner(title,invoice_number,workspace_id,clients(name))").eq("invoices.workspace_id", ctx.workspaceId).limit(50);
  if (view === "approved" || view === "receipts") query = query.eq("status", "accepted").order("confirmed_at", { ascending: false }); else if (view === "rejected") query = query.eq("status", "rejected").order("reviewed_at", { ascending: false }); else query = query.order("uploaded_at", { ascending: false });
  const { data } = await query;
  const paymentRows = (data || []).map((payment) => ({ ...payment, receipt_url: buildEligibleReceiptUrl(payment) })) as unknown as PaymentRow[];
  let rows = paymentRows;
  if (view === "manual") { const events = await supabase.from("invoice_events").select("id,invoice_id,created_at,actor_name,metadata").eq("workspace_id", ctx.workspaceId).eq("event_type", "manual_payment").limit(50); const ids = manualPaymentIds((events.data || []) as any, paymentRows as any); rows = paymentRows.filter((row) => ids.has(row.id)); }
  if (view === "receipts") rows = rows.filter((row) => Boolean(row.receipt_url));
  return <AppShell role={ctx.role}><PageContainer width="wide">{header}{nav}<PaymentsView view={view} rows={rows} /></PageContainer></AppShell>;
}