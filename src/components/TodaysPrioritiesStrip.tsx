"use client";

import Link from "next/link";
import { ArrowRight, Banknote, Building2, ClipboardList, Users } from "lucide-react";
import type { TodaysPriority } from "@/lib/todays-priorities";
import type { OpsAlert } from "@/lib/operations-center";
import { SeverityBadge } from "@/components/SeverityBadge";
import { cn } from "@/lib/utils";

function BucketIcon({ bucket }: { bucket: OpsAlert["bucket"] }) {
  switch (bucket) {
    case "payments":
      return <Banknote className="h-4 w-4 shrink-0 opacity-80" aria-hidden />;
    case "clients":
      return <Users className="h-4 w-4 shrink-0 opacity-80" aria-hidden />;
    case "proofs":
      return <ClipboardList className="h-4 w-4 shrink-0 opacity-80" aria-hidden />;
    default:
      return <Building2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />;
  }
}

function cardTone(sev: TodaysPriority["severity"]) {
  switch (sev) {
    case "critical":
      return "border-red-200/90 bg-gradient-to-br from-red-50/95 to-white shadow-red-100/40";
    case "urgent":
      return "border-amber-200/90 bg-gradient-to-br from-amber-50/90 to-white shadow-amber-100/35";
    case "warning":
      return "border-sky-200/90 bg-gradient-to-br from-sky-50/70 to-white shadow-sky-100/30";
    case "healthy":
      return "border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white shadow-emerald-100/25";
    default:
      return "border-slate-200/90 bg-gradient-to-br from-slate-50/80 to-white shadow-slate-100/30";
  }
}

export function TodaysPrioritiesStrip({ items }: { items: TodaysPriority[] }) {
  if (!items.length) {
    return (
      <section className="mb-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800">Today&apos;s priorities</p>
            <p className="mt-1 text-sm font-semibold text-emerald-950">Workspace looks clear for urgent actions.</p>
            <p className="mt-1 text-xs text-emerald-900/80">Keep invoicing — new signals appear here when proofs, links, or balances need you.</p>
          </div>
          <Link href="/invoices/new" className="btn btn-primary touch-manipulation text-xs">
            New invoice
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="q-section-label text-cedar">Mission control</p>
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Today&apos;s priorities</h2>
          <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">Top actions from your real queue — sorted by severity.</p>
        </div>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-5 sm:snap-none">
        {items.map((p) => (
          <article
            key={p.id}
            className={cn(
              "q-surface-hover flex min-h-[148px] w-[min(100%,280px)] shrink-0 snap-start flex-col rounded-2xl border p-4 shadow-card sm:min-h-0 sm:w-auto",
              cardTone(p.severity)
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <BucketIcon bucket={p.bucket} />
                <SeverityBadge severity={p.severity} />
              </div>
            </div>
            <h3 className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-ink">{p.title}</h3>
            <p className="mt-1 line-clamp-3 flex-1 text-[11px] leading-relaxed text-slate-700">{p.explanation}</p>
            <Link
              href={p.href}
              className="mt-3 inline-flex touch-manipulation items-center gap-1 self-start rounded-lg bg-ink/90 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-ink"
            >
              {p.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
