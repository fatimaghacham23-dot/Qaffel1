import type { ReactNode } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Link2,
  MessageCircle,
  ReceiptText,
  TimerReset,
  UploadCloud,
  WalletCards
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  check: CheckCircle2,
  link: Link2,
  message: MessageCircle,
  proof: UploadCloud,
  receipt: ReceiptText,
  review: ClipboardCheck,
  status: FileCheck2,
  time: TimerReset,
  wallet: WalletCards
};

type TrustIcon = keyof typeof icons;
type TrustTone = "neutral" | "good" | "info" | "warn";

export type PublicTrustSignal = {
  icon: TrustIcon;
  title: string;
  body: string;
  tone?: TrustTone;
};

const toneStyles: Record<TrustTone, { wrap: string; icon: string }> = {
  neutral: {
    wrap: "border-slate-200/80 bg-slate-50/70 text-slate-700",
    icon: "bg-white text-slate-600 ring-slate-200/80"
  },
  good: {
    wrap: "border-emerald-200/80 bg-emerald-50/60 text-emerald-950",
    icon: "bg-white text-emerald-700 ring-emerald-200/80"
  },
  info: {
    wrap: "border-sky-200/80 bg-sky-50/60 text-sky-950",
    icon: "bg-white text-sky-700 ring-sky-200/80"
  },
  warn: {
    wrap: "border-amber-200/80 bg-amber-50/70 text-amber-950",
    icon: "bg-white text-amber-700 ring-amber-200/80"
  }
};

export function PublicTrustSignalGrid({
  eyebrow = "Payment confidence",
  title,
  body,
  signals,
  className
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  signals: PublicTrustSignal[];
  className?: string;
}) {
  if (!signals.length) return null;

  return (
    <section className={cn("q-surface p-4 sm:p-5", className)} aria-label={title}>
      <div className="flex flex-col gap-1">
        <p className="q-section-label">{eyebrow}</p>
        <h2 className="q-title-sm">{title}</h2>
        {body ? <p className="q-body-muted max-w-prose">{body}</p> : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {signals.map((signal) => {
          const tone = signal.tone || "neutral";
          const Icon = icons[signal.icon];

          return (
            <article key={`${signal.title}-${signal.body}`} className={cn("rounded-2xl border p-3.5", toneStyles[tone].wrap)}>
              <div className="flex gap-3">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1", toneStyles[tone].icon)}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink">{signal.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{signal.body}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function PublicNextStepPanel({
  eyebrow,
  title,
  body,
  children,
  tone = "info",
  className
}: {
  eyebrow: string;
  title: string;
  body: string;
  children?: ReactNode;
  tone?: TrustTone;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border p-4 shadow-sm", toneStyles[tone].wrap, className)}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">{eyebrow}</p>
      <h2 className="mt-1 text-base font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{body}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
