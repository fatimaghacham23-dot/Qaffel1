import { StatusBadge } from "@/components/StatusBadge";
import { PrintButton } from "@/components/PrintButton";
import { ProofUploadForm } from "@/components/ProofUploadForm";
import { ClientApprovalBox } from "@/components/ClientApprovalBox";
import { PayConversionHelpers } from "@/components/public/PayConversionHelpers";
import { PayStatusExperience } from "@/components/public/PayStatusExperience";
import { PayTrustHeader } from "@/components/public/PayTrustHeader";
import { PublicContentContainer, PublicPageShell } from "@/components/public/PublicPageShell";
import { PublicPayHelpFooter } from "@/components/public/PublicPayHelpFooter";
import { PublicPayMethodCards } from "@/components/public/PublicPayMethodCards";
import { PublicPaymentPlanBanner } from "@/components/public/PublicPaymentPlanBanner";
import { PublicNextStepPanel, PublicTrustSignalGrid, type PublicTrustSignal } from "@/components/public/PublicTrustSignals";
import { BrandedPublicSurface } from "@/components/brand/BrandedPublicSurface";
import { BusinessContactStrip } from "@/components/brand/BusinessContactStrip";
import { CreditCard, FileText, UploadCloud } from "lucide-react";
import { money, shortDate, formatPaymentMethod } from "@/lib/format";
import { getDepositStatus } from "@/lib/deposit";
import { documentNounTitle, documentStatus, isQuoteDocument } from "@/lib/documents";
import { buildPublicPaymentTimeline, formatMethodListForHelper, publicPaymentPhase } from "@/lib/public-payment-copy";
import { toPublicPaymentMethodOption } from "@/lib/public-pay-method";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePublicPaymentPageData } from "@/lib/public-payment-page";
import { parsePaymentPlan } from "@/lib/payment-plan";
import { normalizeDocumentTheme, sanitizeHexColor, signBrandLogoUrl } from "@/lib/brand";
import { notFound } from "next/navigation";

function PublicFlag({ tone, label }: { tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }) {
  const tones = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700"
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</span>;
}

export default async function PublicInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ uploaded?: string; method?: string }>;
}) {
  const { token } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const proofUploaded = resolvedSearchParams.uploaded === "1";
  const preferredMethodType = (resolvedSearchParams.method || "").toLowerCase();
  const supabase = await createClient();
  const { data: paymentPageRaw, error: paymentPageError } = await supabase.rpc("get_public_payment_page", {
    p_token: token
  });
  const paymentPage = paymentPageError ? null : parsePublicPaymentPageData(paymentPageRaw, token);

  if (!paymentPage) {
    notFound();
  }

  const { invoice, profile, proofs, methods } = paymentPage;
  const [{ data: acceptedPayments }, { data: reviewStatsRaw }] = await Promise.all([
    supabase.rpc("get_public_payment_history_by_token", { p_token: token }),
    supabase.rpc("get_public_merchant_proof_review_stats", { p_public_invoice_token: token })
  ]);

  const balance = getRemainingBalance(invoice, proofs || []);
  const reconciledStatus = reconcileInvoiceStatus(invoice, proofs || []);
  const isQuote = isQuoteDocument(invoice);
  const nounTitle = documentNounTitle(invoice);
  const displayStatus = isQuote
    ? documentStatus({ ...invoice, status: reconciledStatus })
    : getDisplayInvoiceStatus({ ...invoice, status: reconciledStatus });
  const publicPlan = !isQuote ? parsePaymentPlan((invoice as { payment_plan?: unknown }).payment_plan) : null;
  const depositStatus = getDepositStatus(invoice, proofs || []);
  const showDepositRequest = Boolean(!isQuote && depositStatus && displayStatus !== "paid" && depositStatus.label === "Not paid");
  const depositUploadAmount = showDepositRequest && depositStatus ? depositStatus.remainingDeposit || depositStatus.request.amount : null;
  const depositUploadAmountUsd = depositStatus?.request.currency === "USD" ? depositUploadAmount : null;
  const depositUploadAmountLbp = depositStatus?.request.currency === "LBP" ? depositUploadAmount : null;
  const invoiceClient = invoice.clients as { name?: string | null } | { name?: string | null }[] | null;
  const clientName = Array.isArray(invoiceClient) ? invoiceClient[0]?.name : invoiceClient?.name;
  const isExpired = invoice.valid_until && new Date(invoice.valid_until) < new Date() && (isQuote ? displayStatus === "expired" : displayStatus !== "paid");
  const hasAcceptedPayments = Boolean(acceptedPayments && acceptedPayments.length > 0);
  const pendingProofCount = (proofs || []).filter((p) => (p.status || "").toLowerCase() === "pending").length;
  const retryProofCount = (proofs || []).filter((p) => ["rejected", "voided"].includes((p.status || "").toLowerCase())).length;

  const depositFraction =
    depositStatus && depositStatus.request.amount > 0
      ? Math.min(1, depositStatus.paidPrimary / depositStatus.request.amount)
      : null;

  const publicFlags = [
    isExpired ? { tone: "danger" as const, label: "Link expired" } : null,
    displayStatus === "overdue" ? { tone: "warn" as const, label: "Past due date" } : null,
    pendingProofCount > 0 ? { tone: "info" as const, label: "Proof under review" } : null,
    retryProofCount > 0 && pendingProofCount === 0 ? { tone: "warn" as const, label: "Proof needs retry" } : null,
    showDepositRequest ? { tone: "info" as const, label: "Deposit requested" } : null,
    depositStatus && depositStatus.label !== "Not paid" && displayStatus !== "paid" ? { tone: "good" as const, label: "Deposit received" } : null,
    displayStatus === "partial" ? { tone: "info" as const, label: "Partial payment" } : null,
    displayStatus === "paid" ? { tone: "good" as const, label: "Fully paid" } : null,
    invoice.approval_status === "pending" ? { tone: "warn" as const, label: "Approval required" } : null,
    !isQuote && !hasAcceptedPayments ? { tone: "neutral" as const, label: "No accepted payments yet" } : null,
    !isQuote && (methods || []).length === 0 ? { tone: "warn" as const, label: "No active payment methods" } : null
  ].filter(Boolean) as Array<{ tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }>;

  const normalizedMethods = (methods || []).map((row) => toPublicPaymentMethodOption(row as Record<string, unknown>));

  const primaryCurrency = (invoice.currency || "USD").toUpperCase();
  let suggestedAmount: number | null =
    primaryCurrency === "USD" ? Number(invoice.amount_usd || 0) : Number(invoice.amount_lbp || 0);
  let suggestedCurrency = primaryCurrency;

  if (displayStatus === "paid") {
    suggestedAmount = null;
  } else if (showDepositRequest && depositStatus) {
    suggestedAmount = Number(depositStatus.remainingDeposit || depositStatus.request.amount || 0);
    suggestedCurrency = (depositStatus.request.currency || primaryCurrency).toUpperCase();
  } else if (displayStatus === "partial" && !balance.unknown) {
    suggestedAmount = primaryCurrency === "USD" ? Number(balance.usd || 0) : Number(balance.lbp || 0);
  }

  const defaultMethodForProof =
    normalizedMethods.find((m) => m.normalizedType === preferredMethodType)?.label || null;

  const businessName = profile?.business_name || profile?.full_name || "Payment request";

  const logoUrl = await signBrandLogoUrl(createAdminClient(), profile?.logo_storage_path ?? null);
  const brandColor = sanitizeHexColor(profile?.brand_color ?? undefined, "#116466");
  const brandAccent = profile?.brand_accent ? sanitizeHexColor(profile.brand_accent, brandColor) : null;
  const docTheme = normalizeDocumentTheme(profile?.document_theme ?? undefined);
  const rsRow = Array.isArray(reviewStatsRaw) ? reviewStatsRaw[0] : reviewStatsRaw;
  const reviewStats =
    rsRow &&
    Number((rsRow as { sample_count?: unknown }).sample_count) >= 3 &&
    (rsRow as { median_hours?: unknown }).median_hours != null &&
    Number.isFinite(Number((rsRow as { median_hours: unknown }).median_hours))
      ? {
          medianHours: Number((rsRow as { median_hours: number }).median_hours),
          sampleCount: Number((rsRow as { sample_count: number }).sample_count)
        }
      : null;

  const phase = publicPaymentPhase({
    isQuote,
    displayStatus,
    isExpired: Boolean(isExpired),
    approvalStatus: invoice.approval_status,
    showDepositRequest: Boolean(showDepositRequest),
    pendingProofCount
  });

  const timeline = buildPublicPaymentTimeline({
    isQuote,
    displayStatus,
    isExpired: Boolean(isExpired),
    approvalStatus: invoice.approval_status,
    pendingProofCount,
    hasAcceptedPayments
  });

  const helperLines: string[] = [];
  const methodList = formatMethodListForHelper(normalizedMethods.map((m) => m.label));
  if (methodList) helperLines.push(methodList);
  if (proofUploaded) {
    helperLines.push("Upload received: your proof is now waiting for manual review.");
  } else if (pendingProofCount > 0) {
    helperLines.push(`${pendingProofCount} proof ${pendingProofCount === 1 ? "is" : "files are"} currently waiting for manual review.`);
  }
  if (retryProofCount > 0 && pendingProofCount === 0 && displayStatus !== "paid") {
    helperLines.push("A previous proof needs attention. Upload a clearer receipt or contact the business if you are unsure.");
  }
  if (showDepositRequest && depositStatus) {
    helperLines.push(
      `Deposit requested: ${money(depositStatus.remainingDeposit || depositStatus.request.amount, depositStatus.request.currency)}.`
    );
    helperLines.push("You can still pay the full invoice amount if the business agreed to skip or adjust the deposit.");
  } else if (depositStatus && depositStatus.label !== "Not paid" && displayStatus !== "paid") {
    helperLines.push(
      `Deposit received on record. Remaining invoice balance: ${money(depositStatus.request.remainingAfterDeposit, depositStatus.request.currency)}.`
    );
  }
  if (displayStatus === "partial" && !balance.unknown) {
    helperLines.push(
      `Remaining balance: ${invoice.currency === "USD" ? money(balance.usd, "USD") : money(balance.lbp, "LBP")}.`
    );
  }
  if (displayStatus === "paid") {
    helperLines.push("This invoice is fully paid on record. Keep the receipt link if the business has shared one.");
  }
  if (displayStatus === "overdue" && !balance.unknown) {
    helperLines.push(
      "This page can still be used for payment. If you already paid, upload proof below. If you need help or more time, contact the business from your usual thread."
    );
  }
  helperLines.push("Manual review protects both you and the business. Nothing here is auto-approved.");

  const trustSignals: PublicTrustSignal[] = [
    {
      icon: "status",
      title: "Business identity is visible",
      body: "Check the business name, contact details, invoice number, and amount before sending payment.",
      tone: "neutral"
    },
    {
      icon: "review",
      title: "Proof is reviewed manually",
      body: "Uploading a proof starts review by the business. It does not automatically mark the invoice paid.",
      tone: "info"
    },
    {
      icon: "receipt",
      title: "Receipts follow accepted payments",
      body: "Receipt links reflect payments the business has accepted or recorded.",
      tone: "good"
    },
    {
      icon: "wallet",
      title: "Partial payments are supported",
      body: "Deposits, installments, and remaining balances are shown from the current invoice record.",
      tone: "neutral"
    }
  ];

  const nextStepPanel = (() => {
    if (proofUploaded || pendingProofCount > 0) {
      return {
        tone: "info" as const,
        eyebrow: "Review in progress",
        title: "Your proof is waiting for the business",
        body: "Keep this link for status checks. The balance changes only after the business accepts the payment record."
      };
    }
    if (displayStatus === "paid") {
      return {
        tone: "good" as const,
        eyebrow: "Complete",
        title: "This invoice is fully paid",
        body: "No further proof is needed. Receipt records remain accessible from receipt links shared by the business."
      };
    }
    if (retryProofCount > 0) {
      return {
        tone: "warn" as const,
        eyebrow: "Proof follow-up",
        title: "Upload a clearer proof or contact the business",
        body: "A previous proof was not accepted or was voided. You can retry with a clear receipt, transfer screenshot, sender name, and amount."
      };
    }
    if (depositStatus && depositStatus.label !== "Not paid" && displayStatus !== "paid") {
      return {
        tone: "good" as const,
        eyebrow: "Deposit received",
        title: "Continue with the remaining balance",
        body: `The deposit is recorded. Remaining balance is ${money(depositStatus.request.remainingAfterDeposit, depositStatus.request.currency)} unless you arranged otherwise with the business.`
      };
    }
    if (showDepositRequest && depositStatus) {
      return {
        tone: "info" as const,
        eyebrow: "Deposit step",
        title: "Start with the requested deposit",
        body: `The requested deposit is ${money(depositStatus.remainingDeposit || depositStatus.request.amount, depositStatus.request.currency)}. Upload proof after payment so the business can review it.`
      };
    }
    if (displayStatus === "partial" && !balance.unknown) {
      return {
        tone: "info" as const,
        eyebrow: "Remaining balance",
        title: "A partial payment is already accepted",
        body: `Remaining balance is ${invoice.currency === "USD" ? money(balance.usd, "USD") : money(balance.lbp, "LBP")}.`
      };
    }
    if (displayStatus === "overdue") {
      return {
        tone: "warn" as const,
        eyebrow: "Past due",
        title: "This page still supports payment",
        body: "Use the payment methods below, upload proof if you already paid, or contact the business to agree a payment plan."
      };
    }
    return null;
  })();

  return (
    <PublicPageShell>
      <BrandedPublicSurface theme={docTheme} brandColor={brandColor} brandAccent={brandAccent}>
        <PublicContentContainer>
          <main className="print:bg-white">
            <PayTrustHeader
              businessName={businessName}
              invoiceTitle={invoice.title}
              invoiceNumber={invoice.invoice_number}
              createdAt={invoice.created_at}
              dueDate={invoice.due_date}
              validUntil={invoice.valid_until}
              clientLine={clientName ? `Prepared for ${clientName}` : `Client ${nounTitle.toLowerCase()}`}
              tagline={profile?.business_tagline}
              logoUrl={logoUrl}
              reviewStats={reviewStats}
            />

            <div className="mt-4">
              <BusinessContactStrip
                supportEmail={profile?.support_email}
                website={profile?.business_website}
                instagram={profile?.instagram_handle}
                whatsappPhone={profile?.whatsapp_phone || profile?.phone}
                businessHours={profile?.business_hours}
                city={profile?.business_city}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <StatusBadge status={displayStatus} />
              <PrintButton className="btn btn-secondary text-xs" showIcon={true} />
            </div>

          <div className="mt-5 space-y-5">
            <PayStatusExperience
              headline={phase.headline}
              subline={phase.subline}
              steps={timeline}
              depositFraction={showDepositRequest && depositStatus ? depositFraction : null}
            />

            <PayConversionHelpers lines={helperLines} />

            {nextStepPanel ? (
              <PublicNextStepPanel
                eyebrow={nextStepPanel.eyebrow}
                title={nextStepPanel.title}
                body={nextStepPanel.body}
                tone={nextStepPanel.tone}
              />
            ) : null}

            <PublicTrustSignalGrid
              title="How this payment is handled"
              body="These notes reflect the current Qaffel workflow for manual transfers and proof-based payments."
              signals={trustSignals}
            />

            {publicPlan ? (
              <PublicPaymentPlanBanner plan={publicPlan} currency={primaryCurrency as "USD" | "LBP"} />
            ) : null}

            <div className="flex flex-wrap gap-2">
              {publicFlags.map((flag) => (
                <PublicFlag key={flag.label} tone={flag.tone} label={flag.label} />
              ))}
            </div>

            {isQuote && (
              <p className="rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm font-medium text-violet-900">
                This is a quote. It is not a payment request until the business converts it.
              </p>
            )}
            {displayStatus === "overdue" && (
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">This invoice is past its due date. Payment is still accepted here.</p>
                <p className="mt-2 text-amber-900/90">
                  If you already paid, upload proof below so the business can reconcile. If anything does not match what you agreed, reach out to them directly for help.
                </p>
              </div>
            )}
            {invoice.approval_status === "rejected" && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                This document was rejected. Please contact the business.
              </p>
            )}
            {invoice.approval_status === "approved" && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
                {nounTitle} approved.{isQuote ? " The business can convert it to an invoice when ready." : " You can proceed with payment."}
              </p>
            )}
            {isExpired && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                <strong>Expired:</strong> This link is no longer valid. Ask the business for an updated payment page.
              </p>
            )}

            {(invoice.exchange_rate_lbp_per_usd || invoice.rate_note || invoice.valid_until) && (
              <section className="q-surface p-4 sm:p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{nounTitle} details</h3>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  {invoice.valid_until && (
                    <p>
                      Valid until: <span className="font-semibold">{shortDate(invoice.valid_until)}</span>
                    </p>
                  )}
                  {invoice.exchange_rate_lbp_per_usd && (
                    <p>
                      Exchange rate:{" "}
                      <span className="font-semibold">1 USD = {Number(invoice.exchange_rate_lbp_per_usd).toLocaleString()} LBP</span>
                    </p>
                  )}
                  {invoice.rate_note && <p className="border-l-2 border-slate-200 pl-3 italic text-slate-600">{invoice.rate_note}</p>}
                </div>
              </section>
            )}

            {showDepositRequest && depositStatus && (
              <section className="rounded-2xl border border-sky-200/80 bg-sky-50/[0.85] p-5 shadow-card">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-800">Deposit</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">
                  {money(depositStatus.remainingDeposit || depositStatus.request.amount, depositStatus.request.currency)}
                </h2>
                <p className="mt-2 text-sm text-sky-950">
                  Remaining invoice balance after this deposit:{" "}
                  <span className="font-semibold">{money(depositStatus.request.remainingAfterDeposit, depositStatus.request.currency)}</span>
                </p>
                {depositStatus.request.note ? (
                  <p className="mt-3 border-l-2 border-sky-200 pl-3 text-sm italic text-sky-900">{depositStatus.request.note}</p>
                ) : null}
                <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-100">
                  Full payment is still okay if you already arranged that with the business.
                </p>
              </section>
            )}

            {!isQuote && (
              <section className="q-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-ink">Payment history</h2>
                    <p className="mt-1 text-sm text-slate-600">Accepted payments recorded by the business.</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        displayStatus === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : displayStatus === "partial"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {displayStatus === "paid" ? "Paid" : displayStatus === "partial" ? "Partial" : "None accepted yet"}
                    </span>
                    {displayStatus !== "paid" ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {balance.unknown ? "Remaining balance updates after review." : `Remaining: ${invoice.currency === "USD" ? money(balance.usd, "USD") : money(balance.lbp, "LBP")}`}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-500">Invoice fully paid on record.</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  {!acceptedPayments || acceptedPayments.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-ink">No accepted payments yet.</p>
                      <p className="mt-1 text-sm text-slate-600">If you paid, upload proof below so the business can review.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {acceptedPayments.map((payment: { amount_usd?: number; amount_lbp?: number; payment_date?: string; uploaded_at?: string; method?: string; note?: string }, idx: number) => (
                        <div key={idx} className="rounded-xl border border-slate-100 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-bold text-ink">
                                {payment.amount_usd ? money(payment.amount_usd, "USD") : ""}
                                {payment.amount_usd && payment.amount_lbp ? " + " : ""}
                                {payment.amount_lbp ? money(payment.amount_lbp, "LBP") : ""}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Recorded {payment.payment_date ? shortDate(payment.payment_date) : shortDate(payment.uploaded_at)}
                              </p>
                            </div>
                          </div>
                          {(payment.method || payment.note) && (
                            <div className="mt-3 grid gap-1 text-xs">
                              {payment.method && (
                                <p className="text-slate-700">
                                  <span className="mr-1 font-semibold uppercase tracking-wider text-slate-500">Method</span>
                                  {formatPaymentMethod(payment.method)}
                                </p>
                              )}
                              {payment.note && <p className="border-l-2 border-slate-200 pl-3 italic text-slate-600">&ldquo;{payment.note}&rdquo;</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {invoice.approval_status === "pending" && !isExpired && (
              <ClientApprovalBox documentType={isQuote ? "quote" : "invoice"} token={token} />
            )}

            {!isQuote && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Confirmed paid</p>
                  <p className="mt-1 text-xl font-bold text-emerald-900">
                    {invoice.currency === "USD" ? money(balance.totalPaidUsd, "USD") : money(balance.totalPaidLbp, "LBP")}
                  </p>
                </div>
                <div
                  className={`rounded-2xl border p-4 ${
                    balance.usd > 0 || balance.lbp > 0 ? "border-amber-100 bg-amber-50/80" : "border-slate-100 bg-slate-50"
                  } ${balance.overpaidUsd > 0 || balance.overpaidLbp > 0 ? "border-2 border-emerald-300 bg-emerald-50" : ""}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Remaining balance</p>
                  {balance.unknown ? (
                    <p className="mt-1 text-sm font-semibold text-amber-900">Unknown - pending review</p>
                  ) : (
                    <p className="mt-1 text-xl font-bold text-amber-900">
                      {invoice.currency === "USD" ? money(balance.usd, "USD") : money(balance.lbp, "LBP")}
                    </p>
                  )}
                  {(balance.overpaidUsd > 0 || balance.overpaidLbp > 0) && (
                    <p className="mt-2 text-xs font-semibold text-emerald-800">
                      Overpaid by {balance.overpaidUsd > 0 ? money(balance.overpaidUsd, "USD") : money(balance.overpaidLbp, "LBP")} - contact the business.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <section className="q-surface p-4 sm:p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink">
                  <FileText className="h-5 w-5 text-cedar" aria-hidden />
                  {nounTitle} summary
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold text-slate-500">Amount USD</p>
                    <p className="mt-1 text-xl font-bold text-ink">{money(invoice.amount_usd, "USD")}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-xs font-semibold text-slate-500">Amount LBP</p>
                    <p className="mt-1 text-xl font-bold text-ink">{money(invoice.amount_lbp, "LBP")}</p>
                  </div>
                </div>
                {invoice.description ? <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{invoice.description}</p> : null}

                {!isQuote && displayStatus !== "paid" && (
                  <>
                    <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-bold text-ink">
                      <CreditCard className="h-5 w-5 text-cedar" aria-hidden />
                      How to pay
                    </h2>
                    {(methods || []).length === 0 ? (
                      <p className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-900">
                        No payment methods are published here yet. Please contact the business before sending money.
                      </p>
                    ) : (
                      <PublicPayMethodCards
                        methods={normalizedMethods}
                        suggestedAmount={suggestedAmount}
                        suggestedCurrency={suggestedCurrency}
                      />
                    )}
                  </>
                )}
              </section>

              <section className="q-panel p-4 sm:p-5 lg:sticky lg:top-6 lg:self-start" id="proof-upload">
                <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                  <UploadCloud className="h-5 w-5 text-cedar" aria-hidden />
                  {isQuote ? "Quote status" : "Upload proof"}
                </h2>

                {isQuote ? (
                  <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50 p-4">
                    <p className="text-sm font-semibold text-violet-900">This quote does not accept payment proof.</p>
                    <p className="mt-1 text-xs text-violet-800">After approval, the business can convert it to an invoice and this link becomes a payment page.</p>
                  </div>
                ) : isExpired ? (
                  <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-800">This link expired. Proof upload is disabled.</p>
                    <p className="mt-1 text-xs text-amber-800">Contact the business for an updated link.</p>
                  </div>
                ) : invoice.approval_status === "pending" ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">Approve this invoice before uploading proof.</p>
                  </div>
                ) : invoice.approval_status === "rejected" ? (
                  <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-800">This invoice was rejected. Upload is disabled.</p>
                  </div>
                ) : displayStatus === "paid" ? (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                    <p className="text-sm font-semibold text-emerald-900">Fully paid. No further proof needed.</p>
                  </div>
                ) : displayStatus === "rejected" ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">This invoice is not accepting proofs. Contact the business.</p>
                  </div>
                ) : (
                  <>
                    {retryProofCount > 0 && pendingProofCount === 0 ? (
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-amber-900">A previous proof needs attention.</p>
                        <p className="mt-1 text-xs leading-relaxed text-amber-800">
                          Upload a clearer receipt or screenshot, include the sender name and amount, or contact the business if the transfer details changed.
                        </p>
                      </div>
                    ) : null}
                    {proofUploaded ? (
                      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-semibold text-emerald-900">Upload received.</p>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                          It is now pending manual review. The invoice balance updates after the business accepts it.
                        </p>
                      </div>
                    ) : null}
                    <ProofUploadForm
                      token={token}
                      methods={normalizedMethods}
                      defaultAmountUsd={depositUploadAmountUsd}
                      defaultAmountLbp={depositUploadAmountLbp}
                      defaultMethodLabel={defaultMethodForProof}
                    />
                  </>
                )}
              </section>
            </div>

            <PublicPayHelpFooter
              businessName={businessName}
              businessPhone={profile?.phone}
              whatsappPhone={profile?.whatsapp_phone}
            />
          </div>

          {profile?.invoice_footer_note?.trim() ? (
            <p className="mt-6 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-center text-xs leading-relaxed text-slate-600">
              {profile.invoice_footer_note.trim()}
            </p>
          ) : null}

          <style
            dangerouslySetInnerHTML={{
              __html: `
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          .rounded-2xl, .rounded-3xl, .rounded-xl { box-shadow: none !important; }
          header, footer, .btn { display: none !important; }
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
