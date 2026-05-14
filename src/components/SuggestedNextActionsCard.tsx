import Link from "next/link";
import { ArrowRight, Banknote, CalendarClock, CheckCircle2, ClipboardCheck, Clock3, FileText, HandCoins, MessageCircle, RefreshCw, RotateCw, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { workflowTierLabel, type SuggestedActionKind, type SuggestedNextAction } from "@/lib/workflow-assistant";
import { cn } from "@/lib/utils";

const iconFor: Record<SuggestedActionKind, LucideIcon> = {
  review_pending_proof: ClipboardCheck,
  send_gentle_reminder: MessageCircle,
  send_recovery_reminder: HandCoins,
  request_deposit: Banknote,
  extend_validity: RefreshCw,
  regenerate_pay_link: RotateCw,
  create_payment_plan: CalendarClock,
  thank_after_payment: CheckCircle2,
  follow_up_overdue_invoice: HandCoins,
  follow_up_quote: MessageCircle,
  finish_stale_draft: FileText,
  wait_recent_reminder: Clock3,
  contact_recently_active_client: Users
};

const tierTone = {
  focus_now: "border-red-200 bg-red-50 text-red-800",
  high_priority: "border-amber-200 bg-amber-50 text-amber-900",
  steady_followup: "border-sky-200 bg-sky-50 text-sky-900",
  cleanup: "border-slate-200 bg-slate-50 text-slate-700"
} satisfies Record<SuggestedNextAction["tier"], string>;

export function SuggestedNextActionsCard({ actions }: { actions: SuggestedNextAction[] }) {
  if (!actions.length) {
    return (
      <section className="panel mb-6 border-emerald-100 bg-emerald-50/55">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-ink">Suggested next action</h2>
            <p className="mt-1 text-sm text-emerald-900/85">No workflow rule is asking for attention on this invoice right now.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="panel mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="q-section-label text-cedar">Suggested next action</p>
          <h2 className="mt-1 text-lg font-bold text-ink">Rule-based guidance</h2>
          <p className="mt-1 text-sm text-slate-600">Every suggestion below explains the timestamp, balance, proof, or status rule behind it.</p>
        </div>
        <span className="q-chip">{actions.length} suggestion{actions.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {actions.slice(0, 4).map((action) => {
          const Icon = iconFor[action.kind];
          return (
            <article key={action.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", tierTone[action.tier])}>
                      {workflowTierLabel(action.tier)}
                    </span>
                    {action.amountLabel ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">{action.amountLabel}</span> : null}
                  </div>
                  <h3 className="mt-2 text-sm font-bold leading-snug text-ink">{action.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{action.explanation}</p>
                  <Link href={action.href} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-[11px] font-bold text-white hover:bg-ink/90">
                    {action.ctaLabel}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
