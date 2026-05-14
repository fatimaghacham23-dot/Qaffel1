/** Shared loading skeleton for list-style AppShell pages (invoices, clients, proofs, recoveries, dashboard). */
export function ListPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-q-fade-in space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="q-skeleton h-9 w-48 rounded-lg" />
          <div className="q-skeleton h-4 w-72 max-w-full rounded" />
        </div>
        <div className="q-skeleton h-10 w-32 rounded-xl" />
      </div>
      <div className="q-skeleton h-24 rounded-2xl sm:h-20" />
      <div className="q-table-shell">
        <div className="q-skeleton h-11" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4 border-t border-slate-100 px-4 py-4">
            <div className="q-skeleton h-10 w-24 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="q-skeleton h-4 w-[65%] max-w-[14rem] rounded" />
              <div className="q-skeleton h-3 w-[40%] max-w-[10rem] rounded" />
            </div>
            <div className="q-skeleton hidden h-8 w-20 shrink-0 rounded-lg sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
