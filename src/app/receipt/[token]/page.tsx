import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { PublicContentContainer, PublicPageShell } from "@/components/public/PublicPageShell";
import { PrintReceiptButton } from "@/components/PrintReceiptButton";
import { BrandedPublicSurface } from "@/components/brand/BrandedPublicSurface";
import { BusinessContactStrip } from "@/components/brand/BusinessContactStrip";
import { BusinessLogoOrMonogram } from "@/components/brand/BusinessLogoOrMonogram";
import { PublicNextStepPanel, PublicTrustSignalGrid, type PublicTrustSignal } from "@/components/public/PublicTrustSignals";
import { money, shortDate, formatPaymentMethod } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { normalizeDocumentTheme, sanitizeHexColor, signBrandLogoUrl } from "@/lib/brand";

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  await supabase.rpc("record_receipt_view", { p_token: token });

  const { data: receiptData } = await supabase.rpc("get_public_receipt_data", { p_token: token }).maybeSingle();

  if (!receiptData) {
    return notFound();
  }

  const receipt = receiptData as Record<string, unknown>;
  const statusLower = String(receipt.status || "").toLowerCase();
  const isVoided = statusLower === "voided" || statusLower === "rejected";
  const isAccepted = statusLower === "accepted";
  const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${receipt.invoice_public_token}`;

  const statusBadgeLabel = isVoided ? "Voided" : isAccepted ? "Accepted" : "Pending";
  const statusBadgeClass = isVoided
    ? "bg-red-100 text-red-800 ring-red-200/80"
    : isAccepted
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200/80"
      : "bg-slate-100 text-slate-700 ring-slate-200/80";

  const businessName = String(receipt.business_name || "Payment receipt");
  const logoUrl = await signBrandLogoUrl(supabase, (receipt.logo_storage_path as string | null | undefined) ?? null);
  const brandColor = sanitizeHexColor((receipt.brand_color as string | undefined) ?? undefined, "#116466");
  const brandAccent = receipt.brand_accent
    ? sanitizeHexColor(String(receipt.brand_accent), brandColor)
    : null;
  const docTheme = normalizeDocumentTheme((receipt.document_theme as string | undefined) ?? undefined);
  const receiptSignals: PublicTrustSignal[] = [
    {
      icon: "status",
      title: "Status stays visible",
      body: "This receipt shows whether the business currently marks the payment as accepted, pending, or voided.",
      tone: isVoided ? "warn" : isAccepted ? "good" : "neutral"
    },
    {
      icon: "review",
      title: "Manually confirmed record",
      body: "Receipt data comes from business review or manual payment entry. It is not an automatic bank certificate.",
      tone: "info"
    },
    {
      icon: "link",
      title: "Keep this link",
      body: "The receipt remains accessible by link, and the status shown here can change if the business voids it.",
      tone: "neutral"
    },
    {
      icon: "receipt",
      title: "Linked to the invoice",
      body: "Use the invoice link to review the invoice, payment history, and remaining balance when available.",
      tone: "neutral"
    }
  ];

  const receiptStatusPanel = isVoided
    ? {
        tone: "warn" as const,
        eyebrow: "Receipt status",
        title: "This receipt is voided",
        body: "Do not use this record as settlement proof. Open the invoice or contact the business for an updated payment record."
      }
    : isAccepted
      ? {
          tone: "good" as const,
          eyebrow: "Receipt status",
          title: "Payment accepted by the business",
          body: "This receipt reflects a payment the business has accepted or recorded. Keep this link for your records."
        }
      : {
          tone: "info" as const,
          eyebrow: "Receipt status",
          title: "Receipt pending review",
          body: "This record is not marked accepted yet. Check with the business if you expected a confirmed receipt."
        };

  return (
    <PublicPageShell>
      <BrandedPublicSurface theme={docTheme} brandColor={brandColor} brandAccent={brandAccent}>
        <PublicContentContainer className="max-w-3xl">
          <main
            className={`public-brand-card rounded-3xl border bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_70px_-42px_rgba(15,23,42,0.28)] sm:p-8 print:border-none print:shadow-none print:p-0 ${
              isVoided ? "border-red-200/90" : "border-slate-200/80"
            }`}
          >
          {isVoided && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/95 p-4 text-red-900 print:border print:bg-red-50">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-800">Voided receipt</p>
              <p className="mt-2 text-sm leading-relaxed">Do not use this document as settlement proof. Ask the business for an updated record.</p>
            </div>
          )}

          <header className="border-b border-slate-100 pb-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <BusinessLogoOrMonogram logoUrl={logoUrl} businessName={businessName} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Payment receipt</p>
                    <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl">{businessName}</h1>
                    {(receipt.business_tagline as string | undefined)?.trim() ? (
                      <p className="mt-2 text-sm text-slate-600">{String(receipt.business_tagline).trim()}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-slate-600">
                      Receipt <span className="font-mono font-semibold text-ink">{String(receipt.receipt_number || "-")}</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ring-1 ${statusBadgeClass}`}>
                  {statusBadgeLabel}
                </span>
                <p className="text-xs text-slate-500">Issued {shortDate(String(receipt.confirmed_at || new Date().toISOString()))}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</p>
                <p className="mt-1 text-lg font-bold text-ink">
                  {receipt.amount_usd ? money(Number(receipt.amount_usd), "USD") : ""}
                  {receipt.amount_usd && receipt.amount_lbp ? " + " : ""}
                  {receipt.amount_lbp ? money(Number(receipt.amount_lbp), "LBP") : ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Method</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatPaymentMethod(String(receipt.method || ""))}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Payment date</p>
                <p className="mt-1 text-sm font-semibold text-ink">{shortDate(String(receipt.payment_date || receipt.confirmed_at || ""))}</p>
              </div>
            </div>
          </header>

          <div className="mt-5">
            <BusinessContactStrip
              supportEmail={receipt.support_email as string | undefined}
              website={receipt.business_website as string | undefined}
              instagram={receipt.instagram_handle as string | undefined}
              whatsappPhone={(receipt.whatsapp_phone as string | undefined) || undefined}
              businessHours={receipt.business_hours as string | undefined}
              city={receipt.business_city as string | undefined}
            />
          </div>

          <div className="mt-5 grid gap-4">
            <PublicNextStepPanel
              eyebrow={receiptStatusPanel.eyebrow}
              title={receiptStatusPanel.title}
              body={receiptStatusPanel.body}
              tone={receiptStatusPanel.tone}
            />
            <PublicTrustSignalGrid
              eyebrow="Receipt confidence"
              title="What this receipt means"
              body="Receipt details are shown from the business record for this payment."
              signals={receiptSignals}
            />
          </div>

          <section className="mt-8 grid gap-8 border-b border-slate-100 pb-8 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">From</p>
              <p className="mt-1 font-semibold text-ink">{String(receipt.business_name || "-")}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">To</p>
              <p className="mt-1 font-semibold text-ink">{String(receipt.client_name || "-")}</p>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Invoice</p>
                <p className="mt-1 font-semibold text-ink">
                  {receipt.invoice_number ? `#${receipt.invoice_number} - ` : ""}
                  {String(receipt.invoice_title || "")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Link href={`/pay/${receipt.invoice_public_token}`} className="btn btn-secondary text-xs">
                  Open invoice
                </Link>
                <CopyButton value={invoiceUrl} label="Copy invoice link" className="btn btn-secondary text-xs" />
              </div>
            </div>

            <div className="mt-6 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-center font-mono text-[11px] font-semibold text-slate-700 print:border print:bg-slate-50">
                Receipt record: {String(receipt.receipt_number || "-")} - keep this link for your records
              </div>
              {isAccepted && ["whish", "omt"].some((t) => String(receipt.method || "").toLowerCase().includes(t)) && (
                <p className="text-xs leading-relaxed text-slate-600">
                  Confirmed after manual review of your Whish / OMT proof by the business. This is not an automatic bank certificate.
                </p>
              )}
              {receipt.note ? (
                <div className="flex flex-col gap-1 border-t border-slate-200/80 pt-3 sm:flex-row sm:justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Note</span>
                  <span className="text-sm font-medium text-slate-800 sm:max-w-md sm:text-right">{String(receipt.note)}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t-2 border-slate-900/90 pt-6">
              <span className="text-sm font-bold uppercase tracking-wide text-slate-700">Total recorded</span>
              <span className="text-2xl font-black tracking-tight text-ink">
                {receipt.amount_usd ? money(Number(receipt.amount_usd), "USD") : ""}
                {receipt.amount_usd && receipt.amount_lbp ? " + " : ""}
                {receipt.amount_lbp ? money(Number(receipt.amount_lbp), "LBP") : ""}
              </span>
            </div>
          </section>

          {isVoided && (
            <section className="mt-8 rounded-2xl border border-dashed border-red-200 bg-red-50/60 p-5 text-center">
              <h2 className="text-base font-bold text-red-800">This receipt is void or invalid</h2>
              {receipt.void_reason ? <p className="mt-2 text-sm text-red-700">Reason: {String(receipt.void_reason)}</p> : null}
            </section>
          )}

          <footer className="mt-10 border-t border-slate-100 pt-6 text-center text-slate-600">
            {isVoided ? (
              <>
                <p className="text-sm font-semibold text-red-800">Do not use for accounting or disputes without a valid replacement.</p>
                <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-red-700/90">Open your invoice from the payer or ask the business for an updated receipt.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">Thank you for your payment.</p>
                <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-500">
                  Record of a manually confirmed payment for this business. This is not a bank certificate. If voided later, this link will show as invalid.
                </p>
                {(receipt.invoice_footer_note as string | undefined)?.trim() ? (
                  <p className="mx-auto mt-3 max-w-lg rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
                    {String(receipt.invoice_footer_note).trim()}
                  </p>
                ) : null}
              </>
            )}
            <div className="mt-4 print:hidden">
              <PrintReceiptButton className="btn btn-secondary text-xs" />
            </div>
          </footer>
        </main>

        <style
          dangerouslySetInnerHTML={{
            __html: `
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          .rounded-3xl { border: none !important; border-radius: 0 !important; }
          .bg-slate-50\\/50, .bg-slate-50\\/60 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 1.5cm; }
        }
      `
          }}
        />
      </PublicContentContainer>
      </BrandedPublicSurface>
    </PublicPageShell>
  );
}
