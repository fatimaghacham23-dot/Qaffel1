import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
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
      <div className="mb-6">
        <h1 className="page-title">Monthly reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Internal summaries from your workspace. Download CSV per month — nothing is emailed automatically.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
        {(invoices || []).length === 0 ? (
          <div className="p-6">
            <PremiumEmptyState
              title="No invoices yet"
              description="Monthly rows are built from your invoice and payment history. Create your first invoice or quote to see reports and CSV downloads fill in."
              example="Reports stay on this workspace — nothing is emailed automatically."
              action={
                <Link className="btn btn-primary" href="/invoices/new">
                  Create invoice
                </Link>
              }
            />
          </div>
        ) : (
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
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
              <tr key={row.monthKey} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">{row.monthLabel}</td>
                <td className="px-4 py-3">{row.invoicesCreated}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.paidTotalUsd.toFixed(2)}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.overdueTotalUsd.toFixed(2)}</td>
                <td className="px-4 py-3">{row.newClients}</td>
                <td className="px-4 py-3 text-slate-700">{row.topMethod ?? "—"}</td>
                <td className="px-4 py-3">
                  <a
                    className="inline-flex items-center gap-1 text-xs font-bold text-cedar hover:underline"
                    href={`/reports/csv?m=${encodeURIComponent(row.monthKey)}`}
                  >
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
        <Link href="/dashboard" className="font-semibold text-cedar hover:underline">
          Back to dashboard
        </Link>
      </p>
    </AppShell>
  );
}
