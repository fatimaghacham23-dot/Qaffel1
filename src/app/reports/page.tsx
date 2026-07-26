import Link from "next/link";
import { Download, Share2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { money } from "@/lib/format";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { requireUser } from "@/lib/supabase/server";
import { buildWorkspaceMonthlyReports, type WorkspaceReportInvoice } from "@/lib/workspace-monthly-report";

export default async function ReportsPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  const [{ data: invoices }, { data: clients }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id,status,document_type,currency,amount_usd,amount_lbp,due_date,created_at,payment_proofs(status,amount_usd,amount_lbp,uploaded_at,confirmed_at,reviewed_at,method,voided_at)")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(1500),
    supabase.from("clients").select("created_at").eq("workspace_id", ctx.workspaceId).limit(1500)
  ]);
  const rows = buildWorkspaceMonthlyReports({ invoices: (invoices || []) as WorkspaceReportInvoice[], clients: clients || [] });

  return (
    <AppShell role={ctx.role}>
      <PageContainer width="wide">
        <PageHeader eyebrow="Workspace" title="Monthly reports" description="Currency-safe collection summaries from your active workspace." actions={<Link href="/export#shared-reports" className="btn btn-secondary text-xs"><Share2 className="h-4 w-4" aria-hidden />Create share link</Link>} />
        <div className="q-table-shell overflow-x-auto">
          {rows.length === 0 ? (
            <div className="p-6"><PremiumEmptyState title="No reportable invoices yet" description="Monthly rows include active invoices and accepted, non-voided payments in this workspace. Quotes and inactive documents are excluded." action={<Link className="btn btn-primary" href="/invoices/new">Create invoice</Link>} /></div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="q-table-head"><tr><th className="px-4 py-3">Month</th><th className="px-4 py-3">Currency</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Collected</th><th className="px-4 py-3">Overdue</th><th className="px-4 py-3">New clients</th><th className="px-4 py-3">Top method</th><th className="px-4 py-3">CSV</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={`${row.monthKey}-${row.currency}`} className="border-b border-slate-100/80 transition hover:bg-slate-50/60 last:border-0"><td className="px-4 py-3 font-semibold text-ink">{row.monthLabel}</td><td className="px-4 py-3">{row.currency}</td><td className="px-4 py-3">{row.invoicesCreated}</td><td className="px-4 py-3 font-mono text-xs">{money(row.collected, row.currency)}</td><td className="px-4 py-3 font-mono text-xs">{money(row.overdue, row.currency)}</td><td className="px-4 py-3">{row.newClients}</td><td className="px-4 py-3 text-slate-700">{row.topMethod ?? "-"}</td><td className="px-4 py-3"><a className="inline-flex items-center gap-1 text-xs font-bold text-cedar hover:underline" href={`/reports/csv?m=${encodeURIComponent(row.monthKey)}`}><Download className="h-3.5 w-3.5" aria-hidden />Download</a></td></tr>)}</tbody>
            </table>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500"><Link href="/settings/integrations" className="font-semibold text-cedar hover:underline">Integrations are in Settings</Link></p>
      </PageContainer>
    </AppShell>
  );
}
