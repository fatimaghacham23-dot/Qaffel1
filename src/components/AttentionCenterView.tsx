import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  FileWarning,
  MessageSquareText,
  ShieldCheck,
  TimerReset,
  UserRoundCheck,
  UsersRound
} from "lucide-react";
import { updateAssignmentStatusAction } from "@/app/assignment-actions";
import { EntityPresenceLine, OperationalPresenceStrip } from "@/components/OperationalPresenceStrip";
import { StatusBadge } from "@/components/StatusBadge";
import type {
  AttentionCenterModel,
  AttentionSectionKey,
  OperationalNotification,
  OperationalNotificationSeverity
} from "@/lib/operational-notifications";
import type { EntityPresenceSummary, OperationalPresenceModel } from "@/lib/operational-presence";
import { hasPermission } from "@/lib/permissions";

const sectionCopy: Record<AttentionSectionKey, { title: string; subtitle: string }> = {
  requiresAttention: {
    title: "Requires attention",
    subtitle: "Operational items with clear next actions."
  },
  waitingOnYou: {
    title: "Waiting on you",
    subtitle: "Assigned directly to you or to your workspace role."
  },
  staleItems: {
    title: "Stale items",
    subtitle: "Open work that risks losing continuity."
  },
  escalations: {
    title: "Escalations",
    subtitle: "Rule-based elevation with the reason shown."
  },
  recentChanges: {
    title: "Recent operational changes",
    subtitle: "Continuity events from the last few days."
  }
};

const sectionOrder: AttentionSectionKey[] = [
  "requiresAttention",
  "waitingOnYou",
  "staleItems",
  "escalations",
  "recentChanges"
];

function timeAgo(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return formatDistanceToNow(parsed, { addSuffix: true });
}

function severityStatus(severity: OperationalNotificationSeverity) {
  if (severity === "escalated") return "danger";
  if (severity === "elevated") return "warning";
  if (severity === "watch") return "pending";
  return "neutral";
}

function severityLabel(severity: OperationalNotificationSeverity) {
  if (severity === "escalated") return "Escalated";
  if (severity === "elevated") return "Elevated";
  if (severity === "watch") return "Watch";
  return "Routine";
}

function itemIcon(item: OperationalNotification) {
  if (item.bucket === "proofs") return <ClipboardCheck className="h-4 w-4 text-cedar" aria-hidden />;
  if (item.bucket === "recoveries") return <TimerReset className="h-4 w-4 text-amber-700" aria-hidden />;
  if (item.bucket === "approvals") return <ShieldCheck className="h-4 w-4 text-sky-700" aria-hidden />;
  if (item.bucket === "communication") return <MessageSquareText className="h-4 w-4 text-slate-600" aria-hidden />;
  if (item.bucket === "payments") return <FileWarning className="h-4 w-4 text-amber-700" aria-hidden />;
  return <UserRoundCheck className="h-4 w-4 text-slate-600" aria-hidden />;
}

function ownerLabel(item: OperationalNotification) {
  if (item.owner.type === "workspace") return item.owner.label;
  return item.owner.label;
}

function baseHref(href: string) {
  return href.split("#")[0];
}

function entityKeyForNotification(item: OperationalNotification) {
  const type = item.target.type === "payment_plan" ? "invoice" : item.target.type === "client" ? "recovery" : item.target.type;
  return `${type}:${item.target.id}`;
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "good" | "watch" | "elevated";
}) {
  const toneClass = {
    neutral: "border-slate-200/70 bg-white/90",
    good: "border-emerald-200/70 bg-emerald-50/60",
    watch: "border-amber-200/70 bg-amber-50/55",
    elevated: "border-rose-200/60 bg-rose-50/45"
  }[tone];

  return (
    <div className={`q-surface p-4 ${toneClass}`}>
      <p className="q-section-label">{label}</p>
      <p className="q-kpi-secondary mt-2">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{detail}</p>
    </div>
  );
}

function NotificationCard({
  item,
  canWorkAssignments,
  presenceSummary
}: {
  item: OperationalNotification;
  canWorkAssignments: boolean;
  presenceSummary?: EntityPresenceSummary;
}) {
  const wait = timeAgo(item.waitingSince);
  const action = timeAgo(item.lastActionAt);
  const reminder = timeAgo(item.lastReminderAt);
  const contact = timeAgo(item.lastContactAt);
  const canComplete = canWorkAssignments && item.assignmentId && ["overdue_assignment", "assignment_stale"].includes(item.kind);

  return (
    <article className="q-mobile-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white shadow-xs">
            {itemIcon(item)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={severityStatus(item.severity)} label={severityLabel(item.severity)} size="sm" />
              <span className="q-chip min-h-7 px-2 py-0 text-[10px] capitalize text-slate-500">{item.bucket}</span>
              <span className="q-chip min-h-7 px-2 py-0 text-[10px] text-slate-500">{ownerLabel(item)}</span>
            </div>
            <h3 className="mt-2 text-base font-semibold leading-snug text-ink">{item.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.summary}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.explanation}</p>

            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
              {wait ? <span className="q-chip min-h-7 px-2 py-0">Waiting {wait}</span> : null}
              {action ? <span className="q-chip min-h-7 px-2 py-0">Action {action}</span> : null}
              {reminder ? <span className="q-chip min-h-7 px-2 py-0">Reminder {reminder}</span> : null}
              {contact ? <span className="q-chip min-h-7 px-2 py-0">Contact {contact}</span> : null}
            </div>

            {item.escalation?.active ? (
              <div className="mt-3 rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-xs text-amber-950">
                <p className="font-semibold">{item.escalation.reason}</p>
                <p className="mt-0.5 text-amber-900/75">Rule: {item.escalation.threshold}</p>
              </div>
            ) : null}

            {item.evidence.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.evidence.slice(0, 3).map((evidence) => (
                  <span key={evidence} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {evidence}
                  </span>
                ))}
              </div>
            ) : null}
            <EntityPresenceLine summary={presenceSummary} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <Link className="btn btn-secondary btn-xs" href={item.target.href}>
            {item.ctaLabel}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          {canComplete ? (
            <form action={updateAssignmentStatusAction}>
              <input name="assignment_id" type="hidden" value={item.assignmentId || ""} />
              <input name="status" type="hidden" value="completed" />
              <button className="btn btn-primary btn-xs" type="submit">
                Complete
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function AttentionSection({
  section,
  items,
  canWorkAssignments,
  presenceByEntity,
  presenceByHref
}: {
  section: AttentionSectionKey;
  items: OperationalNotification[];
  canWorkAssignments: boolean;
  presenceByEntity?: Map<string, EntityPresenceSummary>;
  presenceByHref?: Map<string, EntityPresenceSummary>;
}) {
  const copy = sectionCopy[section];
  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="q-section-label">{copy.title}</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">{copy.subtitle}</h2>
        </div>
        <span className="q-chip">{items.length.toLocaleString()}</span>
      </div>

      <div className="mt-4 grid gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              canWorkAssignments={canWorkAssignments}
              presenceSummary={presenceByEntity?.get(entityKeyForNotification(item)) || presenceByHref?.get(baseHref(item.target.href))}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5 text-sm text-slate-600">
            Nothing in this group right now.
          </div>
        )}
      </div>
    </section>
  );
}

function TeamVisibility({ model }: { model: AttentionCenterModel }) {
  if (!model.visibility.canSeeTeam) {
    return (
      <section className="panel">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-slate-500" aria-hidden />
          <h2 className="text-lg font-semibold text-ink">Team visibility</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">Your role sees assigned operational work without exposing manager-only workload analysis.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="q-section-label">Team visibility</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">Workload and bottlenecks</h2>
        </div>
        <StatusBadge status={model.team.overdueOwnership > 0 ? "warning" : "complete"} label={`${model.team.overdueOwnership} overdue owners`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-2">
          {model.team.workload.slice(0, 8).map((member) => (
            <div key={member.userId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  {member.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                  <p className="text-[11px] capitalize text-slate-500">{member.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-right text-xs text-slate-500">
                <span><strong className="text-ink">{member.active}</strong> active</span>
                <span><strong className="text-ink">{member.stale}</strong> stale</span>
                <span><strong className="text-ink">{member.overdue}</strong> due</span>
              </div>
            </div>
          ))}
          {model.team.workload.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No assigned workload yet.</div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <MetricCard
            label="Proof review delays"
            value={model.team.proofReviewDelays}
            detail="Pending proofs older than 24h."
            tone={model.team.proofReviewDelays ? "watch" : "good"}
          />
          <MetricCard
            label="Recovery aging"
            value={model.team.recoveryAging}
            detail="Overdue invoices without a recent reminder."
            tone={model.team.recoveryAging ? "watch" : "good"}
          />
          <MetricCard
            label="Approval bottlenecks"
            value={model.team.approvalBottlenecks}
            detail="Pending approvals older than 24h."
            tone={model.team.approvalBottlenecks ? "watch" : "good"}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {model.team.roleQueues.map((queue) => (
          <div key={queue.role} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <p className="text-xs font-semibold capitalize text-slate-600">{queue.role}</p>
            <p className="mt-1 text-sm text-slate-500"><span className="font-semibold text-ink">{queue.active}</span> active, {queue.stale} stale</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AttentionCenterView({ model, presenceModel }: { model: AttentionCenterModel; presenceModel?: OperationalPresenceModel }) {
  const hasWork = model.counts.total > 0;
  const canWorkAssignments = hasPermission(model.role, "assignments.work");
  const presenceByEntity = presenceModel ? new Map(presenceModel.entitySummaries.map((summary) => [summary.entityKey, summary])) : undefined;
  const presenceByHref = presenceModel
    ? presenceModel.entitySummaries.reduce((map, summary) => {
        const href = baseHref(summary.href);
        if (!map.has(href)) map.set(href, summary);
        return map;
      }, new Map<string, EntityPresenceSummary>())
    : undefined;

  return (
    <div className="q-dashboard-stack">
      <section className="q-elevated bg-white/[0.82] p-6 backdrop-blur-md sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="q-section-label text-cedar">Operational attention</p>
            <h1 className="page-title mt-1">Attention center</h1>
            <p className="q-subtitle mt-2.5 max-w-3xl">
              Deterministic work signals for review, ownership, escalation, and follow-through. No auto-sent communication and no social feed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-secondary btn-xs" href="/proofs">
              Review proofs
            </Link>
            <Link className="btn btn-secondary btn-xs" href="/recoveries">
              Recovery center
            </Link>
            <Link className="btn btn-primary btn-xs" href="/invoices">
              Open invoices
            </Link>
          </div>
        </div>
      </section>

      {presenceModel ? <OperationalPresenceStrip model={presenceModel} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Waiting on you"
          value={model.counts.waitingOnYou}
          detail="Person or role-owned work."
          tone={model.counts.waitingOnYou ? "watch" : "good"}
        />
        <MetricCard
          label="Escalated signals"
          value={model.counts.escalated}
          detail="Rule-based and explainable."
          tone={model.counts.escalated ? "elevated" : "good"}
        />
        <MetricCard
          label="Aged proofs"
          value={model.continuity.agedPendingProofs}
          detail="Pending more than 24h."
          tone={model.continuity.agedPendingProofs ? "watch" : "good"}
        />
        <MetricCard
          label="Recovery continuity"
          value={model.continuity.overdueWithoutRecentReminder}
          detail="Overdue without recent reminder."
          tone={model.continuity.overdueWithoutRecentReminder ? "watch" : "good"}
        />
        <MetricCard
          label="Reminder copies"
          value={model.continuity.remindersLast7d}
          detail="Recorded in the last 7d."
        />
      </div>

      {!hasWork ? (
        <section className="rounded-3xl border border-emerald-200/70 bg-emerald-50/60 p-7 text-emerald-950 shadow-card">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold">No operational attention signals right now.</h2>
              <p className="mt-1 text-sm text-emerald-900/80">Assignments, proofs, recoveries, approvals, and reminder continuity are clear for the current rules.</p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="grid gap-5">
          <AttentionSection
            section="waitingOnYou"
            items={model.sections.waitingOnYou}
            canWorkAssignments={canWorkAssignments}
            presenceByEntity={presenceByEntity}
            presenceByHref={presenceByHref}
          />
          <AttentionSection
            section="requiresAttention"
            items={model.sections.requiresAttention}
            canWorkAssignments={canWorkAssignments}
            presenceByEntity={presenceByEntity}
            presenceByHref={presenceByHref}
          />
          <AttentionSection
            section="escalations"
            items={model.sections.escalations}
            canWorkAssignments={canWorkAssignments}
            presenceByEntity={presenceByEntity}
            presenceByHref={presenceByHref}
          />
        </div>

        <div className="grid content-start gap-5">
          <section className="panel">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-slate-500" aria-hidden />
              <h2 className="text-lg font-semibold text-ink">Follow-through signals</h2>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-slate-600">Pending proofs</span>
                <span className="font-semibold text-ink">{model.continuity.pendingProofs}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-slate-600">Aged pending proofs</span>
                <span className="font-semibold text-ink">{model.continuity.agedPendingProofs}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-slate-600">Repeated reassignments</span>
                <span className="font-semibold text-ink">{model.continuity.reassignedMultipleTimes}</span>
              </div>
            </div>
          </section>

          <AttentionSection
            section="staleItems"
            items={model.sections.staleItems}
            canWorkAssignments={canWorkAssignments}
            presenceByEntity={presenceByEntity}
            presenceByHref={presenceByHref}
          />
          <AttentionSection
            section="recentChanges"
            items={model.sections.recentChanges}
            canWorkAssignments={canWorkAssignments}
            presenceByEntity={presenceByEntity}
            presenceByHref={presenceByHref}
          />
        </div>
      </div>

      <TeamVisibility model={model} />

      {model.counts.escalated > 0 ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/55 px-4 py-3 text-xs text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>Escalation means the deterministic threshold was crossed. It does not imply automatic outreach or hidden urgency.</p>
        </div>
      ) : null}
    </div>
  );
}
