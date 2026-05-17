import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ClientsContactsTable, type ClientContactsTableItem } from "@/components/ClientsContactsTable";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { isQuoteDocument } from "@/lib/documents";
import { getClientHealth, type ClientHealth } from "@/lib/operations";
import { getDisplayInvoiceStatus, getRemainingBalance } from "@/lib/status";
import { requireUser } from "@/lib/supabase/server";

type ClientBalanceTotals = {
  billed: number;
  paid: number;
  balance: number;
  overpaid: number;
};

function toClientListItem(client: any): ClientContactsTableItem {
  const invoices = client.invoices || [];
  const billableInvoices = invoices.filter((inv: any) => !isQuoteDocument(inv));
  const invoiceSummary = { paid: 0, partial: 0, unpaid: 0 };

  const totalsByCurrency = billableInvoices.reduce((acc: Record<string, ClientBalanceTotals>, inv: any) => {
    const displayStatus = getDisplayInvoiceStatus(inv);
    const balance = getRemainingBalance(inv, inv.payment_proofs || []);
    const curr = balance.primaryCurrency;

    if (displayStatus === "paid") {
      invoiceSummary.paid += 1;
    } else if (displayStatus === "partial") {
      invoiceSummary.partial += 1;
    } else if (["draft", "sent", "unpaid", "overdue"].includes(displayStatus)) {
      invoiceSummary.unpaid += 1;
    }

    if (!acc[curr]) {
      acc[curr] = { billed: 0, paid: 0, balance: 0, overpaid: 0 };
    }

    acc[curr].billed += Number(inv[`amount_${curr.toLowerCase()}` as keyof typeof inv] || 0);
    acc[curr].paid += balance.primaryTotalPaid;
    acc[curr].balance += balance.primaryBalance;
    acc[curr].overpaid += balance.primaryOverpaid;

    return acc;
  }, {});

  const balances = Object.keys(totalsByCurrency)
    .sort()
    .map((currency) => ({
      currency: currency as "USD" | "LBP",
      ...totalsByCurrency[currency]
    }));

  let hasOverdueInvoice = false;
  let hasOpenBalance = false;
  for (const inv of billableInvoices) {
    const ds = getDisplayInvoiceStatus(inv);
    if (ds === "overdue") hasOverdueInvoice = true;
    if (["sent", "unpaid", "partial", "overdue"].includes(ds)) hasOpenBalance = true;
  }
  const health: ClientHealth = getClientHealth({ hasOverdueInvoice, hasOpenBalance });

  return {
    id: client.id,
    name: client.name || "Unnamed client",
    email: client.email || null,
    phone: client.phone || null,
    notes: client.notes || null,
    created_at: client.created_at || null,
    invoiceCount: billableInvoices.length,
    invoiceSummary,
    balances,
    health
  };
}

export default async function ClientsPage() {
  const { supabase, user } = await requireUser();
  const { data: clients } = await supabase
    .from("clients")
    .select("*, invoices(*, payment_proofs(status, amount_usd, amount_lbp))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const clientRows = (clients || []).map(toClientListItem);
  const missingPhoneCount = clientRows.filter((client) => !client.phone).length;
  const missingEmailCount = clientRows.filter((client) => !client.email).length;
  const balanceDueCount = clientRows.filter((client) => client.balances.some((balance) => balance.balance > 0)).length;

  return (
    <AppShell>
      <SettingsPageHeader
        title="Clients"
        subtitle="View client balances and payment history."
        action={
          <Link className="btn btn-primary w-full sm:w-auto" href="/clients/new">
            New client
          </Link>
        }
      />

      <div className="mb-6 rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Client data readiness</p>
            <p className="mt-1.5 text-sm text-slate-600">Contact gaps and balance attention are flagged before follow-up.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={missingPhoneCount > 0 ? "warning" : "complete"} label={missingPhoneCount > 0 ? `${missingPhoneCount} missing phone` : "Phones complete"} />
            <StatusBadge status={missingEmailCount > 0 ? "warning" : "complete"} label={missingEmailCount > 0 ? `${missingEmailCount} missing email` : "Emails complete"} />
            <StatusBadge status={balanceDueCount > 0 ? "warning" : "complete"} label={balanceDueCount > 0 ? `${balanceDueCount} balance attention` : "No open balances"} />
          </div>
        </div>
      </div>

      <ClientsContactsTable clients={clientRows} />
    </AppShell>
  );
}
