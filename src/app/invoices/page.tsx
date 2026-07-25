import Link from "next/link";
import { AlertTriangle, CircleCheck, Clock3, ReceiptText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { InteractiveInvoicesTable, type InvoiceTableInvoice } from "@/components/InteractiveInvoicesTable";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { StatisticsCard } from "@/components/statistics-card-2";
import { StatusBadge } from "@/components/StatusBadge";
import { getAssignmentMembers, getAssignmentsForTargets } from "@/lib/assignment-data";
import { documentStatus, isQuoteDocument } from "@/lib/documents";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { getDisplayInvoiceStatus } from "@/lib/status";
import { requireUser } from "@/lib/supabase/server";
import { invoiceStatuses } from "@/lib/types";

export default async function InvoicesPage() {
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();
  const [{ data: invoices }, { data: activeMethods }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, clients(name), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at)")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false }),
    supabase.from("payment_methods").select("id").eq("workspace_id", ctx.workspaceId).eq("is_active", true).limit(1)
  ]);

  const assignmentMembers = await getAssignmentMembers(supabase, ctx.workspaceId);
  const assignmentsByInvoice = await getAssignmentsForTargets({
    supabase,
    workspaceId: ctx.workspaceId,
    targetType: "invoice",
    targetIds: (invoices || []).map((invoice) => invoice.id),
    members: assignmentMembers
  });
  const safeInvoices = (invoices || []).map((invoice) => ({
    ...invoice,
    assignments: assignmentsByInvoice.get(invoice.id) || []
  })) as InvoiceTableInvoice[];
  const summary = safeInvoices.reduce(
    (totals, invoice) => {
      const isQuote = isQuoteDocument(invoice);
      const displayStatus = isQuote ? documentStatus(invoice) : getDisplayInvoiceStatus(invoice);

      totals.total += 1;
      if (isQuote) {
        totals.quotes += 1;
        return totals;
      }

      if (["sent", "unpaid", "partial", "overdue"].includes(displayStatus)) {
        totals.outstanding += 1;
      }

      if (displayStatus === "overdue") {
        totals.overdue += 1;
      }

      if (displayStatus === "paid") {
        totals.paid += 1;
      }

      return totals;
    },
    { total: 0, outstanding: 0, overdue: 0, paid: 0, quotes: 0 }
  );

  return (
    <AppShell role={ctx.role}>
      <SettingsPageHeader
        title="Invoices"
        subtitle="Manage invoices, quotes, payment status, and client links."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <Link className="btn btn-secondary w-full text-xs sm:w-auto" href="/recoveries">
              Recovery center
            </Link>
            <Link className="btn btn-primary w-full sm:w-auto" href="/invoices/new">
              New document
            </Link>
          </div>
        }
      />

      <div className="mb-6 rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Document readiness</p>
            <p className="mt-1.5 text-sm text-slate-600">Payment methods, overdue status, drafts, quotes, and public links are surfaced before clients see them.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={(activeMethods || []).length > 0 ? "active" : "warning"} label={(activeMethods || []).length > 0 ? "Payment methods active" : "No payment methods active"} />
            <StatusBadge status={summary.overdue > 0 ? "overdue" : "complete"} label={summary.overdue > 0 ? "Overdue invoice" : "No overdue invoices"} />
            <StatusBadge status={summary.quotes > 0 ? "quote" : "neutral"} label={`${summary.quotes} quote${summary.quotes === 1 ? "" : "s"}`} />
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatisticsCard
          title="Total invoices"
          value={(summary.total - summary.quotes).toLocaleString()}
          helperText={`${summary.quotes.toLocaleString()} quote${summary.quotes === 1 ? "" : "s"} separate`}
          icon={ReceiptText}
          tone="cedar"
        />
        <StatisticsCard
          title="Unpaid / outstanding"
          value={summary.outstanding.toLocaleString()}
          helperText="Sent, unpaid, partial, overdue"
          icon={Clock3}
          tone="amber"
        />
        <StatisticsCard
          title="Overdue"
          value={summary.overdue.toLocaleString()}
          helperText="Past due date"
          icon={AlertTriangle}
          tone="tomato"
        />
        <StatisticsCard
          title="Paid"
          value={summary.paid.toLocaleString()}
          helperText="Marked paid"
          icon={CircleCheck}
          tone="emerald"
        />
      </div>

      <InteractiveInvoicesTable initialInvoices={safeInvoices} invoiceStatuses={invoiceStatuses} />
    </AppShell>
  );
}
