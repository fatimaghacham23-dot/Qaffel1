export default function ReceiptLoading() {
  return (
    <div className="min-h-[50vh] animate-q-fade-in bg-slate-50 px-4 py-10 motion-reduce:animate-none">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-48 animate-pulse rounded-3xl bg-white shadow-sm" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200/50" />
      </div>
    </div>
  );
}
