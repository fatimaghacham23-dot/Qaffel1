export default function PayLoading() {
  return (
    <div className="min-h-[50vh] animate-q-fade-in bg-gradient-to-b from-slate-50 to-white px-4 py-10 motion-reduce:animate-none">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-40 animate-pulse rounded-3xl bg-slate-200/70" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200/55" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200/45" />
      </div>
    </div>
  );
}
