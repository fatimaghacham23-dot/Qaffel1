import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ExternalLink, FileText, MessageCircle } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PublicContentContainer, PublicPageShell } from "@/components/public/PublicPageShell";
import { BrandedPublicSurface } from "@/components/brand/BrandedPublicSurface";
import { BusinessContactStrip } from "@/components/brand/BusinessContactStrip";
import { BusinessLogoOrMonogram } from "@/components/brand/BusinessLogoOrMonogram";
import { PublicTrustSignalGrid, type PublicTrustSignal } from "@/components/public/PublicTrustSignals";
import { businessWhatsAppHref } from "@/lib/public-payment-copy";
import { documentNounTitle, documentStatus, isQuoteDocument } from "@/lib/documents";
import { money, shortDate, formatPaymentMethod } from "@/lib/format";
import { getDisplayInvoiceStatus, getRemainingBalance } from "@/lib/status";
import { isPortalDocumentsEmpty } from "@/lib/portal-documents";
import type { InvoiceStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { normalizeDocumentTheme, sanitizeHexColor, signBrandLogoUrl } from "@/lib/brand";

function PortalFlag({ tone, label }: { tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }) {
  const tones = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700"
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</span>;
}

type PortalHeaderRow = {
  client_name: string;
  business_name?: string | null;
  full_name?: string | null;
  business_phone?: string | null;
  business_tagline?: string | null;
  brand_color?: string | null;
  brand_accent?: string | null;
  document_theme?: string | null;
  logo_storage_path?: string | null;
  support_email?: string | null;
  business_website?: string | null;
  instagram_handle?: string | null;
  whatsapp_phone?: string | null;
  business_hours?: string | null;
  business_city?: string | null;
  invoice_footer_note?: string | null;
};

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  await supabase.rpc("record_client_portal_view", { p_token: token });

  const [{ data: header }, { data: invoices }, { data: payments }, { data: activity }] = await Promise.all([
    supabase.rpc("get_public_client_portal_header", { p_token: token }),
    supabase.rpc("get_public_client_portal_invoices", { p_token: token }),
    supabase.rpc("get_public_client_portal_payments", { p_token: token }),
    supabase.rpc("get_public_client_portal_activity", { p_token: token })
  ]);

  const portalHeader = (header && Array.isArray(header) ? header[0] : header) as PortalHeaderRow | null;

  if (!portalHeader?.client_name) {
    return notFound();
  }

  const safeDocuments = (invoices || []).map((inv: Record<string, unknown>) => {
    const isQuote = isQuoteDocument(inv);
    const balance = getRemainingBalance(
      {
        amount_usd: inv.amount_usd as number | null,
        amount_lbp: inv.amount_lbp as number | null,
        status: inv.status as InvoiceStatus,
        currency: inv.currency as string | null
      },
      [
        {
          status: "accepted",
          amount_usd: inv.paid_usd as number | null,
          amount_lbp: inv.paid_lbp as number | null
        }
      ]
    );

    return {
      ...inv,
      displayStatus: isQuote ? documentStatus(inv as never) : getDisplayInvoiceStatus({ status: inv.status as InvoiceStatus, due_date: inv.due_date as string | null }),
      balance
    };
  });

  const safeInvoices = safeDocuments.filter((i: (typeof safeDocuments)[number]) => !isQuoteDocument(i as never));
  const safeQuotes = safeDocuments.filter((i: (typeof safeDocuments)[number]) => isQuoteDocument(i as never));
  const overdue = safeInvoices.filter((i: { displayStatus: string }) => i.displayStatus === "overdue");
  const open = safeInvoices.filter((i: { displayStatus: string }) => i.displayStatus !== "paid");
  const paid = safeInvoices.filter((i: { displayStatus: string }) => i.displayStatus === "paid");
  const partial = safeInvoices.filter((i: { displayStatus: string }) => i.displayStatus === "partial");

  const totals = safeInvoices.reduce(
    (acc: { paidUsd: number; paidLbp: number; outUsd: number; outLbp: number }, inv: { displayStatus: string; currency?: string; amount_usd?: number; amount_lbp?: number; paid_usd?: number; paid_lbp?: number }) => {
      const currency = (inv.currency || "USD").toUpperCase();
      const isPaid = inv.displayStatus === "paid";

      if (currency === "USD") {
        const amount = Number(inv.amount_usd || 0);
        const paidAmount = Number(inv.paid_usd || 0);
        acc.paidUsd += paidAmount;
        acc.outUsd += isPaid ? 0 : Math.max(0, amount - paidAmount);
      } else {
        const amount = Number(inv.amount_lbp || 0);
        const paidAmount = Number(inv.paid_lbp || 0);
        acc.paidLbp += paidAmount;
        acc.outLbp += isPaid ? 0 : Math.max(0, amount - paidAmount);
      }
      return acc;
    },
    { paidUsd: 0, paidLbp: 0, outUsd: 0, outLbp: 0 }
  );

  const portalFlags = [
    overdue.length > 0 ? { tone: "warn" as const, label: "Past due invoices" } : null,
    partial.length > 0 ? { tone: "info" as const, label: "Partial payment" } : null,
    paid.length > 0 && open.length === 0 ? { tone: "good" as const, label: "All invoices paid" } : null,
    payments && payments.length > 0 ? { tone: "good" as const, label: "Payments on file" } : { tone: "neutral" as const, label: "No payments yet" },
    { tone: "neutral" as const, label: "Client link" }
  ].filter(Boolean) as Array<{ tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }>;

  const businessName = portalHeader.business_name || portalHeader.full_name || "Business portal";
  const logoUrl = await signBrandLogoUrl(supabase, portalHeader.logo_storage_path ?? null);
  const brandColor = sanitizeHexColor(portalHeader.brand_color ?? undefined, "#116466");
  const brandAccent = portalHeader.brand_accent
    ? sanitizeHexColor(portalHeader.brand_accent, brandColor)
    : null;
  const docTheme = normalizeDocumentTheme(portalHeader.document_theme ?? undefined);
  const wa = businessWhatsAppHref(portalHeader.whatsapp_phone || portalHeader.business_phone);
  const portalTrustSignals: PublicTrustSignal[] = [
    {
      icon: "status",
      title: "Documents stay organized",
      body: "Invoices, quotes, accepted payments, and recent activity are grouped in one client link.",
      tone: "neutral"
    },
    {
      icon: "review",
      title: "Payments are reviewed",
      body: "Only payments accepted by the business appear in the confirmed payment history.",
      tone: "info"
    },
    {
      icon: "receipt",
      title: "Receipts remain available",
      body: "Receipt links appear beside confirmed payments when the business has issued them.",
      tone: "good"
    },
    {
      icon: "message",
      title: "WhatsApp-friendly follow-up",
      body: "If an amount or date does not match what you agreed, contact the business from your usual thread.",
      tone: "neutral"
    }
  ];

  return (
    <PublicPageShell>
      <BrandedPublicSurface theme={docTheme} brandColor={brandColor} brandAccent={brandAccent}>
        <PublicContentContainer>
          <main className="space-y-6">
            <header className="public-brand-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_70px_-42px_rgba(15,23,42,0.26)] sm:p-6">
              <div className="flex flex-wrap items-start gap-4">
                <BusinessLogoOrMonogram logoUrl={logoUrl} businessName={businessName} />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Client portal</p>
                  <p className="mt-1 text-xs font-semibold" style={{ color: "var(--brand-primary, #116466)" }}>
                    {businessName}
                  </p>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{portalHeader.client_name}</h1>
                  {portalHeader.business_tagline?.trim() ? (
                    <p className="mt-2 text-sm text-slate-600">{portalHeader.business_tagline.trim()}</p>
                  ) : null}
                  <p className="mt-2 text-sm text-slate-600">Your invoices, quotes, and confirmed payments in one place.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {portalFlags.map((flag) => (
                      <PortalFlag key={flag.label} tone={flag.tone} label={flag.label} />
                    ))}
                  </div>
                </div>
              </div>
            </header>

            <BusinessContactStrip
              supportEmail={portalHeader.support_email}
              website={portalHeader.business_website}
              instagram={portalHeader.instagram_handle}
              whatsappPhone={portalHeader.whatsapp_phone || portalHeader.business_phone}
              businessHours={portalHeader.business_hours}
              city={portalHeader.business_city}
            />

            <PublicTrustSignalGrid
              eyebrow="Client confidence"
              title="How this portal works"
              body="This portal shows the business records currently available to you."
              signals={portalTrustSignals}
            />

            {portalHeader.invoice_footer_note?.trim() ? (
              <p className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-center text-xs text-slate-600">
                {portalHeader.invoice_footer_note.trim()}
              </p>
            ) : null}

          <section className="grid gap-3 sm:grid-cols-3">
            <div className={`rounded-2xl border p-4 shadow-card ${totals.outUsd > 0 || totals.outLbp > 0 ? "border-amber-200 bg-amber-50/80" : "border-slate-200 bg-white"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Outstanding</p>
              <p className="mt-1 text-lg font-bold text-ink">
                {totals.outUsd > 0 ? money(totals.outUsd, "USD") : null}
                {totals.outUsd > 0 && totals.outLbp > 0 ? " + " : null}
                {totals.outLbp > 0 ? money(totals.outLbp, "LBP") : null}
                {totals.outUsd === 0 && totals.outLbp === 0 ? "-" : null}
              </p>
              <p className="mt-1 text-[11px] text-slate-600">Open invoice balances</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 shadow-card">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Paid (confirmed)</p>
              <p className="mt-1 text-lg font-bold text-emerald-900">
                {totals.paidUsd > 0 ? money(totals.paidUsd, "USD") : null}
                {totals.paidUsd > 0 && totals.paidLbp > 0 ? " + " : null}
                {totals.paidLbp > 0 ? money(totals.paidLbp, "LBP") : null}
                {totals.paidUsd === 0 && totals.paidLbp === 0 ? "-" : null}
              </p>
              <p className="mt-1 text-[11px] text-emerald-900/80">Accepted by the business</p>
            </div>
            <div className={`rounded-2xl border p-4 shadow-card ${overdue.length > 0 ? "border-amber-200 bg-amber-50/80" : "border-slate-200 bg-white"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Overdue count</p>
              <p className={`mt-1 text-2xl font-black ${overdue.length > 0 ? "text-amber-800" : "text-ink"}`}>{overdue.length}</p>
              <p className="mt-1 text-[11px] text-slate-600">Open invoices you may want to review</p>
            </div>
          </section>

          <section className="q-surface bg-slate-50/70 p-4 sm:p-5">
            <h2 className="text-sm font-bold text-ink">Need help with a payment?</h2>
            <p className="mt-1 text-sm text-slate-600">Reach the business directly. This portal shows issued documents and accepted payment records.</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Open an invoice to see deposits, payment plans, proof upload, and the current remaining balance.
            </p>
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex touch-manipulation items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50/80"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                WhatsApp {businessName}
              </a>
            ) : (
              <p className="mt-2 text-xs text-slate-500">WhatsApp appears when the business adds a phone to their profile.</p>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
            <section className="space-y-4">
              {overdue.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm">
                  <p className="text-sm font-bold text-amber-950">Past due invoices can still be handled here</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">
                    Open an invoice to pay, upload proof if you already paid, or agree a payment plan with the business.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {[...safeQuotes, ...(overdue.length > 0 ? [...overdue, ...open.filter((i: { displayStatus: string }) => i.displayStatus !== "overdue"), ...paid] : [...open, ...paid])].map((inv: Record<string, unknown> & { displayStatus: string; balance: { usd: number; lbp: number } }) => {
                  const invIsQuote = isQuoteDocument(inv as never);
                  const nounTitle = documentNounTitle(inv as never);
                  const currency = String(inv.currency || "USD").toUpperCase();
                  const primaryAmount = currency === "USD" ? Number(inv.amount_usd || 0) : Number(inv.amount_lbp || 0);
                  const primaryPaid = invIsQuote ? 0 : currency === "USD" ? Number(inv.paid_usd || 0) : Number(inv.paid_lbp || 0);
                  const primaryRemaining = invIsQuote ? 0 : currency === "USD" ? Number(inv.balance.usd || 0) : Number(inv.balance.lbp || 0);

                  const amount = money(primaryAmount, currency as "USD" | "LBP");
                  const paidAmount = money(primaryPaid, currency as "USD" | "LBP");
                  const remaining = money(primaryRemaining, currency as "USD" | "LBP");

                  return (
                    <article
                      key={String(inv.public_token)}
                      className="q-surface-hover overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-50 bg-gradient-to-r from-white to-slate-50/40 px-4 py-4 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{nounTitle}</p>
                          <p className="mt-1 break-words font-bold text-ink">
                            {inv.invoice_number ? `#${inv.invoice_number} - ` : ""}
                            {String(inv.title || "")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {invIsQuote ? "Valid until" : "Due"} {inv.due_date ? shortDate(String(inv.due_date)) : "-"}
                          </p>
                        </div>
                        <StatusBadge status={inv.displayStatus} />
                      </div>

                      <div className="grid gap-2 px-4 py-4 sm:grid-cols-3 sm:px-5">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount</p>
                          <p className="mt-1 text-sm font-bold text-ink">{amount}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Paid</p>
                          <p className="mt-1 text-sm font-bold text-emerald-800">{invIsQuote ? "-" : paidAmount}</p>
                        </div>
                        <div className={`rounded-xl border p-3 ${primaryRemaining > 0 ? "border-amber-100 bg-amber-50/60" : "border-slate-100 bg-slate-50/40"}`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Remaining</p>
                          <p className={`mt-1 text-sm font-bold ${primaryRemaining > 0 ? "text-amber-900" : "text-slate-700"}`}>
                            {invIsQuote ? "-" : primaryRemaining > 0 ? remaining : "Paid"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-slate-50 px-4 py-3 sm:px-5">
                        <Link
                          className="btn btn-primary touch-manipulation px-3 py-2 text-xs"
                          href={`/pay/${String(inv.public_token)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                          Pay / view
                        </Link>
                      </div>
                    </article>
                  );
                })}

                {isPortalDocumentsEmpty(safeDocuments) && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                    <p className="text-sm font-semibold text-ink">Nothing here yet</p>
                    <p className="mt-1 text-sm text-slate-600">Invoices and quotes from the business will appear automatically.</p>
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
              <section className="q-surface p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                  <FileText className="h-5 w-5 text-cedar" aria-hidden />
                  Payment history
                </h2>
                <p className="mt-1 text-xs text-slate-600">Confirmed payments only.</p>

                <div className="mt-4 grid max-h-[min(60vh,420px)] gap-3 overflow-y-auto pr-1">
                  {(!payments || payments.length === 0) && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">No accepted payments recorded yet.</div>
                  )}

                  {(payments || []).slice(0, 16).map((p: Record<string, unknown>, idx: number) => (
                    <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                      <p className="text-sm font-bold text-ink">
                        {p.amount_usd ? money(Number(p.amount_usd), "USD") : ""}
                        {p.amount_usd && p.amount_lbp ? " + " : ""}
                        {p.amount_lbp ? money(Number(p.amount_lbp), "LBP") : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {p.payment_date ? shortDate(String(p.payment_date)) : shortDate(String(p.uploaded_at))}
                        {p.method ? ` - ${formatPaymentMethod(String(p.method))}` : ""}
                      </p>
                      {(Boolean(p.invoice_number) || Boolean(p.invoice_title)) && (
                        <p className="mt-1 text-[11px] text-slate-600">
                          {p.invoice_number ? `#${p.invoice_number}` : ""}
                          {p.invoice_number && p.invoice_title ? " - " : ""}
                          {String(p.invoice_title || "")}
                        </p>
                      )}
                      {p.receipt_token ? (
                        <Link className="mt-2 inline-block text-xs font-bold text-cedar underline" href={`/receipt/${String(p.receipt_token)}`} target="_blank" rel="noopener noreferrer">
                          View receipt
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="q-surface p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                  <Activity className="h-5 w-5 text-cedar" aria-hidden />
                  Activity
                </h2>
                <p className="mt-1 text-xs text-slate-600">Latest updates.</p>

                <div className="mt-4 max-h-[min(50vh,360px)] space-y-3 overflow-y-auto pr-1">
                  {(!activity || activity.length === 0) && <p className="text-sm text-slate-500">No activity yet.</p>}

                  {(activity || []).map((e: Record<string, unknown>, idx: number) => (
                    <div key={idx} className="flex gap-3 border-b border-slate-50 pb-3 last:border-0">
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cedar/50" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{String(e.message || "")}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {shortDate(String(e.created_at))}
                          {e.invoice_number ? ` - #${e.invoice_number}` : ""}
                        </p>
                        {e.invoice_public_token ? (
                          <Link className="mt-1 inline-block text-[11px] font-bold text-cedar underline" href={`/pay/${String(e.invoice_public_token)}`} target="_blank" rel="noopener noreferrer">
                            Open invoice
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </main>
      </PublicContentContainer>
      </BrandedPublicSurface>
    </PublicPageShell>
  );
}
