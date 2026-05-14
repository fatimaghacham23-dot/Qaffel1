import { ClipboardCheck, Link2, ReceiptText, Timer } from "lucide-react";
import { publicCopy, pickPublicString, type PublicLang } from "@/lib/i18n-public";

type ReviewStats = { medianHours: number; sampleCount: number } | null;

export function PublicTrustBadgeRow({ reviewStats, lang = "en" }: { reviewStats?: ReviewStats; lang?: PublicLang }) {
  const manual = pickPublicString(publicCopy("Manual payment review"), lang);
  const noAuto = pickPublicString(publicCopy("No auto-approval"), lang);
  const receipt = pickPublicString(publicCopy("Receipt after confirmation"), lang);

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Trust indicators">
      <li className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
        {manual}
      </li>
      <li className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        {noAuto}
      </li>
      <li className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
        <ReceiptText className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        {receipt}
      </li>
      {reviewStats && reviewStats.sampleCount >= 3 && Number.isFinite(reviewStats.medianHours) ? (
        <li className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-sky-50/90 px-2.5 py-1 text-[11px] font-semibold text-sky-900">
          <Timer className="h-3.5 w-3.5 shrink-0 text-sky-700" aria-hidden />
          {pickPublicString(
            publicCopy(
              `Typical proof review: about ${Math.round(reviewStats.medianHours)}h (median, ${reviewStats.sampleCount} accepted payments on file)`
            ),
            lang
          )}
        </li>
      ) : null}
    </ul>
  );
}
