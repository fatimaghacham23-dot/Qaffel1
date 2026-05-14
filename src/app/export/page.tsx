import Link from "next/link";
import { CalendarDays, FileDown, Filter, Printer, Share2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CopyButton } from "@/components/CopyButton";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { ExportCard } from "@/components/ExportCard";
import { ExportPreparationPanel } from "@/components/connectivity/ExportPreparationPanel";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { PremiumStatCard } from "@/components/PremiumStatCard";
import { PrintButton } from "@/components/PrintButton";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { createSharedReportAction, revokeSharedReportAction } from "@/app/actions";
import { buildConnectivityModel, formatShareExpiration, humanReportType, sharedReportUrl, type ConnectivityFilters } from "@/lib/connectivity";
import { money, shortDate } from "@/lib/format";
import type { OCEventRow, OCInvoiceRow } from "@/lib/operations-center";
import { requireUser } from "@/lib/supabase/server";

type PageSearch = {
  from?: string;
  to?: string;
  status?: string;
  client?: string;
  preset?: string;
};

function filterValue(value: string | undefined) {
  return value && value.trim() ? value.trim() : "";
}

function shareFormTitle(type: string) {
  return humanReportType(type);
}

export default async function ExportPage({ searchParams }: { searchParams?: Promise<PageSearch> }) {
  const resolved = searchParams ? await searchParams : {};
  const filters: ConnectivityFilters = {
    from: filterValue(resolved.from),
    to: filterValue(resolved.to),
    status: filterValue(resolved.status) || "all",
    client: filterValue(resolved.client)
  };

  const { supabase, user } = await requireUser();
  const [{ data: invoices }, { data: clients }, { data: events }, { data: shares }] = await Promise.all([
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
      .select("id, token, report_type, title, description, filters, expires_at, revoked_at, created_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  const model = buildConnectivityModel({
    invoices: (invoices || []) as unknown as OCInvoiceRow[],
    clients: (clients || []) as Array<Record<string, unknown>>,
    events: (events || []) as OCEventRow[],
    filters
  });

  const activeFilterCount = [filters.from, filters.to, filters.client, filters.status && filters.status !== "all" ? filters.status : ""].filter(Boolean).length;
  const totalRows = model.datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
  const primaryPreset = resolved.preset || "monthly_collections";
  const shareFilters = JSON.stringify({ from: filters.from || null, to: filters.to || null, status: filters.status || "all", client: filters.client || null });

  return (
    <AppShell>
      <SettingsPageHeader
        title="Export center"
        subtitle="Operational exports, shareable report preparation, and archive-ready summaries. Downloads are manual and no external communication is sent automatically."
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link href="/connectivity" className="btn btn-secondary">
              Connectivity hub
            </Link>
            <PrintButton label="Print summary" className="btn btn-primary" showIcon />
          </div>
        }
      />

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <PremiumStatCard label="Export datasets" value={model.datasets.length.toLocaleString()} detail="Invoices, payments, proofs, recoveries, plans, clients, reminders, intelligence, archive" />
        <PremiumStatCard label="Rows prepared" value={totalRows.toLocaleString()} detail={activeFilterCount ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied` : "All available records"} />
        <PremiumStatCard label="Open recovery rows" value={model.stats.openRecoveries.toLocaleString()} detail="Manual follow-through workbook" />
        <PremiumStatCard label="Shared reports" value={(shares || []).length.toLocaleString()} detail="Active read-only links" />
      </section>

      <section className="mb-6 q-surface p-4 sm:p-5 print:hidden">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-cedar" aria-hidden />
          <h2 className="q-title-sm">Filtered export preparation</h2>
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-[repeat(4,minmax(0,1fr))_auto]" action="/export">
          <div>
            <label className="label" htmlFor="from">
              From
            </label>
            <input className="field" id="from" name="from" type="date" defaultValue={filters.from || ""} />
          </div>
          <div>
            <label className="label" htmlFor="to">
              To
            </label>
            <input className="field" id="to" name="to" type="date" defaultValue={filters.to || ""} />
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select className="field" id="status" name="status" defaultValue={filters.status || "all"}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="client">
              Client contains
            </label>
            <input className="field" id="client" name="client" placeholder="Client name" defaultValue={filters.client || ""} />
          </div>
          <div className="flex items-end gap-2">
            <button className="btn btn-primary w-full md:w-auto" type="submit">
              Apply
            </button>
            <Link className="btn btn-secondary" href="/export">
              Reset
            </Link>
          </div>
        </form>
      </section>

      <ExportPreparationPanel totalRows={totalRows} />

      <section className="my-6 grid gap-4 lg:grid-cols-3">
        {model.datasets.map((dataset) => (
          <ExportCard
            key={dataset.key}
            title={dataset.title}
            description={dataset.description}
            meta={`${dataset.rows.length.toLocaleString()} row${dataset.rows.length === 1 ? "" : "s"} ready`}
            action={
              <CsvDownloadButton
                rows={dataset.rows}
                label={`Export ${dataset.title}`}
                className={dataset.key === "workspace_archive" ? "btn btn-primary w-full" : "btn btn-secondary w-full"}
                filename={dataset.filename}
              />
            }
          />
        ))}
      </section>

      <section id="shared-reports" className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="q-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="q-section-label">Operational report presets</p>
              <h2 className="q-title-sm mt-1">Create read-only share links</h2>
              <p className="q-body-muted mt-1 max-w-2xl">
                Links are tokenized, printable, and manual-only. They expose report summaries, not storage paths or internal IDs.
              </p>
            </div>
            <Share2 className="h-5 w-5 text-cedar" aria-hidden />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {model.reportPresets.map((preset) => (
              <form key={preset.key} action={createSharedReportAction} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <input type="hidden" name="report_type" value={preset.key} />
                <input type="hidden" name="title" value={shareFormTitle(preset.key)} />
                <input type="hidden" name="description" value={preset.description} />
                <input type="hidden" name="filters_json" value={shareFilters} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink">{preset.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{preset.description}</p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-500">{preset.rows.toLocaleString()} source rows in current filter</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor={`expires-${preset.key}`}>
                      Expires
                    </label>
                    <select className="field" id={`expires-${preset.key}`} name="expires_days" defaultValue="30">
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="">No expiration</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button className="btn btn-primary w-full" type="submit">
                      Create link
                    </button>
                  </div>
                </div>
              </form>
            ))}
          </div>
        </div>

        <aside className="q-surface p-4 sm:p-5">
          <p className="q-section-label">Active shared reports</p>
          <h2 className="q-title-sm mt-1">Read-only links</h2>
          <div className="mt-4 grid gap-3">
            {(!shares || shares.length === 0) && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-600">
                No shared reports yet. Create one from a preset when you need to send a printable snapshot.
              </div>
            )}
            {(shares || []).map((share: any) => {
              const url = sharedReportUrl(String(share.token));
              return (
                <article key={String(share.id)} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-ink">{share.title || humanReportType(String(share.report_type))}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {humanReportType(String(share.report_type))} - expires {formatShareExpiration(share.expires_at)}
                      </p>
                    </div>
                    <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/share/report/${share.token}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-xs">
                      Open
                    </Link>
                    <CopyButton value={url} label="Copy link" className="btn btn-secondary btn-xs" />
                    <form action={revokeSharedReportAction}>
                      <input type="hidden" name="share_id" value={String(share.id)} />
                      <button className="btn btn-secondary btn-xs" type="submit">
                        Revoke
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="q-table-shell print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Print-ready operational summary</h2>
            <p className="mt-1 text-sm text-slate-500">Use browser print to create a PDF summary for accountants or operations reviews.</p>
          </div>
          <Printer className="h-5 w-5 text-slate-400 print:hidden" aria-hidden />
        </div>
        {model.stats.invoices === 0 && model.stats.clients === 0 ? (
          <div className="p-5">
            <PremiumEmptyState
              title="No exportable records yet."
              description="Create invoices, clients, or payment proofs first, then return here to export and share operational summaries."
              example="Exports remain manual and private until you download or create a tokenized report link."
              action={
                <Link className="btn btn-primary" href="/invoices/new">
                  Create invoice
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="q-section-label">Collected</p>
              <p className="mt-2 text-xl font-bold text-ink">{money(model.snapshot.collectedUsd, "USD")}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{money(model.snapshot.collectedLbp, "LBP")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="q-section-label">Open balance</p>
              <p className="mt-2 text-xl font-bold text-ink">{money(model.snapshot.openUsd, "USD")}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{money(model.snapshot.openLbp, "LBP")}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="q-section-label text-amber-800">Recovery</p>
              <p className="mt-2 text-xl font-bold text-amber-950">{model.snapshot.overdueCount}</p>
              <p className="mt-1 text-sm text-amber-900">Overdue invoices in scope</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
              <p className="q-section-label text-sky-800">Proof queue</p>
              <p className="mt-2 text-xl font-bold text-sky-950">{model.snapshot.proofReviewQueue}</p>
              <p className="mt-1 text-sm text-sky-900">Proofs waiting for manual review</p>
            </div>
          </div>
        )}
        <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500">
          Generated {shortDate(new Date().toISOString())}. Current filters: {activeFilterCount ? `${activeFilterCount} active` : "none"}.
        </div>
      </section>
    </AppShell>
  );
}
