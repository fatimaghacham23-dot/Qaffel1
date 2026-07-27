import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { NewInvoiceCreatorForm } from "@/components/NewInvoiceCreatorForm";
import { StatusBadge } from "@/components/StatusBadge";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { requireUser } from "@/lib/supabase/server";

export default async function NewInvoicePage({
  searchParams
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { client_id: prefilledClientId } = await searchParams;
  const { supabase, user } = await requireUser();
  const [{ data: clients }, { data: methods }, { data: presets }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("user_id", user.id).order("name", { ascending: true }),
    supabase.from("payment_methods").select("id").eq("user_id", user.id).eq("is_active", true).limit(1),
    supabase.from("service_presets").select("*").eq("user_id", user.id).order("name", { ascending: true })
  ]);
  const hasPaymentMethods = (methods || []).length > 0;
  const hasClients = (clients || []).length > 0;

  return <AppShell><PageContainer width="default"><PageHeader backHref="/invoices" title="New invoice or quote" description="Create a client-facing document with payment, approval, and deposit controls." badge={<div className="flex flex-wrap gap-2"><StatusBadge status={hasPaymentMethods ? "active" : "warning"} label={hasPaymentMethods ? "Payment methods active" : "No payment methods active"} /><StatusBadge status={hasClients ? "active" : "warning"} label={hasClients ? "Clients available" : "No clients yet"} /><StatusBadge status="draft" label="Starts as draft" /></div>} actions={<Link className="btn btn-secondary text-xs" href="/clients/new">Add new client</Link>} />
    {!hasPaymentMethods ? <SectionCard className="mb-6 max-w-3xl border-amber-200 bg-amber-50" density="compact"><h2 className="text-sm font-bold text-amber-800">No payment methods yet</h2><p className="mt-1 text-sm text-amber-700">You can create an invoice now, but clients will not see payment instructions until you add payment methods. <Link className="font-semibold underline" href="/settings/payment-methods">Add payment methods</Link></p></SectionCard> : null}
    <NewInvoiceCreatorForm clients={clients || []} prefilledClientId={prefilledClientId} presets={presets || []} />
  </PageContainer></AppShell>;
}