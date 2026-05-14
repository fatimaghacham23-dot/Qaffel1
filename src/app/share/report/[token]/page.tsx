import { notFound } from "next/navigation";
import { BarChart3, CalendarDays, FileText } from "lucide-react";
import { BusinessLogoOrMonogram } from "@/components/brand/BusinessLogoOrMonogram";
import { BrandedPublicSurface } from "@/components/brand/BrandedPublicSurface";
import { PrintButton } from "@/components/PrintButton";
import { PublicContentContainer, PublicPageShell } from "@/components/public/PublicPageShell";
import { humanReportType } from "@/lib/connectivity";
import { money, shortDate } from "@/lib/format";
import { normalizeDocumentTheme, sanitizeHexColor } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";

type PublicSharedReport = {
  report_type: string;
  title: string;
  description: string;
  created_at: string;
  expires_at: string | null;
  business_name: string;
  business_tagline: string | null;
  business_city: string | null;
  support_email: string | null;
  brand_color: string | null;
  brand_accent: string | null;
  document_theme: string | null;
  payload: {
    metrics?: Record<string, unknown>;
    rows?: Array<Record<string, unknown>>;
    filters?: Record<string, unknown>;
    generated_at?: string;
  };
};

function labelize(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetricValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isFinite(num)) {
    if (key.toLowerCase().includes("usd")) return money(num, "USD");
    if (key.toLowerCase().includes("lbp")) return money(num, "LBP");
    return num.toLocaleString();
  }
  return String(value);
}

function formatCell(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  const lower = key.toLowerCase();
  const num = Number(value);
  if (Number.isFinite(num) && lower.includes("usd")) return money(num, "USD");
  if (Number.isFinite(num) && lower.includes("lbp")) return money(num, "LBP");
  if ((lower.includes("date") || lower.endsWith("_at")) && typeof value === "string") return shortDate(value);
  return String(value);
}

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_shared_report", { p_token: token }).maybeSingle();

  if (!data) {
    notFound();
  }

  const report = data as PublicSharedReport;
  const payload = report.payload || {};
  const metrics = payload.metrics || {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const headers = rows[0] ? Object.keys(rows[0]).filter((key) => !key.toLowerCase().includes("id")) : [];
  const brandColor = sanitizeHexColor(report.brand_color ?? undefined, "#116466");
  const brandAccent = report.brand_accent ? sanitizeHexColor(report.brand_accent, brandColor) : null;
  const docTheme = normalizeDocumentTheme(report.document_theme ?? undefined);

  return (
    <PublicPageShell>
      <BrandedPublicSurface theme={docTheme} brandColor={brandColor} brandAccent={brandAccent}>
        <PublicContentContainer className="max-w-5xl">
          <main className="public-brand-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_70px_-42px_rgba(15,23,42,0.28)] sm:p-8 print:border-none print:p-0 print:shadow-none">
            <header className="border-b border-slate-100 pb-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <BusinessLogoOrMonogram logoUrl={null} businessName={report.business_name} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Shared business report</p>
                    <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl">{report.title || humanReportType(report.report_type)}</h1>
                    <p className="mt-2 text-sm font-semibold text-slate-700">{report.business_name}</p>
                    {report.business_tagline ? <p className="mt-1 text-sm text-slate-600">{report.business_tagline}</p> : null}
                  </div>
                </div>
                <div className="print:hidden">
                  <PrintButton label="Print / save PDF" className="btn btn-secondary" showIcon />
                </div>
              </div>
              <div className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3">
                <div>
                  <p className="q-section-label">Report type</p>
                  <p className="mt-1 text-sm font-bold text-ink">{humanReportType(report.report_type)}</p>
                </div>
                <div>
                  <p className="q-section-label">Generated</p>
                  <p className="mt-1 text-sm font-bold text-ink">{shortDate(String(payload.generated_at || report.created_at))}</p>
                </div>
                <div>
                  <p className="q-section-label">Expires</p>
                  <p className="mt-1 text-sm font-bold text-ink">{report.expires_at ? shortDate(report.expires_at) : "No expiration set"}</p>
                </div>
              </div>
              {report.description ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">{report.description}</p> : null}
            </header>

            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(metrics).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="q-section-label">{labelize(key)}</p>
                  <p className="mt-2 text-lg font-bold text-ink">{formatMetricValue(key, value)}</p>
                </div>
              ))}
            </section>

            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="q-section-label">Report rows</p>
                  <h2 className="q-title-sm mt-1">{rows.length.toLocaleString()} rows</h2>
                </div>
                <FileText className="h-5 w-5 text-slate-400" aria-hidden />
              </div>

              {rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
                  <BarChart3 className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-ink">No rows in this report scope</p>
                  <p className="mt-1 text-sm text-slate-600">The link is valid, but the selected filters do not currently return records.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:hidden">
                    {rows.slice(0, 50).map((row, index) => (
                      <article key={index} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        {headers.slice(0, 6).map((header) => (
                          <div key={header} className="flex justify-between gap-3 border-b border-slate-200/60 py-1.5 last:border-0">
                            <span className="text-xs font-semibold text-slate-500">{labelize(header)}</span>
                            <span className="text-right text-xs font-medium text-ink">{formatCell(header, row[header])}</span>
                          </div>
                        ))}
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="q-table-head">
                        <tr>
                          {headers.slice(0, 8).map((header) => (
                            <th key={header} className="px-4 py-3">
                              {labelize(header)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 200).map((row, index) => (
                          <tr key={index} className="border-b border-slate-100 last:border-0">
                            {headers.slice(0, 8).map((header) => (
                              <td key={header} className="px-4 py-3 text-slate-700">
                                {formatCell(header, row[header])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <footer className="mt-8 border-t border-slate-100 pt-5 text-xs leading-relaxed text-slate-500">
              <p className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" aria-hidden />
                Read-only report link. It does not expose internal record IDs or proof storage paths.
              </p>
            </footer>

            <style
              dangerouslySetInnerHTML={{
                __html: `
                  @media print {
                    body { background: white !important; }
                    main { max-width: 100% !important; }
                    .rounded-3xl, .rounded-2xl { box-shadow: none !important; }
                    @page { margin: 1.4cm; }
                  }
                `
              }}
            />
          </main>
        </PublicContentContainer>
      </BrandedPublicSurface>
    </PublicPageShell>
  );
}
