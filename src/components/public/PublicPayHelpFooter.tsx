import { MessageCircle } from "lucide-react";
import { businessWhatsAppHref } from "@/lib/public-payment-copy";

export function PublicPayHelpFooter({
  businessName,
  businessPhone,
  whatsappPhone
}: {
  businessName: string;
  businessPhone: string | null | undefined;
  whatsappPhone?: string | null;
}) {
  const wa = businessWhatsAppHref(whatsappPhone || businessPhone);

  return (
    <footer className="q-surface p-4 sm:p-5">
      <p className="q-section-label">Need help?</p>
      <p className="mt-1 text-sm text-slate-700">
        Contact <strong className="text-ink">{businessName}</strong> if an amount, receiver detail, or payment status does not match what you agreed.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">
        Pay using the instructions above, then upload proof. The business confirms accepted amounts, and receipts reflect what they record.
      </p>
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex touch-manipulation items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50"
        >
          <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
          Message on WhatsApp
        </a>
      ) : (
        <p className="mt-3 text-xs text-slate-500">WhatsApp appears when the business adds a phone number to their profile.</p>
      )}
    </footer>
  );
}
