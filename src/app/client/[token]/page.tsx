import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ExternalLink, FileText } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { documentNounTitle, documentStatus, isQuoteDocument } from "@/lib/documents";
import { money, shortDate, formatPaymentMethod } from "@/lib/format";
import { getDisplayInvoiceStatus, getRemainingBalance } from "@/lib/status";
import { isPortalDocumentsEmpty } from "@/lib/portal-documents";
import { createClient } from "@/lib/supabase/server";

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

export default async function ClientPortalPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  await supabase.rpc("record_client_portal_view", { p_token: token });

  const [{ data: header }, { data: invoices }, { data: payments }, { data: activity }] = await Promise.all([
    supabase.rpc("get_public_client_portal_header", { p_token: token }),
    supabase.rpc("get_public_client_portal_invoices", { p_token: token }),
    supabase.rpc("get_public_client_portal_payments", { p_token: token }),
    supabase.rpc("get_public_client_portal_activity", { p_token: token })
  ]);

  const portalHeader = header && Array.isArray(header) ? header[0] : header;

  if (!portalHeader?.client_name) {
    return notFound();
  }

  const safeDocuments = (invoices || []).map((inv: any) => {
    const isQuote = isQuoteDocument(inv);
    const balance = getRemainingBalance(
      {
        amount_usd: inv.amount_usd,
        amount_lbp: inv.amount_lbp,
        status: inv.status,
        currency: inv.currency
      },
      [
        {
          status: "accepted",
          amount_usd: inv.paid_usd,
          amount_lbp: inv.paid_lbp
        }
      ]
    );

    return {
      ...inv,
      displayStatus: isQuote ? documentStatus(inv) : getDisplayInvoiceStatus({ status: inv.status, due_date: inv.due_date }),
      balance
    };
  });

  const safeInvoices = safeDocuments.filter((i: any) => !isQuoteDocument(i));
  const safeQuotes = safeDocuments.filter((i: any) => isQuoteDocument(i));
  const overdue = safeInvoices.filter((i: any) => i.displayStatus === "overdue");
  const open = safeInvoices.filter((i: any) => i.displayStatus !== "paid");
  const paid = safeInvoices.filter((i: any) => i.displayStatus === "paid");
  const partial = safeInvoices.filter((i: any) => i.displayStatus === "partial");

  const totals = safeInvoices.reduce(
    (acc: any, inv: any) => {
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
    overdue.length > 0 ? { tone: "danger" as const, label: "Overdue invoice" } : null,
    partial.length > 0 ? { tone: "info" as const, label: "Partial payment" } : null,
    paid.length > 0 && open.length === 0 ? { tone: "good" as const, label: "Fully paid" } : null,
    payments && payments.length > 0 ? { tone: "good" as const, label: "Accepted payments" } : { tone: "warn" as const, label: "No accepted payments" },
    { tone: "good" as const, label: "Portal link active" }
  ].filter(Boolean) as Array<{ tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }>;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft lg:p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-cedar">
          {portalHeader.business_name || portalHeader.full_name || "Qaffel"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal text-ink">{portalHeader.client_name}</h1>
        <p className="mt-1 text-sm text-slate-600">Client Portal - Statement & Activity</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {portalFlags.map((flag) => (
            <PortalFlag key={flag.label} tone={flag.tone} label={flag.label} />
          ))}
        </div>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className={`panel ${totals.outUsd > 0 || totals.outLbp > 0 ? "bg-amber-50 border-amber-100" : "bg-slate-50"}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Total outstanding</p>
          <p className="mt-1 text-lg font-bold text-ink">
            {totals.outUsd > 0 ? money(totals.outUsd, "USD") : null}
            {totals.outUsd > 0 && totals.outLbp > 0 ? " + " : null}
            {totals.outLbp > 0 ? money(totals.outLbp, "LBP") : null}
            {totals.outUsd === 0 && totals.outLbp === 0 ? "No outstanding invoices" : null}
          </p>
        </div>
        <div className="panel bg-emerald-50 border-emerald-100">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Total paid</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">
            {totals.paidUsd > 0 ? money(totals.paidUsd, "USD") : null}
            {totals.paidUsd > 0 && totals.paidLbp > 0 ? " + " : null}
            {totals.paidLbp > 0 ? money(totals.paidLbp, "LBP") : null}
            {totals.paidUsd === 0 && totals.paidLbp === 0 ? "No accepted payments" : null}
          </p>
        </div>
        <div className={`panel ${overdue.length > 0 ? "bg-red-50 border-red-100" : "bg-slate-50"}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Overdue invoices</p>
          <p className={`mt-1 text-lg font-bold ${overdue.length > 0 ? "text-red-700" : "text-ink"}`}>
            {overdue.length}
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          {overdue.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-soft">
              <p className="text-sm font-semibold text-red-900">Overdue invoices</p>
              <p className="mt-1 text-sm text-red-800">These invoices are pinned for quick action.</p>
            </div>
          )}

          <div className="space-y-4">
            {[...safeQuotes, ...(overdue.length > 0 ? [...overdue, ...open.filter((i: any) => i.displayStatus !== "overdue"), ...paid] : [...open, ...paid])].map((inv: any) => {
              const invIsQuote = isQuoteDocument(inv);
              const nounTitle = documentNounTitle(inv);
              const currency = (inv.currency || "USD").toUpperCase();
              const primaryAmount = currency === "USD" ? Number(inv.amount_usd || 0) : Number(inv.amount_lbp || 0);
              const primaryPaid = invIsQuote ? 0 : (currency === "USD" ? Number(inv.paid_usd || 0) : Number(inv.paid_lbp || 0));
              const primaryRemaining = invIsQuote ? 0 : (currency === "USD" ? Number(inv.balance.usd || 0) : Number(inv.balance.lbp || 0));

              const amount = money(primaryAmount, currency as "USD" | "LBP");
              const paidAmount = money(primaryPaid, currency as "USD" | "LBP");
              const remaining = money(primaryRemaining, currency as "USD" | "LBP");

              return (
                <div key={inv.public_token} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{nounTitle}</p>
                      <p className="mt-1 font-bold text-ink truncate">
                        {inv.invoice_number ? `#${inv.invoice_number} - ` : ""}
                        {inv.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {invIsQuote ? "Valid until" : "Due"} {inv.due_date ? shortDate(inv.due_date) : "-"}
                      </p>
                    </div>
                    <StatusBadge status={inv.displayStatus} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</p>
                      <p className="mt-1 text-sm font-bold text-ink">{amount}</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Paid</p>
                      <p className="mt-1 text-sm font-bold text-emerald-700">{invIsQuote ? "Not invoiced" : paidAmount}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${primaryRemaining > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Remaining</p>
                      <p className={`mt-1 text-sm font-bold ${primaryRemaining > 0 ? "text-amber-700" : "text-slate-700"}`}>
                        {invIsQuote ? "Quote only" : primaryRemaining > 0 ? remaining : "Paid"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link className="btn btn-secondary text-xs" href={`/pay/${inv.public_token}`} target="_blank">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Open {nounTitle.toLowerCase()}
                    </Link>
                  </div>
                </div>
              );
            })}

            {isPortalDocumentsEmpty(safeDocuments) && (
              <div className="panel bg-slate-50">
                <p className="text-sm font-semibold text-ink">No invoices or quotes yet</p>
                <p className="mt-1 text-sm text-slate-600">This portal will show documents and payments once issued.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="panel">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <FileText className="h-5 w-5 text-cedar" aria-hidden="true" />
              Payment history
            </h2>
            <p className="mt-1 text-sm text-slate-600">Accepted payments recorded by the business.</p>

            <div className="mt-4 grid gap-3">
              {(!payments || payments.length === 0) && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-ink">No accepted payments yet</p>
                  <p className="mt-1 text-sm text-slate-600">If you already paid, contact the business.</p>
                </div>
              )}

              {(payments || []).slice(0, 12).map((p: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-slate-100 p-4">
                  <p className="text-sm font-bold text-ink">
                    {p.amount_usd ? money(p.amount_usd, "USD") : ""}
                    {p.amount_usd && p.amount_lbp ? " + " : ""}
                    {p.amount_lbp ? money(p.amount_lbp, "LBP") : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.payment_date ? shortDate(p.payment_date) : shortDate(p.uploaded_at)}
                    {p.method ? ` - ${formatPaymentMethod(p.method)}` : ""}
                  </p>
                  {(p.invoice_number || p.invoice_title) && (
                    <p className="mt-1 text-xs text-slate-600">
                      {p.invoice_number ? `#${p.invoice_number}` : ""}
                      {p.invoice_number && p.invoice_title ? " - " : ""}
                      {p.invoice_title || ""}
                    </p>
                  )}
                  {p.receipt_token && (
                    <Link 
                      className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-cedar underline" 
                      href={`/receipt/${p.receipt_token}`} 
                      target="_blank"
                    >
                      View Receipt
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Activity className="h-5 w-5 text-cedar" aria-hidden="true" />
              Recent activity
            </h2>
            <p className="mt-1 text-sm text-slate-600">Latest updates on invoices and payments.</p>

            <div className="mt-4 space-y-3">
              {(!activity || activity.length === 0) && (
                <p className="text-sm text-slate-500 italic">No recent activity yet.</p>
              )}

              {(activity || []).map((e: any, idx: number) => (
                <div key={idx} className="flex gap-3">
                  <div className="mt-2 h-2 w-2 flex-none rounded-full bg-slate-200" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{e.message}</p>
                    <p className="text-[10px] text-slate-500">
                      {shortDate(e.created_at)}
                      {e.invoice_number ? ` - #${e.invoice_number}` : ""}
                    </p>
                    {e.invoice_public_token ? (
                      <Link className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider text-cedar underline" href={`/pay/${e.invoice_public_token}`} target="_blank">
                        Open invoice
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-700">Portal link</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700">Portal link active</p>
            <p className="mt-1 text-xs text-slate-600">Use this page to review invoices, quotes, payment history, and receipt links.</p>
            <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-600">
              This portal is client-specific — it only reflects documents and payments your freelancer or agency issued to you. Receipt PDFs are
              computer-generated; if a receipt was voided in Qaffel, its link shows as invalid and must not be used as settlement proof.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
