import { CalendarDays, CheckCircle2 } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import type { InvoicePaymentPlan } from "@/lib/payment-plan";
import { paymentPlanProgress } from "@/lib/payment-plan";

export function PublicPaymentPlanBanner({
  plan,
  currency
}: {
  plan: InvoicePaymentPlan;
  currency: "USD" | "LBP";
}) {
  const progress = paymentPlanProgress(plan);
  if (progress.total <= 0) return null;

  const doneRatio = progress.total > 0 ? Math.min(1, progress.satisfied / progress.total) : 0;
  const nextAmount = progress.next
    ? currency === "USD"
      ? Number(progress.next.amount_usd || 0)
      : Number(progress.next.amount_lbp || 0)
    : 0;

  return (
    <section className="rounded-2xl border border-sky-200/90 bg-sky-50/90 p-4 text-sm text-sky-950 shadow-sm">
      <div className="flex items-start gap-3">
        <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Agreed payment plan</p>
          <p className="mt-2 font-semibold text-ink">
            {money(progress.satisfied, currency)} received of {money(progress.total, currency)} across milestones tracked by the business.
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.round(doneRatio * 100)}%` }} />
          </div>
          {progress.next ? (
            <p className="mt-3 text-sky-900">
              Next milestone: <span className="font-bold">{money(nextAmount, currency)}</span>
              {progress.next.due_date ? `, due ${shortDate(progress.next.due_date)}` : ""}
            </p>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1.5 font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              All milestones on this plan are marked as received.
            </p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-sky-800">
            This plan does not auto-charge a card or wallet. Pay only when you and the business agree.
          </p>
        </div>
      </div>
    </section>
  );
}
