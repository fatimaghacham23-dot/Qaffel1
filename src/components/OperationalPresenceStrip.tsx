import Link from "next/link";
import {
  Activity,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Landmark,
  ShieldCheck,
  TimerReset,
  UserRoundCheck
} from "lucide-react";
import type {
  EntityPresenceSummary,
  OperationalPresenceModel,
  OperationalPresenceScope,
  OperationalPresenceSignal,
  OperationalPresenceTone
} from "@/lib/operational-presence";

function toneClass(tone: OperationalPresenceTone) {
  if (tone === "review") return "border-cedar/15 bg-cedar/[0.06] text-cedar";
  if (tone === "recovery") return "border-amber-200/70 bg-amber-50/60 text-amber-800";
  if (tone === "finance") return "border-sky-200/70 bg-sky-50/60 text-sky-800";
  if (tone === "approval") return "border-indigo-200/70 bg-indigo-50/60 text-indigo-800";
  if (tone === "complete") return "border-emerald-200/70 bg-emerald-50/60 text-emerald-800";
  if (tone === "watch") return "border-amber-200/70 bg-amber-50/65 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function softToneClass(tone: OperationalPresenceTone) {
  if (tone === "review") return "border-cedar/10 bg-cedar/[0.035]";
  if (tone === "recovery") return "border-amber-200/60 bg-amber-50/40";
  if (tone === "finance") return "border-sky-200/60 bg-sky-50/45";
  if (tone === "approval") return "border-indigo-200/60 bg-indigo-50/45";
  if (tone === "complete") return "border-emerald-200/60 bg-emerald-50/45";
  if (tone === "watch") return "border-amber-200/70 bg-amber-50/50";
  return "border-slate-200 bg-white";
}

function scopeIcon(scope: OperationalPresenceScope) {
  if (scope === "proofs") return <ClipboardCheck className="h-4 w-4" aria-hidden />;
  if (scope === "recoveries") return <TimerReset className="h-4 w-4" aria-hidden />;
  if (scope === "exports") return <FileSpreadsheet className="h-4 w-4" aria-hidden />;
  if (scope === "finance_close") return <Landmark className="h-4 w-4" aria-hidden />;
  if (scope === "approvals") return <ShieldCheck className="h-4 w-4" aria-hidden />;
  if (scope === "assignments") return <UserRoundCheck className="h-4 w-4" aria-hidden />;
  return <Activity className="h-4 w-4" aria-hidden />;
}

function SignalRow({ signal }: { signal: OperationalPresenceSignal }) {
  return (
    <Link href={signal.targetHref} className="group flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-xs transition hover:border-cedar/25 hover:bg-cedar/[0.025]">
      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${toneClass(signal.tone)}`}>
        {scopeIcon(signal.scope)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{signal.verb}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {signal.targetLabel} - {signal.ageLabel}
        </span>
      </span>
    </Link>
  );
}

export function EntityPresenceLine({ summary, className = "" }: { summary?: EntityPresenceSummary | null; className?: string }) {
  if (!summary) return null;

  return (
    <div className={`mt-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs ${className}`}>
      <div className="flex min-w-0 items-start gap-2">
        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-700">{summary.primaryLine}</p>
          <p className="mt-0.5 line-clamp-2 text-slate-500">{summary.secondaryLine}</p>
          {summary.activeHandlers.length > 0 ? (
            <p className="mt-1 truncate text-[11px] font-medium text-slate-500">Owner: {summary.activeHandlers.join(", ")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OperationalPresenceStrip({ model }: { model: OperationalPresenceModel }) {
  const empty = model.strip.length === 0 && model.recentActivity.length === 0 && model.continuityWarnings.length === 0;

  return (
    <section className="panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="q-section-label">Operational presence</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">Live coordination</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Recent handling, review, export, and close activity across this workspace.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-semibold text-ink">{model.counts.activeNow}</p>
            <p className="text-slate-500">active</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-semibold text-ink">{model.counts.activeReviewers}</p>
            <p className="text-slate-500">review</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="font-semibold text-ink">{model.counts.financeSignals}</p>
            <p className="text-slate-500">finance</p>
          </div>
        </div>
      </div>

      {empty ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/55 p-4 text-sm text-emerald-950">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <p>No recent operational overlap detected.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid content-start gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {model.strip.map((item) => (
              <Link key={item.id} href={item.href} className={`q-surface-hover min-h-32 rounded-2xl border p-4 ${softToneClass(item.tone)}`}>
                <div className="flex items-start gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${toneClass(item.tone)}`}>
                    {scopeIcon(item.scope)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{item.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{item.detail}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3 text-xs text-slate-500">
                  <span>{item.count} signal{item.count === 1 ? "" : "s"}</span>
                  <span className="font-semibold">Open</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid content-start gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Archive className="h-4 w-4 text-slate-500" aria-hidden />
                <p className="text-sm font-semibold text-ink">Recent operational changes</p>
              </div>
              <div className="grid gap-2">
                {model.recentActivity.slice(0, 5).map((signal) => (
                  <SignalRow key={signal.id} signal={signal} />
                ))}
                {model.recentActivity.length === 0 ? <p className="px-1 py-2 text-sm text-slate-600">No recent changes recorded.</p> : null}
              </div>
            </div>

            {model.continuityWarnings.length > 0 ? (
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/45 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <TimerReset className="h-4 w-4 text-amber-700" aria-hidden />
                  <p className="text-sm font-semibold text-ink">Continuity watch</p>
                </div>
                <div className="grid gap-2">
                  {model.continuityWarnings.slice(0, 4).map((warning) => (
                    <Link key={warning.id} href={warning.href} className="rounded-xl border border-amber-200/80 bg-white px-3 py-2 text-xs shadow-xs">
                      <span className="block font-semibold text-ink">{warning.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-slate-600">{warning.detail}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
