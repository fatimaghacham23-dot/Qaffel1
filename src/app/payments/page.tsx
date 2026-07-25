import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { PaymentProofsTable, type PaymentProofTableItem } from "@/components/PaymentProofsTable";
import { PaymentsView, type PaymentRow } from "@/components/PaymentsView";
import { getAssignmentMembers, getAssignmentsForTargets } from "@/lib/assignment-data";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import { canAccessPaymentView, paymentViewsForRole } from "@/lib/payment-access";
import { manualPaymentIds } from "@/lib/payment-history";
import { paymentViews, resolvePaymentView, type PaymentView } from "@/lib/payments-view";
import { requireUser } from "@/lib/supabase/server";
import { buildEligibleReceiptUrl } from "@/lib/urls";

const labels: Record<PaymentView,string> = { awaiting:"Awaiting review", approved:"Approved", rejected:"Rejected", manual:"Manual payments", receipts:"Receipts", history:"Recent payment activity" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { supabase } = await requireUser(); const ctx = await getWorkspaceContext();
  if (!hasPermission(ctx.role, "proofs.view")) return <AppShell role={ctx.role}><p className="panel">You do not have access to payments.</p></AppShell>;
  const params = await searchParams;
  const { count } = await supabase.from("payment_proofs").select("id, invoices!inner(workspace_id)", { count:"exact", head:true }).eq("invoices.workspace_id", ctx.workspaceId).eq("status", "pending");
  const resolved = resolvePaymentView(params.view, count || 0); const permittedViews = paymentViewsForRole(ctx.role); const view = canAccessPaymentView(ctx.role, resolved) ? resolved : permittedViews[0]; if (!view) return <AppShell role={ctx.role}><p className="panel">You do not have access to payments.</p></AppShell>;
  const nav = <nav className="mb-5 flex flex-wrap gap-2">{permittedViews.map(v => <Link key={v} href={`/payments?view=${v}`} className={v === view ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"}>{labels[v]}</Link>)}</nav>;
  if (view === "awaiting") {
    const { data } = await supabase.from("payment_proofs").select("*, invoices!inner(id,title,invoice_number,status,amount_usd,amount_lbp,user_id,workspace_id,clients(name))").eq("invoices.workspace_id", ctx.workspaceId).eq("status", "pending").order("uploaded_at", { ascending:true }).limit(50);
    const members = await getAssignmentMembers(supabase, ctx.workspaceId);
    const assignments = await getAssignmentsForTargets({ supabase, workspaceId:ctx.workspaceId, targetType:"proof", targetIds:(data || []).map(p => p.id), members });
    const rows = await Promise.all((data || []).map(async p => { const item:any = { ...p, assignments: assignments.get(p.id) || [], receipt_url: buildEligibleReceiptUrl(p) }; if (p.image_url && !p.image_url.startsWith("http")) { const signed = await supabase.storage.from("payment-proofs").createSignedUrl(p.image_url, 3600); item.image_url = signed.data?.signedUrl || null; } return item; }));
    return <AppShell role={ctx.role}><header className="mb-6"><p className="q-section-label">Collections</p><h1 className="mt-1 text-3xl font-semibold text-ink">Payments</h1></header>{nav}<PaymentProofsTable initialProofs={rows as PaymentProofTableItem[]} assignmentMembers={members} canManageAssignments={hasPermission(ctx.role, "assignments.manage")} /></AppShell>;
  }
  let q = supabase.from("payment_proofs").select("id,status,amount_usd,amount_lbp,method,uploaded_at,confirmed_at,reviewed_at,payment_date,voided_at,reviewer_decision_note,receipt_token,invoice_id,invoices!inner(title,invoice_number,workspace_id,clients(name))").eq("invoices.workspace_id", ctx.workspaceId).limit(50);
  if (view === "approved" || view === "receipts") q = q.eq("status", "accepted").order("confirmed_at", { ascending:false }); else if (view === "rejected") q = q.eq("status", "rejected").order("reviewed_at", { ascending:false }); else q = q.order("uploaded_at", { ascending:false });
  const { data } = await q; const paymentRows = (data || []) as unknown as PaymentRow[];
  let rows = paymentRows;
  if (view === "manual") { const events = await supabase.from("invoice_events").select("id,invoice_id,created_at,actor_name,metadata").eq("workspace_id", ctx.workspaceId).eq("event_type", "manual_payment").limit(50); const ids = manualPaymentIds((events.data || []) as any, paymentRows as any); rows = paymentRows.filter(r => ids.has(r.id)); }
  if (view === "receipts") rows = rows.filter(r => Boolean(r.receipt_token) && !r.voided_at);
  return <AppShell role={ctx.role}><header className="mb-6"><p className="q-section-label">Collections</p><h1 className="mt-1 text-3xl font-semibold text-ink">Payments</h1></header>{nav}<PaymentsView view={view} rows={rows} /></AppShell>;
}
