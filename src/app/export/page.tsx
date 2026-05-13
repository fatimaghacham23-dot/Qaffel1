import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { ExportCard } from "@/components/ExportCard";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { PremiumStatCard } from "@/components/PremiumStatCard";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { shortDate } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";

function csvDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export default async function ExportPage() {
  const { supabase, user } = await requireUser();
  const [{ data: invoices }, { data: clients }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, clients(name), payment_proofs(status)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_proofs")
      .select("status, amount_usd, amount_lbp, payment_date, uploaded_at, confirmed_at, voided_at, void_reason, method, note, invoice_id, invoices!inner(user_id, invoice_number)")
      .eq("invoices.user_id", user.id)
      .in("status", ["accepted", "voided"])
      .order("uploaded_at", { ascending: false })
  ]);

  const invoiceList = invoices || [];
  const clientList = clients || [];
  const paymentList = payments || [];

  const rows = invoiceList.map((invoice) => ({
    "Document type": invoice.document_type || "invoice",
    "Invoice number": invoice.invoice_number || "",
    "Client name": invoice.clients?.name || "",
    Title: invoice.title || "",
    "Amount USD": invoice.amount_usd || "",
    "Amount LBP": invoice.amount_lbp || "",
    Currency: invoice.currency || "",
    "Deposit enabled": invoice.deposit_enabled ? "yes" : "no",
    "Deposit type": invoice.deposit_type || "",
    "Deposit percent": invoice.deposit_percent || "",
    "Deposit amount USD": invoice.deposit_amount_usd || "",
    "Deposit amount LBP": invoice.deposit_amount_lbp || "",
    "Deposit note": invoice.deposit_note || "",
    Status: invoice.status || "",
    "Due date": csvDate(invoice.due_date),
    "Created date": csvDate(invoice.created_at),
    "Payment proof status": invoice.payment_proofs?.[0]?.status || ""
  }));

  const clientRows = clientList.map((client) => ({
    "Client name": client.name || "",
    Email: client.email || "",
    Phone: client.phone || "",
    Notes: client.notes || "",
    "Created date": csvDate(client.created_at)
  }));

  const paymentRows = paymentList.map((payment: any) => ({
    "Invoice number": payment.invoices?.invoice_number || "",
    Status: payment.status || "",
    "Amount USD": payment.amount_usd || "",
    "Amount LBP": payment.amount_lbp || "",
    Method: payment.method || "",
    Note: payment.note || "",
    "Payment date": csvDate(payment.payment_date),
    "Uploaded at": csvDate(payment.uploaded_at),
    "Confirmed at": csvDate(payment.confirmed_at),
    "Voided at": csvDate(payment.voided_at),
    "Void reason": payment.void_reason || ""
  }));

  return (
    <AppShell>
      <SettingsPageHeader
        title="Export center"
        subtitle="Download accountant-ready invoice records and payment proof status in CSV format."
      />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <PremiumStatCard label="Invoices" value={invoiceList.length.toLocaleString()} detail="Included in the CSV" />
        <PremiumStatCard label="Rows ready" value={rows.length.toLocaleString()} detail="Generated from current records" />
        <PremiumStatCard label="Recommended for accountant" value="Invoices + Payments" detail="Includes invoices, clients, accepted payments, and voided payments" />
      </div>

      <div className="mb-6 grid items-stretch gap-4 lg:grid-cols-3">
        <ExportCard
          title="Invoices CSV"
          description="Includes invoice number, client name, title, amounts, currency, deposit settings, status, due date, created date, and payment proof status."
          meta={`${rows.length.toLocaleString()} invoice rows ready`}
          action={<CsvDownloadButton rows={rows} label="Export invoices CSV" className="btn btn-primary w-full" filename="qaffel-invoices" />}
        />
        <ExportCard
          title="Clients CSV"
          description="Includes client name, email, phone, notes, and created date."
          meta={`${clientRows.length.toLocaleString()} client rows ready`}
          action={<CsvDownloadButton rows={clientRows} label="Export clients CSV" className="btn btn-secondary w-full" filename="qaffel-clients" />}
        />
        <ExportCard
          title="Payments CSV"
          description="Includes accepted payments and voided payments with method, notes, payment dates, and void reasons."
          meta={`${paymentRows.length.toLocaleString()} payment rows ready`}
          action={<CsvDownloadButton rows={paymentRows} label="Export payments CSV" className="btn btn-secondary w-full" filename="qaffel-payments" />}
        />
      </div>

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 shadow-soft">
        <p className="text-sm font-semibold">Accountant note</p>
        <p className="mt-1 text-xs text-amber-900/80">
          Use invoices + payments for reconciliation. Payments export includes accepted and voided records and does not include any file paths or signed URLs.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900 shadow-soft">
        <p className="text-sm font-semibold">Safe export</p>
        <p className="mt-1 text-xs text-sky-900/80">
          CSV downloads are generated in the browser from your current records. Qaffel does not expose proof storage paths or private file URLs in these exports.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-ink">Invoice export preview</h2>
          <p className="mt-1 text-sm text-slate-500">A quick scan of the records that will be downloaded.</p>
        </div>
        {invoiceList.length === 0 ? (
          <div className="p-5">
            <PremiumEmptyState
              title="No invoice rows to preview."
              description="Create invoices or quotes first, then return here to export accountant-ready records."
              example="Exports include statuses and amounts only — payment proof file paths stay private."
              action={
                <Link className="btn btn-primary" href="/invoices/new">
                  Create invoice
                </Link>
              }
            />
          </div>
        ) : (
          <>
        <div className="grid gap-3 p-4 md:hidden">
          {invoiceList.map((invoice) => (
            <div key={invoice.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{invoice.document_type || "invoice"} #{invoice.invoice_number || "-"}</p>
                  <p className="mt-1 break-words text-sm font-bold text-ink">{invoice.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{invoice.clients?.name || "No client"} - due {shortDate(invoice.due_date)}</p>
                </div>
                <StatusBadge status={invoice.status} />
              </div>
              <p className="mt-3 text-xs text-slate-600">Proof status: <span className="font-semibold">{invoice.payment_proofs?.[0]?.status || "-"}</span></p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="px-5 py-3 font-semibold">Invoice number</th>
              <th className="px-5 py-3 font-semibold">Type</th>
              <th className="px-5 py-3 font-semibold">Client name</th>
              <th className="px-5 py-3 font-semibold">Title</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Due date</th>
              <th className="px-5 py-3 font-semibold">Proof</th>
            </tr>
          </thead>
          <tbody>
            {invoiceList.map((invoice) => (
              <tr key={invoice.id} className="border-b border-slate-50 transition hover:bg-slate-50/80">
                <td className="px-5 py-3 font-medium text-ink">{invoice.invoice_number || "-"}</td>
                <td className="px-5 py-3 capitalize">{invoice.document_type || "invoice"}</td>
                <td className="px-5 py-3">{invoice.clients?.name || "-"}</td>
                <td className="px-5 py-3">{invoice.title}</td>
                <td className="px-5 py-3">
                  <StatusBadge status={invoice.status} />
                </td>
                <td className="px-5 py-3">{shortDate(invoice.due_date)}</td>
                <td className="px-5 py-3">{invoice.payment_proofs?.[0]?.status || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
