import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  FileText,
  HandCoins,
  MessageCircle,
  RefreshCw,
  RotateCw,
  Sparkles,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { workflowTierLabel, type SuggestedActionKind, type SuggestedNextAction, type WorkflowAssistantModel, type WorkflowPriorityTier, type WorkflowSectionKey } from "@/lib/workflow-assistant";
import { cn } from "@/lib/utils";

const tierClass: Record<WorkflowPriorityTier, string> = {
  focus_now: "border-red-200 bg-red-50 text-red-800",
  high_priority: "border-amber-200 bg-amber-50 text-amber-900",
  steady_followup: "border-sky-200 bg-sky-50 text-sky-900",
  cleanup: "border-slate-200 bg-slate-50 text-slate-700"
};

const sectionIcon: Record<WorkflowSectionKey, LucideIcon> = {
  urgent_proof_reviews: ClipboardCheck,
  overdue_recoveries: HandCoins,
  expiring_invoices: CalendarClock,
  clients_awaiting_response: Users,
  unpaid_deposits: Banknote,
  stale_quotes: FileClock,
  follow_up_opportunities: MessageCircle
};

const actionIcon: Record<SuggestedActionKind, LucideIcon> = {
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

function TierBadge({ tier }: { tier: WorkflowPriorityTier }) {
  return (
    <span className={cn("inline-flex min-h-6 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", tierClass[tier])}>
      {workflowTierLabel(tier)}
    </span>
  );
}

function ActionCard({ action, compact = false }: { action: SuggestedNextAction; compact?: boolean }) {
  const Icon = actionIcon[action.kind];
  return (
    <article className={cn("q-surface-hover rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-card", compact ? "min-h-[150px]" : "min-h-[168px]")}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TierBadge tier={action.tier} />
            {action.amountLabel ? <span className="text-[10px] font-bold text-slate-500">{action.amountLabel}</span> : null}
          </div>
          <h3 className="mt-2 text-sm font-bold leading-snug text-ink">{action.title}</h3>
        </div>
      </div>
      <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-slate-600">{action.explanation}</p>
      {action.meta.length ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {action.meta.slice(0, 3).map((m) => (
            <span key={m} className="max-w-full truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {m}
            </span>
          ))}
        </div>
      ) : null}
      <Link href={action.href} className="mt-3 inline-flex min-h-9 touch-manipulation items-center gap-1.5 rounded-xl bg-ink px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-ink/90">
        {action.ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </article>
  );
}

function ActionRow({ action }: { action: SuggestedNextAction }) {
  const Icon = actionIcon[action.kind];
  return (
    <Link
      href={action.href}
      className="group flex touch-manipulation items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 transition hover:border-cedar/25 hover:bg-cedar/[0.035] hover:shadow-soft"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 group-hover:text-cedar">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <TierBadge tier={action.tier} />
          {action.amountLabel ? <span className="text-[10px] font-bold text-slate-500">{action.amountLabel}</span> : null}
        </span>
        <span className="mt-1 block text-sm font-bold leading-snug text-ink">{action.title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-600">{action.explanation}</span>
      </span>
      <ArrowRight className="mt-1 hidden h-4 w-4 shrink-0 text-slate-300 group-hover:text-cedar sm:block" aria-hidden />
    </Link>
  );
}

export function WorkflowAssistantPanel({ model }: { model: WorkflowAssistantModel }) {
  const total = model.actions.length;
  const primary = model.actions[0];

  return (
    <section id="today-workflow" className="q-panel overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="q-section-label text-cedar">Smart workflow assistant</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">Today&apos;s workflow</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
              Suggested next actions are rule-based and explain why they appear. Nothing sends, approves, reconciles, or charges automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="q-chip">{total.toLocaleString()} action{total === 1 ? "" : "s"}</span>
            <span className="q-chip">Deterministic</span>
            <span className="q-chip">Manual control</span>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-5">
          {primary ? (
            <div className="rounded-3xl border border-cedar/15 bg-gradient-to-br from-cedar/[0.06] to-white p-4 shadow-card sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cedar">Suggested next action</p>
                  <p className="mt-1 text-sm text-slate-600">Start here, then work down the grouped queues.</p>
                </div>
                <TierBadge tier={primary.tier} />
              </div>
              <ActionCard action={primary} />
            </div>
          ) : (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-card">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden />
                <div>
                  <p className="font-bold text-emerald-950">Today&apos;s operational queue is clear.</p>
                  <p className="mt-1 text-sm text-emerald-900/85">No overdue, pending proof, deposit, expiring link, stale quote, or due-soon rules matched current data.</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3">
            {model.sections.map((section, index) => {
              const Icon = sectionIcon[section.key];
              const hasItems = section.items.length > 0;
              return (
                <details
                  key={section.key}
                  className="group overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-card"
                  open={hasItems && index < 3}
                >
                  <summary className="flex cursor-pointer list-none touch-manipulation items-start justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5">
                    <span className="flex min-w-0 gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink">{section.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{section.subtitle}</span>
                      </span>
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{section.items.length}</span>
                  </summary>
                  <div className="border-t border-slate-100 p-3 sm:p-4">
                    {hasItems ? (
                      <div className="grid gap-2">
                        {section.items.slice(0, 8).map((action) => (
                          <ActionRow key={action.id} action={action} />
                        ))}
                        {section.items.length > 8 ? (
                          <p className="px-1 pt-1 text-xs text-slate-500">
                            {section.items.length - 8} more item{section.items.length - 8 === 1 ? "" : "s"} are available from the linked queues.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-sm text-slate-500">Clear right now.</p>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-card sm:p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cedar" aria-hidden />
              <h3 className="text-sm font-bold text-ink">Operational insights</h3>
            </div>
            {model.insights.length ? (
              <ul className="mt-3 space-y-2">
                {model.insights.map((insight) => (
                  <li
                    key={insight.id}
                    className={cn(
                      "rounded-2xl border px-3 py-2.5 text-xs",
                      insight.tone === "good"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                        : insight.tone === "attention"
                          ? "border-amber-200 bg-amber-50 text-amber-950"
                          : "border-slate-200 bg-slate-50 text-slate-800"
                    )}
                  >
                    <p className="font-bold">{insight.title}</p>
                    <p className="mt-1 leading-relaxed">{insight.detail}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-70">Based on {insight.basis}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-500">
                Not enough comparable real data yet for operational insights.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-4 shadow-card sm:p-5">
            <h3 className="text-sm font-bold text-ink">Workload balancing</h3>
            {model.workload.length ? (
              <ul className="mt-3 space-y-2">
                {model.workload.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm">
                    <p className="font-bold text-ink">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                    <Link className="mt-2 inline-flex text-xs font-bold text-cedar" href={item.href}>
                      {item.ctaLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-500">
                Load looks balanced across proofs, recoveries, drafts, and client follow-ups.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
