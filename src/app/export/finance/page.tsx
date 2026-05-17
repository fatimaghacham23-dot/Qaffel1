import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Ban, Calendar, Download, FileSpreadsheet, Receipt, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/lib/supabase/server";

const exportPresets = [
  {
    id: "finance_close_snapshot",
    title: "Monthly finance pack",
    description: "Close summary, unresolved reconciliation rows, open balances, pending proofs, voids, and month-end review state.",
    icon: Calendar,
    fields: "Period, summary totals, review type, invoice number, client, status, amount, explanation, formula"
  },
  {
    id: "payment_audit_history",
    title: "Payment audit history",
    description: "Accepted and voided proof/payment records with reviewer, method, amount, and review timestamps.",
    icon: ShieldCheck,
    fields: "Invoice number, client, proof status, method, amount, uploaded, reviewed, payment date, reviewer"
  },
  {
    id: "void_history",
    title: "Void history",
    description: "Voided payment records with reason, reviewer context, and original proof amounts.",
    icon: Ban,
    fields: "Invoice number, client, original amount, method, voided at, void reason, reviewer note"
  },
  {
    id: "reviewer_activity",
    title: "Reviewer activity",
    description: "Reviewer-level proof activity and review timing derived from deterministic proof timestamps.",
    icon: Receipt,
    fields: "Reviewer, accepted, rejected, voided, average review hours, reviewed proofs"
  },
  {
    id: "operator_accountability",
    title: "Operator accountability",
    description: "Operational finance events grouped by actor, role, invoice number, action, and timestamp.",
    icon: Archive,
    fields: "Operator, role, action, invoice number, message, created at"
  }
];

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function FinanceExportPage() {
  await requireUser();
  const ctx = await getWorkspaceContext();

  if (!hasPermission(ctx.role, "exports.finance")) {
    redirect("/export");
  }

  const month = currentMonth();

  return (
    <AppShell>
      <SettingsPageHeader
        title="Finance exports"
        subtitle="Accountant-ready operational exports with clean labels, manual downloads, and no internal IDs exposed."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/finance" className="btn btn-primary btn-xs">
              Finance close
            </Link>
            <Link href="/export" className="btn btn-secondary btn-xs">
              Export center
            </Link>
          </div>
        }
      />

      <section className="q-elevated mb-6 bg-white/[0.82] p-6 backdrop-blur-md sm:p-7">
        <p className="q-section-label text-cedar">Monthly package</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Finance presets for {month}</h1>
        <p className="q-subtitle mt-2 max-w-3xl">
          These exports are generated from invoices, proofs, approvals, voids, payment plans, and finance timeline events. Qaffel keeps this operational, not a replacement ledger.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {exportPresets.map((preset) => {
          const Icon = preset.icon;
          return (
            <article key={preset.id} className="q-surface-hover flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cedar/10 bg-cedar/[0.06] text-cedar">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink">{preset.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{preset.description}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Columns included</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{preset.fields}</p>
              </div>

              <div className="mt-auto pt-4">
                <Link href={`/reports/csv?preset=${preset.id}&m=${month}`} className="btn btn-secondary btn-xs w-full">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Download CSV
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 h-5 w-5 text-slate-500" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-ink">Need a reviewed close package?</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Use the finance closing workspace to review unresolved items, complete the month-end checklist, and record signoff before downloading the final package.
            </p>
            <Link className="mt-3 inline-flex text-xs font-semibold text-cedar" href="/finance">
              Open finance closing
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

