"use client";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 text-center shadow-soft">
        <h1 className="text-lg font-bold text-red-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-red-800/90">
          We couldn&apos;t load this page. Check your connection and try again. If the problem continues, refresh or return to the dashboard.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[10px] text-red-700/70">Ref: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary text-sm" onClick={() => reset()}>
            Try again
          </button>
          <a className="btn btn-secondary text-sm" href="/dashboard">
            Dashboard
          </a>
          <a className="btn btn-secondary text-sm" href="/login">
            Login
          </a>
        </div>
      </div>
    </main>
  );
}
