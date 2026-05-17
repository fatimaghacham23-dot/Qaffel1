import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, Receipt, ShieldCheck, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const features = [
  {
    icon: FileText,
    title: "Invoices & quotes",
    detail: "Issue client-facing documents with approval flows, expiry dates, deposits, and print-ready PDFs."
  },
  {
    icon: WalletCards,
    title: "Manual payment methods",
    detail: "Show Whish, OMT, cash, bank transfer, or custom instructions — no payment gateway lock-in."
  },
  {
    icon: ShieldCheck,
    title: "Proof review",
    detail: "Accept, reject, void, reconcile, and keep receipt links clean for your clients."
  },
  {
    icon: CheckCircle2,
    title: "Accountant exports",
    detail: "Download CSVs at any time without exposing private proof storage paths."
  }
];

const operationalCards = [
  { label: "Invoice", amount: "$2,400.00", status: "Sent", statusColor: "text-indigo-700 bg-indigo-50" },
  { label: "Proof", amount: "Screenshot", status: "Awaiting", statusColor: "text-amber-800 bg-amber-50" },
  { label: "Payment", amount: "$1,200.00", status: "Confirmed", statusColor: "text-emerald-800 bg-emerald-50" }
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative overflow-hidden">
      {/* ── Atmospheric background layers ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Primary gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#f8f3e7] via-[#f5f7f4] to-[#eef3ef]" />
        {/* Cinematic top glow */}
        <div className="absolute -top-32 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-cedar/[0.06] to-transparent blur-[120px]" />
        {/* Soft side atmosphere */}
        <div className="absolute -right-40 top-1/3 h-[500px] w-[400px] rounded-full bg-gradient-to-bl from-cedar/[0.04] to-transparent blur-[100px]" />
        <div className="absolute -left-40 top-2/3 h-[400px] w-[300px] rounded-full bg-gradient-to-br from-slate-300/20 to-transparent blur-[80px]" />
      </div>

      {/* ══════════════════════════════════════════
          HERO SECTION
          ══════════════════════════════════════════ */}
      <section className="relative">
        <div className="mx-auto flex min-h-[calc(100dvh-65px)] max-w-6xl flex-col justify-center px-5 py-16 sm:px-8 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.92fr] lg:gap-16">

            {/* Left — Cinematic headline */}
            <div className="max-w-xl motion-safe:animate-q-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-cedar/15 bg-cedar/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cedar">
                <span className="q-pulse-dot text-cedar" />
                Lebanon-focused payment tracking
              </div>
              <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[3.5rem] md:text-[4rem]">
                The calm way to
                <br />
                <span className="bg-gradient-to-r from-cedar via-[#1a7a7c] to-cedar bg-clip-text text-transparent">get paid.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
                Qaffel helps freelancers and small businesses manage invoices, payment proofs, reminders, and accountant exports — all in one place.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link className="btn btn-primary group" href="/login">
                  Start tracking payments
                  <ArrowRight className="h-4 w-4 transition-transform duration-q group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
                <Link className="btn btn-secondary" href="/dashboard">
                  View dashboard
                </Link>
              </div>
              {/* Social proof whisper */}
              <p className="mt-8 text-xs font-medium text-slate-400">
                Free to start · No credit card · Built for Lebanese workflows
              </p>
            </div>

            {/* Right — Floating operational glimpse */}
            <div className="relative motion-safe:animate-q-fade-up [animation-delay:120ms]">
              {/* Background depth layer */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-cedar/[0.04] via-transparent to-slate-200/30 blur-sm" aria-hidden="true" />

              {/* Main floating card */}
              <div
                className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white/[0.92] backdrop-blur-xl"
                style={{ boxShadow: "var(--q-shadow-elevated)" }}
              >
                {/* Card header */}
                <div className="border-b border-slate-100/60 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="q-section-label text-cedar">Live operations</p>
                      <p className="mt-1 text-sm font-semibold text-ink">Your workspace at a glance</p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-emerald-200/50 bg-emerald-50/60 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                      <span className="q-pulse-dot text-emerald-500" />
                      Active
                    </div>
                  </div>
                </div>

                {/* Mini operational cards */}
                <div className="space-y-2.5 p-5">
                  {operationalCards.map((card, i) => (
                    <div
                      key={card.label}
                      className="flex items-center justify-between rounded-xl border border-slate-200/40 bg-white/80 px-4 py-3 motion-safe:animate-q-fade-up"
                      style={{
                        boxShadow: "var(--q-shadow-xs)",
                        animationDelay: `${200 + i * 80}ms`
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-50 text-slate-400">
                          <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">{card.label}</p>
                          <p className="text-xs text-slate-500">{card.amount}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.statusColor}`}>
                        {card.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bottom stats */}
                <div className="border-t border-slate-100/60 bg-slate-50/40 px-6 py-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium">3 actions pending review</span>
                    <span className="font-semibold tabular-nums text-cedar">$3,600.00 this month</span>
                  </div>
                </div>
              </div>

              {/* Floating depth accent — small badge floating above */}
              <div
                className="absolute -right-3 -top-3 rounded-xl border border-white/60 bg-white/90 px-3 py-2 backdrop-blur-lg motion-safe:animate-q-fade-up [animation-delay:400ms]"
                style={{ boxShadow: "var(--q-shadow-float)" }}
                aria-hidden="true"
              >
                <p className="text-[10px] font-semibold text-emerald-700">+12% this week</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FEATURES SECTION — Scroll storytelling
          ══════════════════════════════════════════ */}
      <section className="relative border-t border-slate-200/40">
        {/* Section atmosphere */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/40 to-white/70" aria-hidden="true" />

        <div className="relative mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-2xl text-center motion-safe:animate-q-fade-up">
            <p className="q-section-label text-cedar">Built for real workflows</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Everything you need to get paid professionally.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-600">
              No sample data, no toy features. Every tool is designed for the real complexity of getting paid in Lebanon.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 sm:gap-5">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/50 bg-white/80 p-6 backdrop-blur-sm transition-[box-shadow,border-color,transform] motion-safe:animate-q-fade-up sm:p-7"
                  style={{
                    boxShadow: "var(--q-shadow-card)",
                    animationDelay: `${i * 80}ms`,
                    transitionDuration: "var(--q-duration-normal)",
                    transitionTimingFunction: "var(--q-ease)"
                  }}
                >
                  {/* Hover glow */}
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-cedar/[0.04] opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" aria-hidden="true" />
                  <div className="relative">
                    <div className="grid h-11 w-11 place-items-center rounded-xl border border-cedar/10 bg-cedar/[0.06] text-cedar transition-[background-color,border-color] duration-q group-hover:border-cedar/20 group-hover:bg-cedar/[0.10]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 text-[15px] font-semibold text-ink">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA SECTION
          ══════════════════════════════════════════ */}
      <section className="relative border-t border-slate-200/40">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 to-[#f5f7f4]" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-28">
          <div className="motion-safe:animate-q-fade-up">
            <p className="q-section-label text-cedar">Ready to get started?</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Stop chasing payments through chat.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-600">
              Create your workspace in under two minutes. Issue your first invoice today.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link className="btn btn-primary group" href="/login">
                Create free workspace
                <ArrowRight className="h-4 w-4 transition-transform duration-q group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
          ══════════════════════════════════════════ */}
      <footer className="border-t border-slate-200/40 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
          <p className="text-xs font-medium text-slate-400">© {new Date().getFullYear()} Qaffel</p>
          <p className="text-xs text-slate-400">Built for Lebanese freelancers</p>
        </div>
      </footer>
    </main>
  );
}
