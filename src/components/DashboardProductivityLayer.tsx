import Link from "next/link";
import {
  CircleDollarSign,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  Gauge,
  ReceiptText,
  Settings,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { QuickActionGrid, type ProductivityAction } from "@/components/ProductivityQuickActions";
import type { TodaysPriority } from "@/lib/todays-priorities";

type DashboardProductivityLayerProps = {
  priorities: TodaysPriority[];
  pendingProofs: number;
  recoveryCount: number;
  overdueCount: number;
  hasPaymentMethods: boolean;
  lastPaymentInvoiceId?: string | null;
};

export function DashboardProductivityLayer({
  priorities,
  pendingProofs,
  recoveryCount,
  overdueCount,
  hasPaymentMethods,
  lastPaymentInvoiceId
}: DashboardProductivityLayerProps) {
  const primaryPriority = priorities[0];
  const quickActions: ProductivityAction[] = [
    {
      label: "New invoice",
      description: "Create and send faster",
      href: "/invoices/new",
      icon: FilePlus2,
      shortcut: "C"
    },
    {
      label: "Review proofs",
      description: "Manual payment queue",
      href: "/proofs",
      icon: FileCheck2,
      badge: pendingProofs > 0 ? pendingProofs : null,
      tone: pendingProofs > 0 ? "attention" : "default",
      shortcut: "G P"
    },
    {
      label: "Recover overdue",
      description: "Reminder and follow-up flow",
      href: "/recoveries",
      icon: CircleDollarSign,
      badge: overdueCount > 0 ? overdueCount : null,
      tone: recoveryCount > 0 ? "attention" : "default",
      shortcut: "G R"
    },
    {
      label: "Clients",
      description: "Contacts and balances",
      href: "/clients",
      icon: Users
    },
    {
      label: "Reports",
      description: "Revenue and outstanding",
      href: "/reports",
      icon: FileSpreadsheet
    },
    {
      label: hasPaymentMethods ? "Payment methods" : "Set methods",
      description: hasPaymentMethods ? "Whish, OMT, bank" : "Prepare public payment pages",
      href: "/settings/payment-methods",
      icon: Settings,
      tone: hasPaymentMethods ? "default" : "attention"
    }
  ];

  const continueLinks = [
    primaryPriority
      ? {
          label: primaryPriority.title,
          href: primaryPriority.href,
          eyebrow: "Next priority",
          icon: Gauge
        }
      : null,
    lastPaymentInvoiceId
      ? {
          label: "Open latest paid invoice",
          href: `/invoices/${lastPaymentInvoiceId}`,
          eyebrow: "Recent activity",
          icon: ReceiptText
        }
      : null,
    recoveryCount > 0
      ? {
          label: `${recoveryCount} recovery file${recoveryCount === 1 ? "" : "s"} need attention`,
          href: "/recoveries",
          eyebrow: "Collection momentum",
          icon: CircleDollarSign
        }
      : null
  ].filter((item): item is { label: string; href: string; eyebrow: string; icon: LucideIcon } => Boolean(item));

  return (
    <section id="productivity-layer" className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <QuickActionGrid
        title="Pinned actions"
        subtitle="Keyboard-friendly operations for the work you repeat most."
        actions={quickActions}
        compact
      />

      <aside className="q-panel p-4 sm:p-5">
        <div className="mb-4">
          <p className="q-section-label text-cedar">Continue</p>
          <h2 className="mt-1 text-base font-bold text-ink">Where you left off</h2>
        </div>
        {continueLinks.length > 0 ? (
          <div className="grid gap-2">
            {continueLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={`${item.eyebrow}-${item.href}`}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-ink transition duration-q ease-q hover:-translate-y-0.5 hover:border-cedar/20 hover:bg-cedar/[0.035] hover:text-cedar hover:shadow-soft"
                  href={item.href}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm group-hover:text-cedar">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">{item.eyebrow}</span>
                    <span className="mt-0.5 block truncate text-sm font-bold">{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-ink">No urgent queue right now.</p>
            <p className="mt-1 text-sm text-slate-500">Create an invoice, review proofs, or open reports from the pinned actions.</p>
          </div>
        )}
      </aside>
    </section>
  );
}
