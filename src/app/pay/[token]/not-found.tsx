import Link from "next/link";
import { PublicContentContainer, PublicPageShell } from "@/components/public/PublicPageShell";

export default function PayTokenNotFound() {
  return (
    <PublicPageShell>
      <PublicContentContainer className="max-w-2xl">
        <main className="q-panel p-5 sm:p-6">
          <p className="text-xs font-bold uppercase text-slate-500">Payment page</p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal text-ink">Invoice link unavailable</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            This payment link is not valid or is no longer active. Please contact the business for a current link.
          </p>
          <p className="mt-6">
            <Link href="/" className="btn btn-secondary text-xs">
              Go to home
            </Link>
          </p>
        </main>
      </PublicContentContainer>
    </PublicPageShell>
  );
}
