import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { money, shortDate, formatPaymentMethod } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { PrintReceiptButton } from "@/components/PrintReceiptButton";

export default async function ReceiptPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Record view event
  await supabase.rpc("record_receipt_view", { p_token: token });

  const { data: receiptData } = await supabase.rpc("get_public_receipt_data", { p_token: token }).maybeSingle();

  if (!receiptData) {
    return notFound();
  }

  const receipt = receiptData as any;
  const statusLower = String(receipt.status || "").toLowerCase();
  const isVoided = statusLower === "voided" || statusLower === "rejected";
  const isAccepted = statusLower === "accepted";
  const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${receipt.invoice_public_token}`;

  const statusBadgeLabel = isVoided ? "VOIDED" : isAccepted ? "Accepted" : "Pending";
  const statusBadgeClass = isVoided
    ? "bg-red-100 text-red-700 ring-red-200"
    : isAccepted
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className={`rounded-3xl border bg-white p-6 shadow-xl print:border-none print:shadow-none print:p-0 sm:p-8 ${isVoided ? "border-red-300" : "border-slate-200"}`}>
        {isVoided && (
          <div className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-red-800 print:border print:p-3">
            <p className="text-sm font-black uppercase tracking-wider">VOIDED receipt</p>
            <p className="mt-1 text-sm">This payment record has been marked void or invalid and should not be treated as proof of payment.</p>
          </div>
        )}
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-100 pb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink uppercase">
              {receipt.business_name || "Payment Receipt"}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Receipt No: <span className="font-mono text-ink">{receipt.receipt_number}</span>
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest ring-1 ${statusBadgeClass}`}>
              {statusBadgeLabel}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Date: {shortDate(receipt.confirmed_at || new Date().toISOString())}
            </p>
          </div>
        </header>

        <section className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bill From</p>
            <p className="mt-1 font-bold text-ink">{receipt.business_name}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bill To</p>
            <p className="mt-1 font-bold text-ink">{receipt.client_name || "-"}</p>
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-slate-50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Invoice Reference</p>
              <p className="mt-1 font-bold text-ink">
                {receipt.invoice_number ? `#${receipt.invoice_number} - ` : ""}
                {receipt.invoice_title}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Link href={`/pay/${receipt.invoice_public_token}`} className="btn btn-secondary text-xs">
                Open invoice
              </Link>
              <CopyButton value={invoiceUrl} label="Copy invoice link" className="btn btn-secondary text-xs" />
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Payment Date</span>
              <span className="text-sm font-bold text-ink">{shortDate(receipt.payment_date || receipt.confirmed_at)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-600">Method</span>
              <span className="text-sm font-bold text-ink">{formatPaymentMethod(receipt.method)}</span>
            </div>
            {isAccepted && ["whish", "omt"].some((t) => (receipt.method || "").toLowerCase().includes(t)) && (
              <p className="mt-2 text-xs text-slate-500">
                Manually reviewed by the business based on your uploaded Whish / OMT proof.
              </p>
            )}
            {receipt.note && (
              <div className="mt-3 flex items-start justify-between gap-4">
                <span className="text-sm font-semibold text-slate-600">Note</span>
                <span className="text-sm text-right font-medium text-slate-700 break-words">{receipt.note}</span>
              </div>
            )}
            
            <div className="mt-8 border-t-2 border-slate-900 pt-6 flex items-center justify-between">
              <span className="text-lg font-black uppercase tracking-tight text-ink">Total Paid</span>
              <span className="text-2xl font-black text-ink">
                {receipt.amount_usd ? money(receipt.amount_usd, "USD") : ""}
                {receipt.amount_usd && receipt.amount_lbp ? " + " : ""}
                {receipt.amount_lbp ? money(receipt.amount_lbp, "LBP") : ""}
              </span>
            </div>
          </div>
        </section>

        {isVoided && (
          <section className="mt-8 rounded-2xl border-2 border-dashed border-red-300 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-black uppercase tracking-tight text-red-700">Receipt Voided</h2>
            {receipt.void_reason && (
              <p className="mt-2 text-sm text-red-600 font-medium">Reason: {receipt.void_reason}</p>
            )}
            <p className="mt-4 text-xs text-red-500 italic">
              This payment record has been marked as void or invalid.
            </p>
          </section>
        )}

        <footer className="mt-12 text-center text-slate-500">
          {isVoided ? (
            <>
              <p className="text-xs font-medium tracking-wide text-red-700">
                This receipt is void or invalid — do not use it as proof of payment.
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed text-red-600/90">
                Ask the business for an updated record or open your invoice from the payer if you need a valid receipt.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium tracking-wide">
                Thank you for your payment. This receipt is computer-generated from payment data recorded in Qaffel — not a bank certificate.
              </p>
              <p className="mx-auto mt-2 max-w-lg text-[11px] leading-relaxed">
                If this receipt was voided, treat it as invalid for accounting — open the invoice link from your payer or ask the business for an updated record.
              </p>
            </>
          )}
          <div className="mt-4 print:hidden">
            <PrintReceiptButton className="btn btn-secondary text-xs" />
          </div>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; padding: 0 !important; margin: 0 !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          header { border-bottom: 2px solid #0f172a !important; }
          .rounded-3xl { border: none !important; border-radius: 0 !important; }
          .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
          @page { margin: 1.5cm; }
        }
      `}} />
    </main>
  );
}
