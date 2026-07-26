import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { buildIntelligenceBundle } from "@/lib/intelligence-layer";
import type { OCInvoiceRow } from "@/lib/operations-center";

function ListBlock({
  title,
  items,
  empty
}: {
  title: string;
  items: { id: string; label: string; href: string; meta?: string }[];
  empty: string;
}) {
  return (
    <div className="q-surface p-4">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {items.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center">
          <p className="text-xs text-slate-600">{empty}</p>
          <p className="mt-1 text-[10px] text-slate-500">Nothing to action here right now.</p>
        </div>
      ) : (
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-xs">
          {items.map((x) => (
            <li key={x.id}>
              <Link href={x.href} className="flex touch-manipulation flex-col rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 transition hover:border-cedar/30 hover:bg-white">
                <span className="font-semibold text-ink">{x.label}</span>
                {x.meta ? <span className="text-slate-500">{x.meta}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function IntelligenceDeepPage() {
  const [{ supabase }, ctx] = await Promise.all([requireUser(), getWorkspaceContext()]);
  const [{ data: invoices }, { data: events }, { data: clients }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "*, exchange_rate_lbp_per_usd, clients(id, name, phone, email), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, payment_date, method, voided_at)"
      )
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("invoice_events")
      .select("id, invoice_id, event_type, message, created_at, metadata")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("clients").select("id, name, workspace_id, created_at").eq("workspace_id", ctx.workspaceId)
  ]);

  const bundle = buildIntelligenceBundle({
    workspaceId: ctx.workspaceId,
    invoices: (invoices || []) as OCInvoiceRow[],
    events: (events || []) as any,
    clients: (clients || []) as { id: string; name: string | null; workspace_id?: string | null; created_at: string }[]
  });

  const op = bundle.operational;

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Operational filters</h1>
          <p className="mt-1 text-sm text-slate-600">
            Cross-workspace lists from the same rules as the intelligence engine — tap through to act.
          </p>
        </div>
        <Link href="/dashboard" className="btn btn-secondary text-xs touch-manipulation">
          Dashboard
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ListBlock title="Late payers (clients)" items={op.latePayers} empty="No multi-late-payment pattern detected." />
        <ListBlock title="Risky clients" items={op.riskyClients} empty="No high-risk client rollup right now." />
        <ListBlock title="High-value open invoices (≥ $5k)" items={op.highValueInvoices} empty="No large open invoices flagged." />
        <ListBlock title="No reminder logged (10d+)" items={op.noFollowUpInvoices} empty="All tracked invoices have a reminder or are new." />
        <ListBlock title="Multiple rejected proofs" items={op.multipleRejectedProofs} empty="No invoices with 2+ rejections." />
        <ListBlock title="Overpaid balances" items={op.overpaidInvoices} empty="No overpayment detected on primary currency." />
        <ListBlock title="Stale drafts (21d+)" items={op.staleDrafts} empty="No old drafts sitting idle." />
      </div>

      <div className="q-surface mt-8 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-ink">Client segments</h2>
        <p className="mt-1 text-xs text-slate-500">Heuristic tags from payment timing, balances, and activity — not credit scores.</p>
        {bundle.clientSegmentation.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center">
            <p className="text-xs text-slate-600">Not enough client patterns to segment yet.</p>
            <p className="mt-1 text-[10px] text-slate-500">Issue a few invoices and payments to unlock segment hints.</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {bundle.clientSegmentation.map((c) => (
              <li key={c.clientId}>
                <Link
                  href={c.href}
                  className="block touch-manipulation rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 transition hover:border-cedar/30"
                >
                  <p className="font-semibold text-ink">{c.name}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.segments.map((s) => (
                      <span key={s} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                        {s.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
