import Link from "next/link";
import { Archive, Download, FileText, Import, MessageCircle, Share2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ConnectivityImportTool } from "@/components/connectivity/ConnectivityImportTool";
import { CopyButton } from "@/components/CopyButton";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { PremiumStatCard } from "@/components/PremiumStatCard";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { buildConnectivityModel, formatShareExpiration, humanReportType, sharedReportUrl } from "@/lib/connectivity";
import { money } from "@/lib/format";
import type { OCEventRow, OCInvoiceRow } from "@/lib/operations-center";
import { requireUser } from "@/lib/supabase/server";

export const metadata = {
  title: "Connectivity | Qaffel",
  description: "Operational exports, imports, shared reports, and manual sharing workflows for Qaffel."
};

function HubCard({
  title,
  body,
  href,
  icon: Icon
}: {
  title: string;
  body: string;
  href: string;
  icon: typeof Download;
}) {
  return (
    <Link href={href} className="q-surface-hover rounded-2xl border border-slate-200/60 bg-white p-5 shadow-card">
      <div className="flex gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cedar/10 text-cedar">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
        </div>
      </div>
    </Link>
  );
}

export default async function ConnectivityPage() {
  const { supabase, user } = await requireUser();
  const [{ data: invoices }, { data: clients }, { data: events }, { data: shares }, { data: profile }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, title, description, document_type, status, amount_usd, amount_lbp, currency, due_date, valid_until, created_at, public_token, exchange_rate_lbp_per_usd, deposit_enabled, deposit_type, deposit_percent, deposit_amount_usd, deposit_amount_lbp, deposit_note, payment_plan, approval_status, clients(id, name, phone, email), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, payment_date, method, voided_at, void_reason, note)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name, email, phone, notes, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase
      .from("invoice_events")
      .select("id, invoice_id, event_type, message, created_at, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2500),
    supabase
      .from("shared_reports")
      .select("id, token, report_type, title, expires_at, created_at, revoked_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("profiles").select("business_name, full_name, business_website, instagram_handle, support_email, whatsapp_phone").eq("id", user.id).maybeSingle()
  ]);

  const model = buildConnectivityModel({
    invoices: (invoices || []) as unknown as OCInvoiceRow[],
    clients: (clients || []) as Array<Record<string, unknown>>,
    events: (events || []) as OCEventRow[]
  });
  const archiveDataset = model.datasets.find((dataset) => dataset.key === "workspace_archive");
  const businessName = profile?.business_name || profile?.full_name || "Qaffel workspace";

  return (
    <AppShell>
      <SettingsPageHeader
        title="Connectivity"
        subtitle="Exports, imports, shared reports, business assets, and manual sharing flows in one operational hub."
        action={
          <Link href="/export" className="btn btn-primary">
            Open export center
          </Link>
        }
      />

      <section className="mb-7 grid gap-4 md:grid-cols-4">
        <PremiumStatCard label="Export rows" value={model.datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0).toLocaleString()} detail="Across all operational datasets" />
        <PremiumStatCard label="Shared reports" value={(shares || []).length.toLocaleString()} detail="Active tokenized links" />
        <PremiumStatCard label="Open recoveries" value={model.stats.openRecoveries.toLocaleString()} detail="Manual follow-through rows" />
        <PremiumStatCard label="Proof queue" value={model.snapshot.proofReviewQueue.toLocaleString()} detail="Awaiting manual review" />
      </section>

      <section className="mb-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HubCard title="Advanced exports" body="Filtered CSVs, archive bundles, and print-ready summaries." href="/export" icon={Download} />
        <HubCard title="Shared reports" body="Create and manage printable read-only report links." href="/export#shared-reports" icon={Share2} />
        <HubCard title="Public assets" body="Profile, payment methods, receipt links, and client-facing business identity." href="/settings/profile" icon={FileText} />
        <HubCard title="Operational archive" body="Own your workspace history with combined archive exports." href="/export" icon={Archive} />
      </section>

      <section className="mb-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="q-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cedar/10 text-cedar">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="q-section-label">Business snapshot</p>
              <h2 className="q-title-sm mt-1">{businessName}</h2>
              <p className="q-body-muted mt-1">A quick operational snapshot for manual sharing and internal review.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4">
              <p className="q-section-label">Collected</p>
              <p className="mt-2 text-lg font-semibold text-ink">{money(model.snapshot.collectedUsd, "USD")}</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{money(model.snapshot.collectedLbp, "LBP")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4">
              <p className="q-section-label">Open</p>
              <p className="mt-2 text-lg font-semibold text-ink">{money(model.snapshot.openUsd, "USD")}</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{money(model.snapshot.openLbp, "LBP")}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {archiveDataset ? (
              <CsvDownloadButton rows={archiveDataset.rows} label="Export workspace archive" className="btn btn-primary" filename={archiveDataset.filename} />
            ) : null}
            <Link href="/reports" className="btn btn-secondary">
              Open reports
            </Link>
          </div>
        </div>

        <aside className="q-surface p-5 sm:p-6">
          <p className="q-section-label">Active report links</p>
          <h2 className="q-title-sm mt-1">Share continuity</h2>
          <div className="mt-4 grid gap-3">
            {(!shares || shares.length === 0) && (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
                No shared reports yet. Create links from the export center when you need an external read-only snapshot.
              </p>
            )}
            {(shares || []).map((share: any) => {
              const url = sharedReportUrl(String(share.token));
              return (
                <article key={String(share.id)} className="rounded-2xl border border-slate-200/60 bg-white p-4">
                  <p className="text-sm font-semibold text-ink">{share.title || humanReportType(String(share.report_type))}</p>
                  <p className="mt-1 text-xs text-slate-500">Expires {formatShareExpiration(share.expires_at)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/share/report/${share.token}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-xs">
                      Open
                    </Link>
                    <CopyButton value={url} label="Copy" className="btn btn-secondary btn-xs" />
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="mb-7 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ConnectivityImportTool />

        <div className="q-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <MessageCircle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="q-section-label">WhatsApp workflow</p>
              <h2 className="q-title-sm mt-1">Manual sharing suggestions</h2>
              <p className="q-body-muted mt-1">Copy contextual messages. Qaffel never sends WhatsApp messages automatically.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {model.whatsappSuggestions.map((suggestion) => (
              <article key={suggestion.title} className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4">
                <p className="text-sm font-semibold text-ink">{suggestion.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{suggestion.body}</p>
                <div className="mt-3">
                  <CopyButton value={suggestion.body} label="Copy message" className="btn btn-secondary btn-xs" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="q-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700">
            <Import className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="q-section-label">Connectivity principles</p>
            <h2 className="q-title-sm mt-1">Manual, portable, and reversible before commit</h2>
            <p className="q-body-muted mt-1">
              Imports preview before writing, exports omit storage paths, shared reports are read-only token links, and communications stay under business control.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
