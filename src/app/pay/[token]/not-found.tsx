import Link from "next/link";

export default function PublicPaymentLinkUnavailable() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--q-bg)] px-4 py-8 sm:px-6" dir="auto">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-card sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment link</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink">This payment link is unavailable</h1>
        <p className="mt-3 break-words text-sm leading-6 text-slate-600">It may have expired, been replaced, or no longer be available. Please contact the business that sent it to request an updated link.</p>
        <Link className="btn btn-secondary mt-6" href="/">Return to Qaffel</Link>
      </section>
    </main>
  );
}