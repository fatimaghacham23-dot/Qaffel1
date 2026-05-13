import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getDepositStatus } from "@/lib/deposit";
import { documentNounTitle, documentStatus, isQuoteDocument } from "@/lib/documents";
import { money, shortDate } from "@/lib/format";
import { getDisplayInvoiceStatus, getRemainingBalance } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { PrintButton } from "@/components/PrintButton";

export default async function PrintInvoicePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const [{ data: invoice }, { data: profile }, { data: methods }, { data: proofs }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, clients(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("business_name, full_name, phone, business_address")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("payment_proofs")
      .select("status, amount_usd, amount_lbp")
      .eq("invoice_id", id)
      .eq("status", "accepted")
  ]);

  if (!invoice) {
    return notFound();
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const paymentLink = `${appUrl}/pay/${invoice.public_token}`;
  const isQuote = isQuoteDocument(invoice);
  const nounTitle = documentNounTitle(invoice);
  const displayStatus = isQuote ? documentStatus(invoice) : getDisplayInvoiceStatus(invoice);
  const balance = getRemainingBalance(invoice, proofs || []);
  const depositStatus = getDepositStatus(invoice, proofs || []);
  const isExpired = invoice.valid_until && new Date(invoice.valid_until) < new Date() && (isQuote ? displayStatus === "expired" : invoice.status !== "paid");

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      {/* Print Controls - Hidden during print */}
      <div className="mb-8 flex items-center justify-between border-b border-slate-100 pb-4 print:hidden">
        <Link 
          href={`/invoices/${id}`}
          className="text-sm font-semibold text-cedar hover:underline"
        >
          &larr; Back to {nounTitle.toLowerCase()}
        </Link>
        <PrintButton label="Print / Save as PDF" />
      </div>

      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">
              {profile?.business_name || profile?.full_name || nounTitle}
            </h1>
            {profile?.phone && <p className="text-sm text-slate-600">{profile.phone}</p>}
            {profile?.business_address && (
              <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{profile.business_address}</p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-ink">{nounTitle.toUpperCase()}</h2>
            <p className="text-sm text-slate-600">#{invoice.invoice_number}</p>
            <div className="mt-1 flex flex-col items-end gap-1">
              <div className="flex gap-1">
                <StatusBadge status={displayStatus} />
                {isExpired && <StatusBadge status="rejected" label="EXPIRED" />}
              </div>
              {invoice.approval_status !== "not_required" && (
                <StatusBadge status={invoice.approval_status} />
              )}
            </div>
          </div>
        </div>

        {(invoice.valid_until || invoice.exchange_rate_lbp_per_usd || invoice.rate_note) && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Validity & Rates</h3>
            <div className="grid gap-2 text-sm text-slate-700">
              {invoice.valid_until && (
                <p>Quote valid until: <span className="font-semibold">{shortDate(invoice.valid_until)}</span></p>
              )}
              {invoice.exchange_rate_lbp_per_usd && (
                <p>Exchange rate: <span className="font-semibold">1 USD = {invoice.exchange_rate_lbp_per_usd.toLocaleString()} LBP</span></p>
              )}
              {invoice.rate_note && (
                <p className="italic text-slate-600 border-l-2 border-slate-200 pl-3 mt-1">{invoice.rate_note}</p>
              )}
            </div>
          </div>
        )}

        {isExpired && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">Expired link</p>
            <p className="mt-1 text-sm text-red-800">This public {isQuote ? "quote" : "payment"} link is past its validity date.</p>
          </div>
        )}

        {invoice.approval_status === "approved" && (
          <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Client Approval</p>
            <p className="mt-1 text-sm text-emerald-800">
              Approved by {invoice.approved_by_name} on {shortDate(invoice.approved_at)}
            </p>
            {invoice.approved_note && (
               <p className="mt-1 text-xs italic text-emerald-700">&ldquo;{invoice.approved_note}&rdquo;</p>
            )}
          </div>
        )}

        <div className="mb-10 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Bill To</h3>
            <p className="font-bold text-ink">{invoice.clients?.name || "No client"}</p>
            {invoice.clients?.email && <p className="text-sm text-slate-600">{invoice.clients.email}</p>}
            {invoice.clients?.phone && <p className="text-sm text-slate-600">{invoice.clients.phone}</p>}
          </div>
          <div className="sm:text-right">
            <div className="mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Date Issued</h3>
              <p className="text-sm text-ink">{shortDate(invoice.created_at)}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Due Date</h3>
              <p className="text-sm text-ink font-semibold">{shortDate(invoice.due_date)}</p>
            </div>
          </div>
        </div>

        {!isQuote && depositStatus && (
          <div className="mb-10 rounded-xl border border-sky-200 bg-sky-50 p-5 print:bg-white">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700">Deposit requested</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Deposit amount</p>
                <p className="mt-1 font-bold text-ink">{money(depositStatus.request.amount, depositStatus.request.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Deposit status</p>
                <p className="mt-1 font-bold text-ink">{depositStatus.label}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Remaining after deposit</p>
                <p className="mt-1 font-bold text-ink">{money(depositStatus.request.remainingAfterDeposit, depositStatus.request.currency)}</p>
              </div>
            </div>
            {depositStatus.request.note ? <p className="mt-3 text-sm italic text-sky-800">{depositStatus.request.note}</p> : null}
          </div>
        )}

        {/* Document Item Table */}
        <div className="mb-10 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Description</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-4 py-6">
                  <p className="font-bold text-ink">{invoice.title}</p>
                  {invoice.description && (
                    <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap">{invoice.description}</p>
                  )}
                </td>
                <td className="px-4 py-6 text-right align-top">
                  <p className="font-bold text-ink">{money(invoice.amount_usd, "USD")}</p>
                  {invoice.amount_lbp && (
                    <p className="mt-1 text-xs text-slate-500">{money(invoice.amount_lbp, "LBP")}</p>
                  )}
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
              <tr>
                <td className="px-4 py-3 text-right text-slate-600">{nounTitle} Total</td>
                <td className="px-4 py-3 text-right text-lg text-ink">
                  {invoice.currency === "USD" ? money(invoice.amount_usd, "USD") : money(invoice.amount_lbp, "LBP")}
                </td>
              </tr>
              {!isQuote && (
                <>
                  <tr>
                    <td className="px-4 py-3 text-right text-slate-600">Total Paid</td>
                    <td className="px-4 py-3 text-right text-lg text-emerald-600">
                      {invoice.currency === "USD" 
                        ? money(balance.totalPaidUsd, "USD") 
                        : money(balance.totalPaidLbp, "LBP")}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-right text-slate-600">
                      Balance Due
                    </td>
                    <td className="px-4 py-3 text-right text-xl text-ink">
                      {invoice.currency === "USD" 
                        ? money(balance.usd, "USD")
                        : money(balance.lbp, "LBP")}
                    </td>
                  </tr>
                  {(balance.overpaidUsd > 0 || balance.overpaidLbp > 0) && (
                    <tr>
                      <td className="px-4 py-3 text-right text-emerald-700">
                        Overpaid
                      </td>
                      <td className="px-4 py-3 text-right text-xl text-emerald-700">
                        {invoice.currency === "USD" 
                          ? money(balance.overpaidUsd, "USD")
                          : money(balance.overpaidLbp, "LBP")}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tfoot>
          </table>
        </div>

        {/* Payment Instructions */}
        {!isQuote && methods && methods.length > 0 && (
          <div className="mb-10 rounded-lg border border-slate-100 bg-slate-50 p-6 print:bg-white print:border-slate-200">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Payment Instructions</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {methods.map((method) => (
                <div key={method.id}>
                  <p className="font-bold text-ink">{method.label}</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-6">{method.instructions}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isQuote && (!methods || methods.length === 0) && (
          <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 p-5 print:bg-white">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800">No payment methods active</h3>
            <p className="mt-1 text-sm text-amber-800">This printable invoice does not include payment instructions yet.</p>
          </div>
        )}

        {/* Footer / Payment Link */}
        <div className="border-t border-slate-100 pt-8 text-center sm:text-left">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{isQuote ? "Quote Link" : "Payment Link"}</h3>
          <p className="text-sm text-cedar break-all font-medium">{paymentLink}</p>
          <p className="mt-4 text-xs text-slate-400 italic">
            {isQuote ? "This quote is not a payment request yet." : "Thank you for your business."}
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .panel { border: none !important; box-shadow: none !important; padding: 0 !important; }
          @page { margin: 1.5cm; }
        }
      `}} />
    </div>
  );
}
