export function AuthenticatedRouteLoading({ rows = 4 }: { rows?: number }) {
  return (
    <main aria-busy="true" aria-label="Loading workspace content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-6 motion-reduce:animate-none">
        <div className="grid gap-3">
          <div className="q-skeleton h-4 w-28" />
          <div className="q-skeleton h-9 w-56 max-w-full" />
          <div className="q-skeleton h-4 w-full max-w-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="q-skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="q-card grid gap-3 p-4 sm:p-6">
          {Array.from({ length: rows }).map((_, index) => <div key={index} className="q-skeleton h-14 rounded-xl" />)}
        </div>
      </div>
    </main>
  );
}
