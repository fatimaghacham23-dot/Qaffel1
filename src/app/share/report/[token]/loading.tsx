export default function SharedReportLoading() {
  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="q-skeleton h-8 w-64 rounded-xl" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="q-skeleton h-20 rounded-2xl" />
          <div className="q-skeleton h-20 rounded-2xl" />
          <div className="q-skeleton h-20 rounded-2xl" />
        </div>
        <div className="q-skeleton mt-6 h-64 rounded-2xl" />
      </div>
    </div>
  );
}
