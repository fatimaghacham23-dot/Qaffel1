import { Info } from "lucide-react";

/** Factual helper lines only; parent passes pre-built strings from invoice data. */
export function PayConversionHelpers({ lines }: { lines: string[] }) {
  if (!lines.length) return null;

  return (
    <aside className="rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-card sm:px-5" aria-label="Payment tips">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-cedar" aria-hidden />
        <div className="min-w-0">
          <p className="q-section-label">Before you pay</p>
          <ul className="mt-2 space-y-1.5">
            {lines.map((line) => (
              <li key={line} className="flex gap-2 text-[13px] leading-snug">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cedar/70" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
