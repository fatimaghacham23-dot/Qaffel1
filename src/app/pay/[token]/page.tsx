import { StatusBadge } from "@/components/StatusBadge";
import { PrintButton } from "@/components/PrintButton";
import { ProofUploadForm } from "@/components/ProofUploadForm";
import { ClientApprovalBox } from "@/components/ClientApprovalBox";
import { CopyButton } from "@/components/CopyButton";
import { PaymentMethodIcon } from "@/components/PaymentMethodIcon";
import { SafePaymentQrImage } from "@/components/SafePaymentQrImage";
import { CreditCard, FileText, UploadCloud } from "lucide-react";
import { money, shortDate, formatPaymentMethod } from "@/lib/format";
import { getDepositStatus } from "@/lib/deposit";
import { documentNounTitle, documentStatus, isQuoteDocument } from "@/lib/documents";
import { toPublicPaymentMethodOption } from "@/lib/public-pay-method";
import { resolveSafeHttpsPageUrl } from "@/lib/safe-qr-url";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
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
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, user_id, public_token, invoice_number, title, description, amount_usd, amount_lbp, currency, due_date, status, document_type, approval_status, valid_until, exchange_rate_lbp_per_usd, rate_note, approved_at, approved_by_name, approved_note, deposit_enabled, deposit_type, deposit_percent, deposit_amount_usd, deposit_amount_lbp, deposit_note, clients(name)"
    )
    .eq("public_token", token)
    .maybeSingle();

  if (!invoice) {
    notFound();
  }

  const [{ data: profile }, { data: proofs }, { data: methods }, { data: acceptedPayments }] = await Promise.all([
    supabase.from("profiles").select("business_name, full_name, phone").eq("id", invoice.user_id).maybeSingle(),
    supabase.from("payment_proofs").select("status, amount_usd, amount_lbp").eq("invoice_id", invoice.id).order("uploaded_at", { ascending: false }),
    supabase
      .from("payment_methods")
      .select("type, label, instructions, receiver_name, receiver_phone, account_reference, qr_image_path, external_link")
      .eq("user_id", invoice.user_id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase.rpc("get_public_payment_history_by_token", { p_token: token })
  ]);

  const balance = getRemainingBalance(invoice, proofs || []);
  const reconciledStatus = reconcileInvoiceStatus(invoice, proofs || []);
  const isQuote = isQuoteDocument(invoice);
  const nounTitle = documentNounTitle(invoice);
  const displayStatus = isQuote
    ? documentStatus({ ...invoice, status: reconciledStatus })
    : getDisplayInvoiceStatus({ ...invoice, status: reconciledStatus });
  const depositStatus = getDepositStatus(invoice, proofs || []);
  const showDepositRequest = Boolean(!isQuote && depositStatus && displayStatus !== "paid" && depositStatus.label === "Not paid");
  const depositUploadAmount = showDepositRequest && depositStatus
    ? depositStatus.remainingDeposit || depositStatus.request.amount
    : null;
  const depositUploadAmountUsd = depositStatus?.request.currency === "USD" ? depositUploadAmount : null;
  const depositUploadAmountLbp = depositStatus?.request.currency === "LBP" ? depositUploadAmount : null;
  const invoiceClient = invoice.clients as { name?: string | null } | { name?: string | null }[] | null;
  const clientName = Array.isArray(invoiceClient) ? invoiceClient[0]?.name : invoiceClient?.name;
  const isExpired = invoice.valid_until && new Date(invoice.valid_until) < new Date() && (isQuote ? displayStatus === "expired" : displayStatus !== "paid");
  const hasAcceptedPayments = Boolean(acceptedPayments && acceptedPayments.length > 0);
  const publicFlags = [
    isExpired ? { tone: "danger" as const, label: "Expired link" } : null,
    displayStatus === "overdue" ? { tone: "danger" as const, label: "Overdue invoice" } : null,
    showDepositRequest ? { tone: "info" as const, label: "Deposit requested" } : null,
    displayStatus === "partial" ? { tone: "info" as const, label: "Partial payment" } : null,
    displayStatus === "paid" ? { tone: "good" as const, label: "Fully paid" } : null,
    invoice.approval_status === "pending" ? { tone: "warn" as const, label: "Client approval required" } : null,
    !isQuote && !hasAcceptedPayments ? { tone: "warn" as const, label: "No accepted payments" } : null,
    !isQuote && (methods || []).length === 0 ? { tone: "warn" as const, label: "No payment methods active" } : null,
    invoice.public_token ? { tone: "good" as const, label: "Portal link active" } : null
  ].filter(Boolean) as Array<{ tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }>;

  const normalizedMethods = (methods || []).map((row) => toPublicPaymentMethodOption(row as Record<string, unknown>));
  const whishMethods = normalizedMethods.filter((m) => m.normalizedType === "whish");
  const omtMethods = normalizedMethods.filter((m) => m.normalizedType === "omt");

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft lg:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-cedar">
          {profile?.business_name || profile?.full_name || "Qaffel invoice"}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-words text-3xl font-bold tracking-normal text-ink lg:text-4xl">{invoice.title}</h1>
            <StatusBadge status={displayStatus} />
            <StatusBadge status={isQuote ? "quote" : "active"} label={nounTitle} />
          </div>
          <PrintButton className="btn btn-secondary text-xs" showIcon={true} />
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {clientName ? `For ${clientName}` : `Client ${nounTitle.toLowerCase()}`} - due {shortDate(invoice.due_date)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {publicFlags.map((flag) => (
            <PublicFlag key={flag.label} tone={flag.tone} label={flag.label} />
          ))}
        </div>
        {isQuote && (
          <p className="mt-3 rounded-md border border-violet-200 bg-violet-50 p-3 text-sm font-medium text-violet-800">
            This is a quote, not a payment request yet.
          </p>
        )}
        {displayStatus === "overdue" && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium">
            This invoice is overdue. Please contact the business if you already paid.
          </p>
        )}
        {invoice.approval_status === "rejected" && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 font-medium">
            This invoice was rejected. Please contact the business.
          </p>
        )}
        {invoice.approval_status === "approved" && (
           <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 font-medium">
             {nounTitle} approved.{isQuote ? " The business can convert it to an invoice when ready." : " You can now proceed with payment."}
           </p>
        )}
        {isExpired && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 font-medium">
            <strong>Expired:</strong> This {isQuote ? "quote" : "payment"} link has expired. Please contact the business.
          </p>
        )}
        {(invoice.exchange_rate_lbp_per_usd || invoice.rate_note || invoice.valid_until) && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{nounTitle} Details</h3>
            <div className="grid gap-2 text-sm text-slate-700">
              {invoice.valid_until && (
                <p>Valid until: <span className="font-semibold">{shortDate(invoice.valid_until)}</span></p>
              )}
              {invoice.exchange_rate_lbp_per_usd && (
                <p>Exchange rate: <span className="font-semibold">1 USD = {invoice.exchange_rate_lbp_per_usd.toLocaleString()} LBP</span></p>
              )}
              {invoice.rate_note && (
                <p className="italic text-slate-600 border-l-2 border-slate-300 pl-3 mt-1">{invoice.rate_note}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-5 shadow-soft">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Trust &amp; verification</h2>
        <dl className="mt-3 grid gap-2 text-sm text-slate-800">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-slate-500">Business</dt>
            <dd className="font-semibold text-ink">{profile?.business_name || profile?.full_name || "—"}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-slate-500">Invoice number</dt>
            <dd className="font-mono font-semibold text-ink">{invoice.invoice_number?.trim() || "—"}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-slate-500">Link valid until</dt>
            <dd className="font-semibold text-ink">
              {invoice.valid_until ? shortDate(invoice.valid_until) : "No expiry on this link"}
            </dd>
          </div>
        </dl>
        <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">
          <p>
            <strong className="text-slate-700">Manual review:</strong> Whish, OMT, and bank screenshots are verified by the business (or their team) before an invoice is marked paid.
          </p>
          <p>
            <strong className="text-slate-700">Qaffel never auto-confirms payments.</strong> Uploading a proof starts the review queue — it does not instantly close the invoice.
          </p>
        </div>
      </section>

      {showDepositRequest && depositStatus && (
        <section className="mb-8 rounded-2xl border border-sky-100 bg-sky-50 p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Deposit requested</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">
                {money(depositStatus.remainingDeposit || depositStatus.request.amount, depositStatus.request.currency)}
              </h2>
              <p className="mt-2 text-sm text-sky-900">
                This upfront payment secures the invoice. The remaining balance of{" "}
                <span className="font-semibold">
                  {money(depositStatus.request.remainingAfterDeposit, depositStatus.request.currency)}
                </span>{" "}
                is due later.
              </p>
              {depositStatus.request.note ? (
                <p className="mt-3 border-l-2 border-sky-200 pl-3 text-sm italic text-sky-800">
                  {depositStatus.request.note}
                </p>
              ) : null}
            </div>
            <div className="rounded-md bg-white/70 p-3 text-sm text-sky-900">
              Full payment is still okay if you already paid the full invoice.
            </div>
          </div>
        </section>
      )}

      {!isQuote && (
      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-ink">Payment history</h2>
            <p className="mt-1 text-sm text-slate-600">Accepted payments recorded by the business.</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                displayStatus === "paid"
                  ? "bg-emerald-100 text-emerald-800"
                  : displayStatus === "partial"
                    ? "bg-sky-100 text-sky-800"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {displayStatus === "paid" ? "FULLY PAID" : displayStatus === "partial" ? "PARTIALLY PAID" : "NO ACCEPTED PAYMENTS"}
            </span>
            {displayStatus !== "paid" ? (
              <p className="text-[10px] text-slate-500 italic">
                {balance.unknown
                  ? "Remaining balance may be updated after review."
                  : `Remaining: ${invoice.currency === "USD" ? money(balance.usd, "USD") : money(balance.lbp, "LBP")}`}
              </p>
            ) : (
              <p className="text-[10px] text-slate-500 italic">This invoice is fully paid.</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          {!acceptedPayments || acceptedPayments.length === 0 ? (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-ink">No accepted payments yet.</p>
              <p className="mt-1 text-sm text-slate-600">
                If you already paid, upload a payment proof below so the business can review it.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {acceptedPayments.map((payment: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {payment.amount_usd ? money(payment.amount_usd, "USD") : ""}
                        {payment.amount_usd && payment.amount_lbp ? " + " : ""}
                        {payment.amount_lbp ? money(payment.amount_lbp, "LBP") : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Recorded on {payment.payment_date ? shortDate(payment.payment_date) : shortDate(payment.uploaded_at)}
                      </p>
                    </div>
                  </div>

                  {(payment.method || payment.note) && (
                    <div className="mt-3 grid gap-1 text-xs">
                      {payment.method && (
                        <p className="text-slate-700">
                          <span className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider mr-1">Method:</span>
                          {formatPaymentMethod(payment.method)}
                        </p>
                      )}
                      {payment.note && (
                        <p className="italic text-slate-600 border-l-2 border-slate-200 pl-3">
                          &ldquo;{payment.note}&rdquo;
                        </p>
                      )}
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
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="panel bg-emerald-50 border-emerald-100">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Total paid</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">
             {invoice.currency === "USD" 
              ? money(balance.totalPaidUsd, "USD") 
              : money(balance.totalPaidLbp, "LBP")}
          </p>
        </div>
        <div className={`panel border-amber-100 ${balance.usd > 0 || balance.lbp > 0 ? "bg-amber-50" : "bg-slate-50"} ${(balance.overpaidUsd > 0 || balance.overpaidLbp > 0) ? "border-2 border-emerald-500 bg-emerald-50" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">
            Remaining balance
          </p>
          {balance.unknown ? (
             <p className="mt-1 text-sm font-bold text-amber-700 italic">Remaining balance unknown</p>
          ) : (
             <div className="mt-1">
               <p className="text-2xl font-bold text-amber-700">
                 {invoice.currency === "USD" 
                  ? money(balance.usd, "USD") 
                  : money(balance.lbp, "LBP")}
               </p>
               {(balance.overpaidUsd > 0 || balance.overpaidLbp > 0) && (
                 <p className="mt-1 text-xs font-bold text-emerald-700">
                   Overpaid by {balance.overpaidUsd > 0 ? money(balance.overpaidUsd, "USD") : money(balance.overpaidLbp, "LBP")}
                 </p>
               )}
             </div>
          )}
          {(balance.overpaidUsd > 0 || balance.overpaidLbp > 0) && (
            <p className="mt-1 text-[10px] text-emerald-700 font-medium italic">
              Accepted payments exceed the invoice total. Please contact the business if this was a mistake.
            </p>
          )}
        </div>
      </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="panel">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-ink">
            <FileText className="h-5 w-5 text-cedar" aria-hidden="true" />
            {nounTitle}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Amount USD</p>
              <p className="mt-1 text-2xl font-bold text-ink">{money(invoice.amount_usd, "USD")}</p>
            </div>
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Amount LBP</p>
              <p className="mt-1 text-2xl font-bold text-ink">{money(invoice.amount_lbp, "LBP")}</p>
            </div>
          </div>
          {invoice.description ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{invoice.description}</p> : null}

          {!isQuote && displayStatus !== "paid" && (
            <>
              <h2 className="mb-3 mt-6 flex items-center gap-2 text-lg font-bold text-ink">
                <CreditCard className="h-5 w-5 text-cedar" aria-hidden="true" />
                Payment instructions
              </h2>
              {(methods || []).length === 0 ? (
                <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-600">
                  No payment methods are available. Please contact the business directly before paying.
                </p>
              ) : (
              <>
                {(whishMethods.length > 0 || omtMethods.length > 0) && suggestedAmount && suggestedAmount > 0 && (
                  <div className="mb-4 grid gap-3 md:grid-cols-2">
                    {whishMethods.map((method, wi) => (
                      <article key={`whish-${wi}-${method.label}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                        <div className="flex items-start gap-3">
                          <PaymentMethodIcon type={method.type || ""} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Whish Money</p>
                            <h3 className="mt-1 text-base font-bold text-ink truncate">{method.label}</h3>
                            <p className="mt-1 text-sm text-slate-600">
                              Pay{" "}
                              <span className="font-semibold">
                                {money(suggestedAmount, suggestedCurrency as any)}
                              </span>{" "}
                              via Whish Money, then upload a screenshot below.
                            </p>
                          </div>
                        </div>
                        <dl className="mt-3 grid gap-1 text-xs text-slate-700">
                          {method.receiver_name && (
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-500">Receiver</dt>
                              <dd className="font-semibold text-ink truncate">{method.receiver_name}</dd>
                            </div>
                          )}
                          {method.receiver_phone && (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <dt className="text-slate-500">Phone / account</dt>
                                <dd className="font-semibold text-ink truncate">{method.receiver_phone}</dd>
                              </div>
                              <CopyButton
                                className="btn btn-secondary btn-xs shrink-0"
                                value={method.receiver_phone}
                                label="Copy phone"
                              />
                            </div>
                          )}
                          {method.account_reference && (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <dt className="text-slate-500">Reference</dt>
                                <dd className="font-semibold text-ink truncate">{method.account_reference}</dd>
                              </div>
                              <CopyButton
                                className="btn btn-secondary btn-xs shrink-0"
                                value={method.account_reference}
                                label="Copy reference"
                              />
                            </div>
                          )}
                        </dl>
                        {method.qr_image_path?.trim() ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                              QR code
                            </p>
                            <SafePaymentQrImage key={method.qr_image_path} srcRaw={method.qr_image_path} alt="Whish QR code" />
                          </div>
                        ) : null}
                        <div className="mt-3 space-y-2 text-xs text-slate-600">
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {method.instructions}
                          </p>
                          <CopyButton
                            className="btn btn-secondary btn-xs"
                            value={method.instructions}
                            label="Copy instructions"
                          />
                          <p className="text-[11px] text-slate-500">
                            After paying via Whish Money, upload a clear screenshot of the confirmation below.
                          </p>
                          <a
                            href={`?method=whish#proof-upload`}
                            className="inline-flex text-[11px] font-semibold text-cedar underline"
                          >
                            Use Whish Money and scroll to upload proof
                          </a>
                        </div>
                      </article>
                    ))}
                    {omtMethods.map((method, oi) => {
                      const safeExternal = resolveSafeHttpsPageUrl(method.external_link);
                      return (
                      <article key={`omt-${oi}-${method.label}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
                        <div className="flex items-start gap-3">
                          <PaymentMethodIcon type={method.type || ""} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">OMT Pay</p>
                            <h3 className="mt-1 text-base font-bold text-ink truncate">{method.label}</h3>
                            <p className="mt-1 text-sm text-slate-600">
                              Pay{" "}
                              <span className="font-semibold">
                                {money(suggestedAmount, suggestedCurrency as any)}
                              </span>{" "}
                              at OMT to this receiver, then upload a screenshot below.
                            </p>
                          </div>
                        </div>
                        <dl className="mt-3 grid gap-1 text-xs text-slate-700">
                          {method.receiver_name && (
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-500">Receiver</dt>
                              <dd className="font-semibold text-ink truncate">{method.receiver_name}</dd>
                            </div>
                          )}
                          {method.receiver_phone && (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <dt className="text-slate-500">Phone / wallet</dt>
                                <dd className="font-semibold text-ink truncate">{method.receiver_phone}</dd>
                              </div>
                              <CopyButton
                                className="btn btn-secondary btn-xs shrink-0"
                                value={method.receiver_phone}
                                label="Copy phone"
                              />
                            </div>
                          )}
                          {method.account_reference && (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <dt className="text-slate-500">Reference</dt>
                                <dd className="font-semibold text-ink truncate">{method.account_reference}</dd>
                              </div>
                              <CopyButton
                                className="btn btn-secondary btn-xs shrink-0"
                                value={method.account_reference}
                                label="Copy reference"
                              />
                            </div>
                          )}
                        </dl>
                        {(method.qr_image_path?.trim() || safeExternal) && (
                          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                            {method.qr_image_path?.trim() ? (
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                  QR code
                                </p>
                                <SafePaymentQrImage key={method.qr_image_path} srcRaw={method.qr_image_path} alt="OMT QR code" />
                              </div>
                            ) : null}
                            {safeExternal ? (
                              <a
                                href={safeExternal}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex text-[11px] font-semibold text-cedar underline"
                              >
                                Open OMT payment link
                              </a>
                            ) : null}
                          </div>
                        )}
                        <div className="mt-3 space-y-2 text-xs text-slate-600">
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {method.instructions}
                          </p>
                          <CopyButton
                            className="btn btn-secondary btn-xs"
                            value={method.instructions}
                            label="Copy instructions"
                          />
                          <p className="text-[11px] text-slate-500">
                            After paying via OMT, upload a clear screenshot of the receipt below.
                          </p>
                          <a
                            href={`?method=omt#proof-upload`}
                            className="inline-flex text-[11px] font-semibold text-cedar underline"
                          >
                            Use OMT Pay and scroll to upload proof
                          </a>
                        </div>
                      </article>
                      );
                    })}
                  </div>
                )}

                <div className="grid gap-3">
                  {normalizedMethods.map((method, mi) => (
                    <div key={`method-${mi}-${method.label}`} className="rounded-md border border-slate-100 p-4">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-ink">{method.label}</p>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{method.instructions}</p>
                    </div>
                  ))}
                </div>
              </>
              )}
            </>
          )}
        </section>

        <section className="panel h-fit" id="proof-upload">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <UploadCloud className="h-5 w-5 text-cedar" aria-hidden="true" />
            {isQuote ? "Quote status" : "Upload payment proof"}
          </h2>
          
          {isQuote ? (
            <div className="mt-4 rounded-md border border-violet-100 bg-violet-50 p-4">
              <p className="text-sm font-semibold text-violet-900">
                This quote is not accepting payment proof.
              </p>
              <p className="mt-1 text-xs text-violet-800">
                After approval, the business can convert it to an invoice and this same link will become a payment page.
              </p>
            </div>
          ) : isExpired ? (
            <div className="mt-4 rounded-md bg-amber-50 p-4 border border-amber-100">
              <p className="text-sm font-medium text-amber-700 italic">This invoice has expired. Proof upload is disabled.</p>
              <p className="mt-1 text-xs text-amber-700">Please contact the business to receive an updated invoice link.</p>
            </div>
          ) : invoice.approval_status === "pending" ? (
            <div className="mt-4 rounded-md bg-slate-50 p-4 border border-slate-200">
              <p className="text-sm font-medium text-slate-700 italic">Please approve this invoice before uploading payment proof.</p>
            </div>
          ) : invoice.approval_status === "rejected" ? (
            <div className="mt-4 rounded-md bg-red-50 p-4 border border-red-100">
              <p className="text-sm font-medium text-red-700">This invoice was rejected. Proof upload disabled.</p>
            </div>
          ) : displayStatus === "paid" ? (
            <div className="mt-4 rounded-md bg-emerald-50 p-4 border border-emerald-100 text-center">
              <p className="text-sm font-semibold text-emerald-800 italic">
                This invoice is fully paid. No further payment proof is needed.
              </p>
            </div>
          ) : displayStatus === "rejected" ? (
            <div className="mt-4 rounded-md bg-slate-50 p-4 border border-slate-200">
              <p className="text-sm font-medium text-slate-700">This invoice is no longer accepting payment proofs. Please contact the business.</p>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">Upload a screenshot after paying. The freelancer will review it manually.</p>
              {proofUploaded ? (
                <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-800">Payment proof uploaded successfully.</p>
                  <p className="text-xs text-emerald-700">The business will review your proof manually.</p>
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

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          .panel { border: none !important; box-shadow: none !important; padding: 0 !important; margin-bottom: 2rem !important; }
          .lg\\:grid-cols-\\[1fr_360px\\] { grid-template-cols: 1fr !important; }
          header, footer, .btn { display: none !important; }
        }
      `}} />
    </main>
  );
}
