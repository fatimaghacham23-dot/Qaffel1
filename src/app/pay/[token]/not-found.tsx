import Link from "next/link";

export default function PayTokenNotFound() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="panel">
        <h1 className="text-2xl font-bold tracking-normal text-ink">Invoice link unavailable</h1>
        <p className="mt-3 text-sm text-slate-600">
          This payment link is not valid or is no longer active. Please contact the business for a current link.
        </p>
        <p className="mt-6">
          <Link href="/" className="btn btn-secondary text-xs">
            Go to home
          </Link>
        </p>
      </div>
    </main>
  );
}
