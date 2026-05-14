import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, FileText, ShieldCheck, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main>
      <section className="bg-wheat">
        <div className="mx-auto grid min-h-[calc(100vh-65px)] max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1fr_0.9fr]">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-cedar">Lebanon-focused payment tracking</p>
            <h1 className="text-4xl font-bold tracking-normal text-ink md:text-6xl">
              Track Lebanese client payments without WhatsApp chaos.
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-700">
              Qaffel helps freelancers and small businesses manage quotes, payment proofs, reminders, and accountant exports in one place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/login">
                Start tracking payments
              </Link>
              <Link className="btn btn-secondary" href="/dashboard">
                View dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-sm font-semibold text-ink">Built for real collection workflows</p>
              <p className="mt-1 text-sm text-slate-600">No sample client data is stored or shown here.</p>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                [FileText, "Invoices and quotes", "Issue client-facing documents with approval, expiry, deposits, and print-ready PDFs."],
                [WalletCards, "Manual payment methods", "Show Whish, OMT, cash, bank transfer, or custom instructions without payment gateway lock-in."],
                [ShieldCheck, "Proof review", "Accept, reject, void, reconcile, and keep receipt links clean for clients."],
                [CheckCircle2, "Accountant exports", "Download CSVs without exposing private proof storage paths."]
              ].map(([Icon, title, detail]) => {
                const FeatureIcon = Icon as typeof FileText;
                return (
                  <div key={title as string} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cedar/10 text-cedar">
                      <FeatureIcon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">{title as string}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{detail as string}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
