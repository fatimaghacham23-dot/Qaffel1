import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ClientsContactsTable, type ClientContactsTableItem } from "@/components/ClientsContactsTable";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { deriveClientTotals } from "@/lib/client-totals";
import type { WorkspaceInvoiceFact } from "@/lib/canonical-invoices";
import { requireUser } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/get-workspace";

type ClientRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

function toClientListItem(client: ClientRow, invoices: WorkspaceInvoiceFact[], workspaceId: string): ClientContactsTableItem {
  const totals = deriveClientTotals({ workspaceId, clientId: client.id, invoices });
  return {
    id: client.id,
    name: client.name || "Unnamed client",
    email: client.email || null,
    phone: client.phone || null,
    notes: client.notes || null,
    created_at: client.created_at || null,
    ...totals
  };
}

export default async function ClientsPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  const [{ data: clients }, { data: invoices }] = await Promise.all([
    supabase.from("clients").select("id,name,email,phone,notes,created_at").eq("workspace_id", ctx.workspaceId).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id,workspace_id,client_id,status,document_type,currency,amount_usd,amount_lbp,due_date,created_at,payment_proofs(status,amount_usd,amount_lbp,voided_at),clients(workspace_id)").eq("workspace_id", ctx.workspaceId)
  ]);

  const clientRows = (clients || []).map((client) => toClientListItem(client, invoices || [], ctx.workspaceId));
  const missingPhoneCount = clientRows.filter((client) => !client.phone).length;
  const missingEmailCount = clientRows.filter((client) => !client.email).length;
  const balanceDueCount = clientRows.filter((client) => client.balances.some((balance) => balance.balance > 0)).length;

  return (
    <AppShell>
      <PageContainer width="wide">
        <PageHeader title="Clients" description="View client balances and payment history." actions={<Link className="btn btn-primary w-full sm:w-auto" href="/clients/new">New client</Link>} />
        <div className="mb-6 rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="text-sm font-semibold text-ink">Client data readiness</p><p className="mt-1.5 text-sm text-slate-600">Contact gaps and balance attention are flagged before follow-up.</p></div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={missingPhoneCount > 0 ? "warning" : "complete"} label={missingPhoneCount > 0 ? `${missingPhoneCount} missing phone` : "Phones complete"} />
              <StatusBadge status={missingEmailCount > 0 ? "warning" : "complete"} label={missingEmailCount > 0 ? `${missingEmailCount} missing email` : "Emails complete"} />
              <StatusBadge status={balanceDueCount > 0 ? "warning" : "complete"} label={balanceDueCount > 0 ? `${balanceDueCount} balance attention` : "No open balances"} />
            </div>
          </div>
        </div>
        <ClientsContactsTable clients={clientRows} />
      </PageContainer>
    </AppShell>
  );
}
