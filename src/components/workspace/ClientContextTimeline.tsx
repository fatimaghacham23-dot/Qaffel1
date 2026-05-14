import Link from "next/link";
import { shortDate } from "@/lib/format";
import type { ContextBullet, MemoryTimelineItem, RelationshipSignal } from "@/lib/workspace-memory";
import { cn } from "@/lib/utils";

const signalTone: Record<RelationshipSignal["tone"], string> = {
  good: "border-emerald-200/80 bg-emerald-50/70 text-emerald-900",
  warn: "border-amber-200/70 bg-amber-50/60 text-amber-950",
  neutral: "border-slate-200/70 bg-slate-50/80 text-slate-800",
  info: "border-sky-200/70 bg-sky-50/70 text-sky-950"
};

export function ClientContextRelationshipPanel({
  bullets,
  signals
}: {
  bullets: ContextBullet[];
  signals: RelationshipSignal[];
}) {
  if (signals.length === 0 && bullets.length === 0) return null;

  return (
    <section className="q-panel overflow-hidden p-5 sm:p-6">
      <p className="q-section-label text-slate-500">Operational context</p>
      <p className="q-body-muted mt-2 max-w-3xl">
        Derived only from invoices, payments, reminders, and events already in your workspace — not guesses or scores.
      </p>

      {signals.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Relationship signals</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {signals.map((s) => (
              <li
                key={s.id}
                className={cn("max-w-full rounded-2xl border px-3 py-2 text-xs font-medium shadow-sm", signalTone[s.tone])}
                title={s.basis}
              >
                <span className="block truncate">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bullets.length > 0 ? (
        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What the data suggests</p>
          <ul className="mt-3 space-y-3">
            {bullets.map((b) => (
              <li key={b.id} className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
                <p className="text-sm font-medium text-ink">{b.text}</p>
                <p className="q-caption mt-1 text-slate-500">{b.basis}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

const accentRing: Record<string, string> = {
  payment: "border-l-emerald-500",
  reminder: "border-l-sky-500",
  receipt: "border-l-violet-400",
  risk: "border-l-amber-500",
  note: "border-l-cedar",
  neutral: "border-l-slate-300"
};

function TimelineRow({ item }: { item: MemoryTimelineItem }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm sm:px-4 sm:py-3.5",
        "border-l-4",
        accentRing[item.accent] || accentRing.neutral
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{item.title}</p>
        <time className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {shortDate(item.at)}
        </time>
      </div>
      {item.detail ? <p className="q-body-muted mt-2 line-clamp-4 whitespace-pre-wrap">{item.detail}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.invoiceLabel ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {item.invoiceLabel}
          </span>
        ) : null}
        {item.href ? (
          <Link href={item.href} className="text-xs font-semibold text-cedar hover:underline">
            Open
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ClientMemoryTimeline({ groups }: { groups: { day: string; items: MemoryTimelineItem[] }[] }) {
  const trimmed = groups.filter((g) => g.items.length > 0);

  if (trimmed.length === 0) {
    return (
      <section className="q-panel p-5 sm:p-6">
        <p className="q-section-label text-slate-500">Workspace timeline</p>
        <p className="q-body-muted mt-3">No events, plans, or notes yet for this client.</p>
      </section>
    );
  }

  return (
    <section className="q-panel overflow-hidden p-5 sm:p-6" id="client-memory-timeline">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="q-section-label text-slate-500">Workspace timeline</p>
          <p className="q-body-muted mt-2 max-w-2xl">
            Invoices, reminders, proofs, deposits, plans, and your internal notes — grouped by day.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-8">
        {trimmed.map((group) => (
          <div key={group.day}>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">{shortDate(group.day)}</p>
            <div className="space-y-3">
              {group.items.map((item) => (
                <TimelineRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
