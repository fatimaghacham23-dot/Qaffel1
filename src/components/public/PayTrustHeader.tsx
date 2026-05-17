import { shortDate } from "@/lib/format";
import { PublicTrustBadgeRow } from "@/components/public/PublicTrustBadges";
import { BusinessLogoOrMonogram } from "@/components/brand/BusinessLogoOrMonogram";
import { pickPublicString, publicCopy, type PublicLang } from "@/lib/i18n-public";

type ReviewStats = { medianHours: number; sampleCount: number } | null;

type Props = {
  businessName: string;
  invoiceTitle: string;
  invoiceNumber: string | null | undefined;
  createdAt: string | null | undefined;
  dueDate: string | null | undefined;
  validUntil: string | null | undefined;
  clientLine: string;
  tagline?: string | null;
  logoUrl?: string | null;
  reviewStats?: ReviewStats;
  lang?: PublicLang;
};

export function PayTrustHeader({
  businessName,
  invoiceTitle,
  invoiceNumber,
  createdAt,
  dueDate,
  validUntil,
  clientLine,
  tagline,
  logoUrl,
  reviewStats,
  lang = "en"
}: Props) {
  const invNo = invoiceNumber?.trim();

  return (
    <header className="public-brand-card overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_70px_-42px_rgba(15,23,42,0.24)]">
      <div className="border-b border-slate-100/80 bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <BusinessLogoOrMonogram logoUrl={logoUrl || null} businessName={businessName} />
              <div className="min-w-0">
                <p className="q-section-label text-slate-500">
                  {pickPublicString(publicCopy("Payment page from"), lang)}
                </p>
                <h1 className="mt-1 break-words text-xl font-bold tracking-tight text-ink sm:text-2xl">{businessName}</h1>
                {tagline?.trim() ? <p className="mt-1 text-xs font-medium text-slate-600">{tagline.trim()}</p> : null}
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-snug text-ink sm:text-lg">{invoiceTitle}</p>
            <p className="mt-1.5 text-sm text-slate-600">{clientLine}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 border-t border-slate-100/70 pt-5 text-xs sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50/60 px-3.5 py-2.5 ring-1 ring-slate-100/80">
            <dt className="font-bold uppercase tracking-wider text-slate-500">Invoice #</dt>
            <dd className="font-mono text-sm font-semibold text-ink">{invNo || "-"}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50/60 px-3.5 py-2.5 ring-1 ring-slate-100/80">
            <dt className="font-bold uppercase tracking-wider text-slate-500">Issued</dt>
            <dd className="text-sm font-semibold text-ink">{createdAt ? shortDate(createdAt) : "-"}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50/60 px-3.5 py-2.5 ring-1 ring-slate-100/80">
            <dt className="font-bold uppercase tracking-wider text-slate-500">Due</dt>
            <dd className="text-sm font-semibold text-ink">{dueDate ? shortDate(dueDate) : "-"}</dd>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-slate-50/60 px-3.5 py-2.5 ring-1 ring-slate-100/80">
            <dt className="font-bold uppercase tracking-wider text-slate-500">Link valid until</dt>
            <dd className="text-sm font-semibold text-ink">{validUntil ? shortDate(validUntil) : "No expiry date set"}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
        <PublicTrustBadgeRow reviewStats={reviewStats ?? null} lang={lang} />
        <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-5">
          <p className="text-sm font-semibold text-ink">Before sending money</p>
          <ul className="mt-2.5 space-y-2 text-[13px] leading-relaxed text-slate-600 sm:text-sm">
            <li>Confirm the business name, invoice number, and amount match what you received.</li>
            <li>Use one listed payment method, then upload a screenshot or receipt for manual review.</li>
            <li>Receipts and balances update after the business accepts a payment record.</li>
          </ul>
        </div>
      </div>
    </header>
  );
}
