import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { NewInvoiceCreatorForm } from "@/components/NewInvoiceCreatorForm";
import { StatusBadge } from "@/components/StatusBadge";
import { requireUser } from "@/lib/supabase/server";

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
      <div className="mb-6 rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-card backdrop-blur">
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

      <NewInvoiceCreatorForm clients={clients || []} prefilledClientId={prefilledClientId} presets={presets || []} />
    </AppShell>
  );
}
