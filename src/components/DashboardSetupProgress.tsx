"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Eye,
  FileCheck2,
  FileText,
  HelpCircle,
  PartyPopper,
  ReceiptText,
  Sparkles,
  WalletCards,
  X
} from "lucide-react";
import type { BusinessLaunchHelpItem, BusinessLaunchModel, BusinessLaunchStep } from "@/lib/business-launch";
import { cn } from "@/lib/utils";

const STORAGE_COLLAPSE = "qaffel-launch-setup-collapsed";
const STORAGE_DISMISS_PANEL = "qaffel-launch-setup-hidden";
const STORAGE_DISMISS_CELEBRATION = "qaffel-launch-celebration-dismissed";
const STORAGE_HIDDEN_SAMPLE = "qaffel-launch-sample-hidden";
const STORAGE_DISMISSED_HELP = "qaffel-launch-help-dismissed";

function readLs(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLs(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readJsonArray(key: string): string[] {
  const raw = readLs(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function StepStatus({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dashed border-slate-300 bg-white text-slate-400">
      <Circle className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

function StepRow({ step }: { step: BusinessLaunchStep }) {
  return (
    <li className="grid gap-3 rounded-2xl border border-slate-200/75 bg-white/85 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 items-start gap-3">
        <StepStatus completed={step.completed} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-ink">{step.title}</p>
            {step.optional ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Optional
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">{step.description}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">Why this appears: {step.why}</p>
        </div>
      </div>
      {step.completed ? (
        <span className="justify-self-start rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 sm:justify-self-end">
          Done
        </span>
      ) : (
        <Link className="btn btn-primary min-h-10 justify-self-start px-3 text-xs sm:justify-self-end" href={step.href}>
          {step.ctaLabel}
        </Link>
      )}
    </li>
  );
}

function ReadinessPanel({ model }: { model: BusinessLaunchModel }) {
  const tierLabel =
    model.readiness.tier === "operational"
      ? "Operational"
      : model.readiness.tier === "launching"
        ? "Launching"
        : "Foundation";

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="rounded-2xl border border-slate-200/75 bg-slate-50/80 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace readiness</p>
        <div className="mt-3 flex items-end gap-2">
          <span className="q-figure text-4xl font-semibold tabular-nums text-ink">{model.readiness.score}</span>
          <span className="pb-1 text-sm font-semibold text-slate-500">/ 100</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-cedar">{tierLabel}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Calculated from setup and workflow signals in this workspace.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/55 p-4">
          <p className="text-xs font-bold text-emerald-900">Strengths</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-emerald-900/85">
            {model.readiness.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/55 p-4">
          <p className="text-xs font-bold text-amber-950">Missing setup</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-950/85">
            {model.readiness.missingSetup.length > 0 ? (
              model.readiness.missingSetup.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>Core launch setup is complete.</li>
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-sky-200/70 bg-sky-50/55 p-4">
          <p className="text-xs font-bold text-sky-950">Recommendations</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-sky-950/85">
            {model.readiness.recommendations.length > 0 ? (
              model.readiness.recommendations.map((item) => <li key={item}>{item}</li>)
            ) : (
              <li>Keep using real invoices, proof review, and reminders as work arrives.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function HelpItemCard({
  item,
  onDismiss
}: {
  item: BusinessLaunchHelpItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200/75 bg-white/85 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cedar/10 text-cedar">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p>
            {item.href && item.ctaLabel ? (
              <Link className="mt-2 inline-flex text-xs font-bold text-cedar hover:underline" href={item.href}>
                {item.ctaLabel}
              </Link>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          onClick={() => onDismiss(item.id)}
          aria-label={`Dismiss ${item.title}`}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function SampleWorkflow({
  hidden,
  onHide,
  onShow
}: {
  hidden: boolean;
  onHide: () => void;
  onShow: () => void;
}) {
  if (hidden) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/75 bg-slate-50/80 p-4">
        <div>
          <p className="text-sm font-bold text-ink">Sample workflow hidden</p>
          <p className="mt-1 text-xs text-slate-500">The sample is only an explanation. It does not create invoices or payments.</p>
        </div>
        <button type="button" className="btn btn-secondary min-h-10 px-3 text-xs" onClick={onShow}>
          Show sample
        </button>
      </div>
    );
  }

  const sampleItems = [
    {
      icon: FileText,
      title: "Sample invoice",
      body: "A client opens a clearly branded public payment page."
    },
    {
      icon: WalletCards,
      title: "Sample payment proof",
      body: "They follow Whish, OMT, cash, or bank instructions and upload a receipt."
    },
    {
      icon: FileCheck2,
      title: "Sample review",
      body: "You manually check amount, date, receiver details, and screenshot clarity."
    },
    {
      icon: ReceiptText,
      title: "Sample receipt",
      body: "Only after acceptance does the invoice move toward paid and receipt sharing."
    }
  ];

  return (
    <div className="rounded-2xl border border-slate-200/75 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Sample only</p>
          <h3 className="mt-1 text-base font-bold text-ink">Preview the payment workflow</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">This is an educational sample. It does not create records or metrics.</p>
        </div>
        <button type="button" className="btn btn-secondary min-h-10 px-3 text-xs" onClick={onHide}>
          Hide sample
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sampleItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-xl border border-white/90 bg-white/80 p-3">
              <Icon className="h-4 w-4 text-cedar" aria-hidden="true" />
              <p className="mt-2 text-sm font-bold text-ink">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardSetupProgress({ model }: { model: BusinessLaunchModel }) {
  const [collapsed, setCollapsed] = useState(() => readLs(STORAGE_COLLAPSE) === "1");
  const [panelHidden, setPanelHidden] = useState(() => readLs(STORAGE_DISMISS_PANEL) === "1");
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);
  const [sampleHidden, setSampleHidden] = useState(() => readLs(STORAGE_HIDDEN_SAMPLE) === "1");
  const [dismissedHelpIds, setDismissedHelpIds] = useState<string[]>([]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (readLs(STORAGE_DISMISS_CELEBRATION) === "1") setCelebrationDismissed(true);
      setDismissedHelpIds(readJsonArray(STORAGE_DISMISSED_HELP));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const visibleHelp = useMemo(
    () => model.help.filter((item) => !dismissedHelpIds.includes(item.id)).slice(0, 3),
    [dismissedHelpIds, model.help]
  );

  const persistCollapse = (next: boolean) => {
    setCollapsed(next);
    writeLs(STORAGE_COLLAPSE, next ? "1" : "0");
  };

  const hidePanel = () => {
    setPanelHidden(true);
    writeLs(STORAGE_DISMISS_PANEL, "1");
  };

  const showPanel = () => {
    setPanelHidden(false);
    writeLs(STORAGE_DISMISS_PANEL, "0");
  };

  const dismissCelebration = () => {
    setCelebrationDismissed(true);
    writeLs(STORAGE_DISMISS_CELEBRATION, "1");
    persistCollapse(true);
  };

  const toggleSample = (nextHidden: boolean) => {
    setSampleHidden(nextHidden);
    writeLs(STORAGE_HIDDEN_SAMPLE, nextHidden ? "1" : "0");
  };

  const dismissHelp = (id: string) => {
    setDismissedHelpIds((current) => {
      const next = Array.from(new Set([...current, id]));
      writeLs(STORAGE_DISMISSED_HELP, JSON.stringify(next));
      return next;
    });
  };

  if (panelHidden && !model.isComplete) {
    return (
      <section className="mb-5 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ink">Launch setup hidden</p>
            <p className="mt-1 text-xs text-slate-500">
              {model.completedCount}/{model.totalCount} core steps complete. Progress is still tracked from your workspace data.
            </p>
          </div>
          <button type="button" className="btn btn-secondary min-h-10 px-3 text-xs" onClick={showPanel}>
            Show launch setup
          </button>
        </div>
      </section>
    );
  }

  if (model.isComplete && celebrationDismissed) {
    return null;
  }

  if (model.isComplete && !celebrationDismissed) {
    return (
      <section className="mb-5 overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/95 via-white to-cedar/[0.06] p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
              <PartyPopper className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800/90">Launch setup complete</p>
              <h2 className="mt-1 text-lg font-bold text-ink">Your workspace is ready to operate</h2>
              <p className="mt-1 text-sm text-slate-600">Business identity, payment path, invoice flow, and manual review are in place.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary touch-manipulation px-3 py-2 text-xs" onClick={dismissCelebration}>
              Collapse section
            </button>
            <Link className="btn btn-primary touch-manipulation px-3 py-2 text-xs" href="/invoices/new">
              New invoice
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const nextStep = model.nextStep;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-soft backdrop-blur-[2px]">
      <button
        type="button"
        className="flex w-full touch-manipulation items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50/90 sm:px-5"
        onClick={() => persistCollapse(!collapsed)}
        aria-expanded={!collapsed}
      >
        <div className="flex min-w-0 gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cedar/10 text-cedar">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {model.isNewWorkspace ? "Welcome to Qaffel" : "Business launch"}
            </p>
            <h2 className="mt-0.5 text-base font-bold text-ink sm:text-lg">
              {model.isNewWorkspace ? "Set up the fastest path to your first payment" : "Finish the launch steps that improve collection clarity"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {model.completedCount}/{model.totalCount} core steps complete - {model.percent}%. Progress is based on real workspace records.
            </p>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200", collapsed ? "-rotate-90" : "rotate-0")} aria-hidden="true" />
      </button>

      <div
        className={cn(
          "grid border-t border-slate-100 transition-[grid-template-rows] duration-200 ease-out",
          collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-5 px-4 pb-5 pt-3 sm:px-5">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-cedar transition-[width] duration-500 ease-out" style={{ width: `${model.percent}%` }} />
            </div>

            {nextStep ? (
              <div className="grid gap-3 rounded-2xl border border-cedar/20 bg-cedar/[0.055] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-cedar ring-1 ring-cedar/15">
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-cedar">Next guided step</p>
                    <h3 className="mt-1 text-base font-bold text-ink">{nextStep.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{nextStep.why}</p>
                  </div>
                </div>
                <Link className="btn btn-primary min-h-10 justify-self-start px-3 text-xs sm:justify-self-end" href={nextStep.href}>
                  {nextStep.ctaLabel}
                </Link>
              </div>
            ) : null}

            <details className="group rounded-2xl border border-slate-200/75 bg-slate-50/70 p-3" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-1">
                <div>
                  <p className="text-sm font-bold text-ink">Interactive setup checklist</p>
                  <p className="mt-1 text-xs text-slate-500">Expandable, rule-based, and never tied to automatic payments.</p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ul className="mt-3 space-y-2">
                {model.steps.map((step) => (
                  <StepRow key={step.key} step={step} />
                ))}
              </ul>
            </details>

            <ReadinessPanel model={model} />

            {visibleHelp.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {visibleHelp.map((item) => (
                  <HelpItemCard key={item.id} item={item} onDismiss={dismissHelp} />
                ))}
              </div>
            ) : null}

            <SampleWorkflow hidden={sampleHidden} onHide={() => toggleSample(true)} onShow={() => toggleSample(false)} />

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-5 text-slate-500">
                Qaffel suggests launch steps from deterministic checks only. It never sends reminders, approves proofs, or creates payments on its own.
              </p>
              <button type="button" className="btn btn-secondary min-h-10 shrink-0 px-3 text-xs" onClick={hidePanel}>
                Hide for now
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
