"use client";

import { useState } from "react";
import { ChevronDown, ClipboardCheck, QrCode, UploadCloud } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { PaymentMethodIcon } from "@/components/PaymentMethodIcon";
import { SafePaymentQrImage } from "@/components/SafePaymentQrImage";
import { money } from "@/lib/format";
import type { PublicPaymentMethodOption } from "@/lib/public-pay-method";
import { resolveSafeHttpsPageUrl } from "@/lib/safe-qr-url";
import { cn } from "@/lib/utils";

function MethodTrustFootnote({ variant }: { variant: "whish" | "omt" | "other" }) {
  const text =
    variant === "whish"
      ? "Use the exact amount when possible so the business can match your Whish transfer."
      : variant === "omt"
        ? "Keep the OMT receipt or screenshot. You will upload it below for manual review."
        : "Include the invoice reference in the transfer details if your provider asks for a memo.";

  return <p className="text-[11px] leading-relaxed text-slate-600">{text}</p>;
}

function MethodStep({ step, text }: { step: string; text: string }) {
  return (
    <li className="flex gap-2">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[10px] font-bold text-cedar ring-1 ring-slate-200">
        {step}
      </span>
      <span className="text-xs leading-relaxed text-slate-600">{text}</span>
    </li>
  );
}

function ExpandableInstructions({ text, copyLabel }: { text: string; copyLabel: string }) {
  const [open, setOpen] = useState(false);
  if (!text.trim()) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80">
      <button
        type="button"
        className="flex w-full touch-manipulation items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-bold text-slate-800"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>Full instructions</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", open ? "rotate-180" : "")} aria-hidden />
      </button>
      <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-2 border-t border-slate-100 px-3 pb-3 pt-2">
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{text}</p>
            <CopyButton className="btn btn-secondary btn-xs" value={text} label={copyLabel} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicPayMethodCards({
  methods,
  suggestedAmount,
  suggestedCurrency
}: {
  methods: PublicPaymentMethodOption[];
  suggestedAmount: number | null;
  suggestedCurrency: string;
}) {
  const whish = methods.filter((method) => method.normalizedType === "whish");
  const omt = methods.filter((method) => method.normalizedType === "omt");
  const rest = methods.filter((method) => method.normalizedType !== "whish" && method.normalizedType !== "omt");
  const showSuggested = Boolean(suggestedAmount && suggestedAmount > 0);

  return (
    <div className="space-y-4">
      {whish.length > 0 || omt.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {whish.map((method, index) => (
            <MethodCard
              key={`whish-${index}-${method.label}`}
              method={method}
              variant="whish"
              showSuggested={showSuggested}
              suggestedAmount={suggestedAmount}
              suggestedCurrency={suggestedCurrency}
            />
          ))}
          {omt.map((method, index) => (
            <MethodCard
              key={`omt-${index}-${method.label}`}
              method={method}
              variant="omt"
              showSuggested={showSuggested}
              suggestedAmount={suggestedAmount}
              suggestedCurrency={suggestedCurrency}
            />
          ))}
        </div>
      ) : null}

      {rest.length > 0 ? (
        <div className="space-y-3">
          {rest.map((method, index) => (
            <MethodCard
              key={`rest-${index}-${method.label}`}
              method={method}
              variant="other"
              showSuggested={false}
              suggestedAmount={null}
              suggestedCurrency={suggestedCurrency}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MethodCard({
  method,
  variant,
  showSuggested,
  suggestedAmount,
  suggestedCurrency
}: {
  method: PublicPaymentMethodOption;
  variant: "whish" | "omt" | "other";
  showSuggested: boolean;
  suggestedAmount: number | null;
  suggestedCurrency: string;
}) {
  const safeExternal = resolveSafeHttpsPageUrl(method.external_link);
  const title = variant === "whish" ? "Whish Money" : variant === "omt" ? "OMT" : method.label;
  const uploadHref = variant === "whish" ? "?method=whish#proof-upload" : variant === "omt" ? "?method=omt#proof-upload" : "#proof-upload";
  const amountText =
    showSuggested && variant !== "other" && suggestedAmount != null && suggestedAmount > 0
      ? money(suggestedAmount, suggestedCurrency as "USD" | "LBP")
      : null;

  return (
    <article className="q-surface-hover overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">
      <div className="flex items-start gap-3 border-b border-slate-50 bg-white p-4">
        <PaymentMethodIcon type={method.type || ""} size="sm" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <h3 className="mt-0.5 break-words text-base font-bold text-ink">{method.label}</h3>
          {amountText ? (
            <p className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-950">
              Suggested amount: <span className="font-bold">{amountText}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Follow the details below, then upload proof for review.</p>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <ol className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <MethodStep step="1" text="Copy the receiver details exactly as shown." />
          <MethodStep step="2" text={amountText ? `Send ${amountText}.` : "Send the agreed invoice amount."} />
          <MethodStep step="3" text="Upload the receipt or screenshot below so the business can review it." />
        </ol>

        <dl className="grid gap-2 text-xs text-slate-700">
          {method.receiver_name ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
              <div className="min-w-0">
                <dt className="text-slate-500">Receiver</dt>
                <dd className="truncate font-semibold text-ink">{method.receiver_name}</dd>
              </div>
              <CopyButton className="btn btn-secondary btn-xs shrink-0" value={method.receiver_name} label="Copy" />
            </div>
          ) : null}
          {method.receiver_phone ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
              <div className="min-w-0">
                <dt className="text-slate-500">Phone / wallet</dt>
                <dd className="truncate font-semibold text-ink">{method.receiver_phone}</dd>
              </div>
              <CopyButton className="btn btn-secondary btn-xs shrink-0" value={method.receiver_phone} label="Copy" />
            </div>
          ) : null}
          {method.account_reference ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
              <div className="min-w-0">
                <dt className="text-slate-500">Reference</dt>
                <dd className="truncate font-semibold text-ink">{method.account_reference}</dd>
              </div>
              <CopyButton className="btn btn-secondary btn-xs shrink-0" value={method.account_reference} label="Copy" />
            </div>
          ) : null}
        </dl>

        {(method.qr_image_path?.trim() || safeExternal) && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            {method.qr_image_path?.trim() ? (
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="text-center sm:text-left">
                  <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <QrCode className="h-3.5 w-3.5" aria-hidden />
                    Scan to pay
                  </p>
                  <SafePaymentQrImage srcRaw={method.qr_image_path} alt={`${title} QR`} />
                </div>
                <div className="max-w-xs flex-1 space-y-2 text-center text-[11px] leading-relaxed text-slate-600 sm:text-left">
                  <p>Center the QR inside your payment app. If this page is open on the paying phone, use the copied receiver details instead.</p>
                  <p>After payment, save the confirmation screen before uploading proof.</p>
                </div>
              </div>
            ) : null}
            {safeExternal ? (
              <a href={safeExternal} target="_blank" rel="noopener noreferrer" className="btn btn-secondary mt-3 w-full text-xs sm:w-auto">
                Open payment link
              </a>
            ) : null}
          </div>
        )}

        <ExpandableInstructions text={method.instructions} copyLabel="Copy instructions" />

        <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/40 px-3 py-2">
          <div className="flex gap-2">
            <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            <div>
              <MethodTrustFootnote variant={variant} />
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                Review timing depends on the business. Uploading proof does not mark the invoice paid by itself.
              </p>
            </div>
          </div>
        </div>

        <a href={uploadHref} className="btn btn-secondary w-full text-xs">
          <UploadCloud className="h-4 w-4" aria-hidden />
          After paying, upload proof
        </a>
      </div>
    </article>
  );
}
