import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ session?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const sessionRequired = sp.session === "required";

  return (
    <main className="relative flex min-h-[calc(100dvh-65px)] items-center justify-center overflow-hidden px-4 py-10">
      {/* ── Atmospheric background layers ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#f8f3e7] via-[#f5f7f4] to-[#eef3ef]" />
        {/* Cinematic cedar glow — top center */}
        <div className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-cedar/[0.07] to-transparent blur-[100px]" />
        {/* Soft accent glow — bottom right */}
        <div className="absolute -bottom-20 -right-20 h-[400px] w-[400px] rounded-full bg-gradient-to-tl from-cedar/[0.04] to-transparent blur-[80px]" />
        {/* Subtle warmth — left */}
        <div className="absolute left-0 top-1/2 h-[300px] w-[200px] -translate-y-1/2 rounded-full bg-gradient-to-r from-slate-200/20 to-transparent blur-[60px]" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 md:grid-cols-[1fr_440px] md:gap-16">

        {/* Left — Cinematic messaging */}
        <div className="hidden md:block">
          <div className="motion-safe:animate-q-fade-up">
            <p className="q-section-label text-cedar">Qaffel</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink lg:text-[2.75rem] lg:leading-[1.1]">
              Keep the invoice
              <br />
              trail clean.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              Sign in to create clients, send public invoice pages, collect payment screenshots, and export records for your accountant.
            </p>

            {/* Trust signals */}
            <div className="mt-10 space-y-4">
              {[
                "Invoices, quotes, and receipts in one place",
                "Manual payment proof review & reconciliation",
                "CSV exports designed for Lebanese accountants"
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-600">
                  <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cedar/[0.08] text-cedar">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Floating auth card */}
        <div className="relative motion-safe:animate-q-fade-up [animation-delay:80ms]">
          {/* Depth glow behind card */}
          <div
            className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-br from-cedar/[0.05] via-transparent to-slate-200/20 blur-xl"
            aria-hidden="true"
          />

          <div className="relative">
            {/* Mobile-only headline */}
            <div className="mb-6 text-center md:hidden">
              <p className="q-section-label text-cedar">Qaffel</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Keep the invoice trail clean.</h1>
              <p className="mt-2 text-sm text-slate-600">Sign in to manage your workspace.</p>
            </div>

            {sessionRequired ? (
              <div
                className="mb-4 rounded-xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 text-sm text-sky-900 backdrop-blur-sm"
                style={{ boxShadow: "var(--q-shadow-xs)" }}
              >
                <p className="font-semibold">Sign in to continue</p>
                <p className="mt-1 text-xs text-sky-800/80">Your session may have expired, or this page requires an account.</p>
              </div>
            ) : null}
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
