import Link from "next/link";
import { createInvoiceAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { InvoiceDepositFields } from "@/components/InvoiceDepositFields";
import { ServicePresetSelector } from "@/components/ServicePresetSelector";
import { StatusBadge } from "@/components/StatusBadge";
import { requireUser } from "@/lib/supabase/server";
import { invoiceStatuses } from "@/lib/types";

export default async function NewInvoicePage({
  searchParams
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { client_id: prefilledClientId } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: clients }, { data: methods }, { data: presets }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),
    supabase.from("payment_methods").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
    supabase.from("service_presets").select("*").eq("user_id", user.id).order("name", { ascending: true })
  ]);

  const hasPaymentMethods = (methods || []).length > 0;
  const hasClients = (clients || []).length > 0;

  return (
    <AppShell>
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <Link className="text-sm font-semibold text-cedar" href="/invoices">
          Back to invoices
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">New invoice or quote</h1>
            <p className="mt-1 text-sm text-slate-600">Create a client-facing document with payment, approval, and deposit controls.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status={hasPaymentMethods ? "active" : "warning"} label={hasPaymentMethods ? "Payment methods active" : "No payment methods active"} />
              <StatusBadge status={hasClients ? "active" : "warning"} label={hasClients ? "Clients available" : "No clients yet"} />
              <StatusBadge status="draft" label="Starts as draft" />
            </div>
          </div>
          <Link className="btn btn-secondary text-xs" href="/clients/new">
            Add new client
          </Link>
        </div>
      </div>

      {!hasPaymentMethods && (
        <div className="mb-6 max-w-3xl rounded-md border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-800">No payment methods yet</h2>
          <p className="mt-1 text-sm text-amber-700">
            You can create an invoice now, but clients will not see payment instructions until you add payment methods.{" "}
            <Link className="font-semibold underline" href="/settings/payment-methods">
              Add payment methods
            </Link>
          </p>
        </div>
      )}

      <form action={createInvoiceAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="panel">
            <h2 className="mb-4 text-lg font-bold text-ink">Document basics</h2>
            <div className="grid gap-4">
              <ServicePresetSelector presets={presets || []} />

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <label className="label font-bold text-ink" htmlFor="client_id">
                  Select Client
                </label>
                <select className="field mt-1" defaultValue={prefilledClientId || ""} id="client_id" name="client_id">
                  <option value="">No client (not recommended)</option>
                  {(clients || []).map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-600">
                  You can create an invoice without a client, but WhatsApp reminders and client tracking will be limited.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="document_type">
              Document type
            </label>
            <select className="field" defaultValue="invoice" id="document_type" name="document_type">
              <option value="invoice">Invoice</option>
              <option value="quote">Quote</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="invoice_number">
              Document number
            </label>
            <input className="field" id="invoice_number" name="invoice_number" placeholder="Auto-generated if blank" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="title">
            Title
          </label>
          <input className="field" id="title" name="title" required />
        </div>
        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea className="field min-h-24" id="description" name="description" />
        </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="mb-4 text-lg font-bold text-ink">Amounts and payment terms</h2>
            <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="label" htmlFor="amount_usd">
              Amount USD
            </label>
            <input className="field" id="amount_usd" min="0" name="amount_usd" step="0.01" type="number" />
          </div>
          <div>
            <label className="label" htmlFor="amount_lbp">
              Amount LBP
            </label>
            <input className="field" id="amount_lbp" min="0" name="amount_lbp" step="1" type="number" />
          </div>
          <div>
            <label className="label" htmlFor="currency">
              Currency
            </label>
            <select className="field" id="currency" name="currency">
              <option value="USD">USD</option>
              <option value="LBP">LBP</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="due_date">
              Due date
            </label>
            <input className="field" id="due_date" name="due_date" type="date" />
          </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="mb-4 text-lg font-bold text-ink">Status and client access</h2>
            <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select className="field" defaultValue="draft" id="status" name="status">
            {invoiceStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="require_approval">
            Require client approval before payment?
          </label>
          <select className="field" id="require_approval" name="require_approval">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
            </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="valid_until">
              Valid until (optional)
            </label>
            <input className="field" id="valid_until" name="valid_until" type="datetime-local" />
          </div>
          <div>
            <label className="label" htmlFor="exchange_rate_lbp_per_usd">
              Exchange rate LBP per USD
            </label>
            <input className="field" id="exchange_rate_lbp_per_usd" min="0" name="exchange_rate_lbp_per_usd" step="1" type="number" placeholder="e.g. 89500" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="rate_note">
            Rate note (optional)
          </label>
          <textarea 
            className="field min-h-20" 
            id="rate_note" 
            name="rate_note" 
            placeholder="LBP amount is based on today's market rate and may change after expiry."
          />
        </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="panel xl:sticky xl:top-6">
            <h2 className="mb-4 text-lg font-bold text-ink">Deposit request</h2>
            <InvoiceDepositFields />
            <div className="mt-5 border-t border-slate-200 pt-4">
              <button className="btn btn-primary w-full" type="submit">
                Create document
              </button>
            </div>
          </section>
        </aside>
      </form>
    </AppShell>
  );
}
