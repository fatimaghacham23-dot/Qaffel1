import type { ReactNode } from "react";
import { FileDown } from "lucide-react";

type ExportCardProps = {
  title: string;
  description: string;
  meta: string;
  action: ReactNode;
};

export function ExportCard({ title, description, meta, action }: ExportCardProps) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-cedar/20">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cedar/10 text-cedar">
          <FileDown className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">{meta}</p>
      </div>

      <div className="mt-4 flex-1" />

      <div className="mt-4 border-t border-slate-100 pt-4">{action}</div>
    </article>
  );
}
