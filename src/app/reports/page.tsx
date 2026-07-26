import Link from "next/link";
import { Download, Share2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { requireUser } from "@/lib/supabase/server";
import { buildIntelligenceBundle } from "@/lib/intelligence-layer";
import type { OCInvoiceRow } from "@/lib/operations-center";

export default async function ReportsPage() {
  const { supabase, user } = await requireUser();
  const [{ data: invoices }, { data: events }, { data: clients }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "*, exchange_rate_lbp_per_usd, clients(id, name, phone, email), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, payment_date, method, voided_at)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoice_events")
      .select("id, invoice_id, event_type, message, created_at, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("clients").select("id, name, created_at").eq("user_id", user.id)
  ]);

  const bundle = buildIntelligenceBundle({
    invoices: (invoices || []) as OCInvoiceRow[],
    events: (events || []) as any,
    clients: (clients || []) as { id: string; name: string | null; created_at: string }[]
  });

  return (
    <AppShell>
      <PageContainer width="wide">
      <PageHeader eyebrow="Workspace" title="Monthly reports" description="Internal summaries from your workspace. Download CSV per month or create a read-only report link from the export center." actions={<Link href="/export#shared-reports" className="btn btn-secondary text-xs"><Share2 className="h-4 w-4" aria-hidden />Create share link</Link>} />
      <div className="mb-7 flex flex-wrap gap-2">
          <Link href="/export#shared-reports" className="btn btn-secondary text-xs">
            <Share2 className="h-4 w-4" aria-hidden />
            Create share link
          </Link>
      </div>

      <div className="q-table-shell overflow-x-auto">
        {(invoices || []).length === 0 ? (
          <div className="p-6">
            <PremiumEmptyState
              title="No invoices yet"
              description="Monthly rows are built from your invoice and payment history. Create your first invoice or quote to see reports and CSV downloads fill in."
              example="Reports stay in this workspace until you export or create a read-only link manually."
              action={
                <Link className="btn btn-primary" href="/invoices/new">
                  Create invoice
                </Link>
              }
            />
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="q-table-head">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Collected USD</th>
                <th className="px-4 py-3">Overdue USD</th>
                <th className="px-4 py-3">New clients</th>
                <th className="px-4 py-3">Top method</th>
                <th className="px-4 py-3">CSV</th>
              </tr>
            </thead>
            <tbody>
              {[...bundle.monthlyReports].reverse().map((row) => (
                <tr key={row.monthKey} className="border-b border-slate-100/80 transition hover:bg-slate-50/60 last:border-0">
                  <td className="px-4 py-3 font-semibold text-ink">{row.monthLabel}</td>
                  <td className="px-4 py-3">{row.invoicesCreated}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.paidTotalUsd.toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.overdueTotalUsd.toFixed(2)}</td>
                  <td className="px-4 py-3">{row.newClients}</td>
                  <td className="px-4 py-3 text-slate-700">{row.topMethod ?? "-"}</td>
                  <td className="px-4 py-3">
                    <a className="inline-flex items-center gap-1 text-xs font-bold text-cedar hover:underline" href={`/reports/csv?m=${encodeURIComponent(row.monthKey)}`}>
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-500">
        <Link href="/connectivity" className="font-semibold text-cedar hover:underline">
          Back to connectivity
        </Link>
      </p>
      </PageContainer>
    </AppShell>
  );
}
