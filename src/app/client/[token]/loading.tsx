export default function ClientPortalLoading() {
  return (
    <div className="min-h-[50vh] animate-q-fade-in bg-gradient-to-b from-slate-50 to-white px-4 py-8 motion-reduce:animate-none">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-28 animate-pulse rounded-3xl bg-slate-200/80" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
        </div>
      </div>
    </div>
  );
}
