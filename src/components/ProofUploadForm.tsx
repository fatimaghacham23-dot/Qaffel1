"use client";

import { useEffect, useRef, useState } from "react";
import { uploadProofAction } from "@/app/actions";
import type { PublicPaymentMethodOption } from "@/lib/public-pay-method";
import { toast } from "sonner";
import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicLang } from "@/lib/i18n-public";

interface ProofUploadFormProps {
  token: string;
  methods: PublicPaymentMethodOption[];
  defaultAmountUsd?: number | null;
  defaultAmountLbp?: number | null;
  defaultMethodLabel?: string | null;
  lang?: PublicLang;
}

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];


const uploadCopy = {
  en: {
    missing: "Please upload a screenshot or receipt.", invalid: "Please upload a JPG, PNG, WebP, or PDF file.", tooLarge: "File is too large. Maximum size is 5MB.",
    amountUsd: "Payment amount USD must be greater than 0.", amountLbp: "Payment amount LBP must be greater than 0.", failed: "Failed to upload proof.",
    amountUsdLabel: "Amount paid USD", amountLbpLabel: "Amount paid LBP", paymentDate: "Payment date", method: "Method used", selectMethod: "Select method",
    proof: "Screenshot or PDF", note: "Note (optional)", upload: "Submit payment proof", choose: "Choose proof to continue", uploading: "Uploading...",
    ready: "Proof ready to submit", tap: "Tap to choose a receipt or screenshot", selected: "Selected:", remove: "Remove selected proof",
    what: "What happens after upload?", review: "Uploads are reviewed manually and are never auto-approved.", attached: "Your proof is attached to this invoice for the business to review.", accepted: "JPG, PNG, WebP, or PDF - max 5 MB", optionalPartial: "Optional, but helpful for partial payments.", optionalLbp: "Optional, but helpful for LBP transfers.", reviewBeforeSubmit: "Review the amount and method above, then submit.", proofHint: "A clear receipt, transfer confirmation, or payment screenshot works best.", preview: "Upload preview", notePlaceholder: "Reference, sender name, or other context...", balanceUpdate: "Once accepted, the invoice balance updates and a receipt can be issued."
  },
  ar: {
    missing: "\u064a\u0631\u062c\u0649 \u0631\u0641\u0639 \u0644\u0642\u0637\u0629 \u0634\u0627\u0634\u0629 \u0623\u0648 \u0625\u064a\u0635\u0627\u0644.", invalid: "\u064a\u0631\u062c\u0649 \u0631\u0641\u0639 \u0645\u0644\u0641 JPG \u0623\u0648 PNG \u0623\u0648 WebP \u0623\u0648 PDF.", tooLarge: "\u0627\u0644\u0645\u0644\u0641 \u0643\u0628\u064a\u0631 \u062c\u062f\u0627\u064b. \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 5 \u0645\u064a\u063a\u0627\u0628\u0627\u064a\u062a.",
    amountUsd: "\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0645\u0628\u0644\u063a \u0627\u0644\u062f\u0641\u0639 \u0628\u0627\u0644\u062f\u0648\u0644\u0627\u0631 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631.", amountLbp: "\u064a\u062c\u0628 \u0623\u0646 \u064a\u0643\u0648\u0646 \u0645\u0628\u0644\u063a \u0627\u0644\u062f\u0641\u0639 \u0628\u0627\u0644\u0644\u064a\u0631\u0629 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631.", failed: "\u062a\u0639\u0630\u0631 \u0631\u0641\u0639 \u0625\u062b\u0628\u0627\u062a \u0627\u0644\u062f\u0641\u0639.",
    amountUsdLabel: "\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u062f\u0641\u0648\u0639 \u0628\u0627\u0644\u062f\u0648\u0644\u0627\u0631", amountLbpLabel: "\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u062f\u0641\u0648\u0639 \u0628\u0627\u0644\u0644\u064a\u0631\u0629", paymentDate: "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062f\u0641\u0639", method: "\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639", selectMethod: "\u0627\u062e\u062a\u0631 \u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639",
    proof: "\u0644\u0642\u0637\u0629 \u0634\u0627\u0634\u0629 \u0623\u0648 \u0645\u0644\u0641 PDF", note: "\u0645\u0644\u0627\u062d\u0638\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)", upload: "\u0625\u0631\u0633\u0627\u0644 \u0625\u062b\u0628\u0627\u062a \u0627\u0644\u062f\u0641\u0639", choose: "\u0627\u062e\u062a\u0631 \u0625\u062b\u0628\u0627\u062a\u0627\u064b \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629", uploading: "\u062c\u0627\u0631\u064d \u0627\u0644\u0631\u0641\u0639...",
    ready: "\u0625\u062b\u0628\u0627\u062a \u0627\u0644\u062f\u0641\u0639 \u062c\u0627\u0647\u0632 \u0644\u0644\u0625\u0631\u0633\u0627\u0644", tap: "\u0627\u0636\u063a\u0637 \u0644\u0627\u062e\u062a\u064a\u0627\u0631 \u0625\u064a\u0635\u0627\u0644 \u0623\u0648 \u0644\u0642\u0637\u0629 \u0634\u0627\u0634\u0629", selected: "\u062a\u0645 \u0627\u0644\u0627\u062e\u062a\u064a\u0627\u0631:", remove: "\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0625\u062b\u0628\u0627\u062a \u0627\u0644\u0645\u062d\u062f\u062f",
    what: "\u0645\u0627\u0630\u0627 \u064a\u062d\u062f\u062b \u0628\u0639\u062f \u0627\u0644\u0631\u0641\u0639\u061f", review: "\u062a\u062a\u0645 \u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0625\u062b\u0628\u0627\u062a\u0627\u062a \u064a\u062f\u0648\u064a\u0627\u064b \u0648\u0644\u0627 \u062a\u062a\u0645 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u064a\u0647\u0627 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b.", attached: "\u064a\u0631\u062a\u0628\u0637 \u0625\u062b\u0628\u0627\u062a\u0643 \u0628\u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0644\u064a\u0631\u0627\u062c\u0639\u0647 \u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062a\u062c\u0627\u0631\u064a.", accepted: "JPG\u060c PNG\u060c WebP \u0623\u0648 PDF \u2014 \u0628\u062d\u062f \u0623\u0642\u0635\u0649 5 \u0645\u064a\u063a\u0627\u0628\u0627\u064a\u062a", optionalPartial: "\u0627\u062e\u062a\u064a\u0627\u0631\u064a\u060c \u0648\u0644\u0643\u0646\u0647 \u0645\u0641\u064a\u062f \u0644\u0644\u062f\u0641\u0639\u0627\u062a \u0627\u0644\u062c\u0632\u0626\u064a\u0629.", optionalLbp: "\u0627\u062e\u062a\u064a\u0627\u0631\u064a\u060c \u0648\u0644\u0643\u0646\u0647 \u0645\u0641\u062f \u0644\u0644\u062a\u062d\u0648\u064a\u0644\u0627\u062a \u0628\u0627\u0644\u0644\u064a\u0631\u0629 \u0627\u0644\u0644\u0628\u0646\u0627\u0646\u064a\u0629.", reviewBeforeSubmit: "\u0631\u0627\u062c\u0639 \u0627\u0644\u0645\u0628\u0644\u063a \u0648\u0627\u0644\u0637\u0631\u064a\u0642\u0629 \u062b\u0645 \u0623\u0631\u0633\u0644 \u0627\u0644\u0625\u062b\u0628\u0627\u062a.", proofHint: "\u0627\u0633\u062a\u062e\u062f\u0645 \u0625\u064a\u0635\u0627\u0644\u0627\u064b \u0648\u0627\u0636\u062d\u0627\u064b \u0623\u0648 \u062a\u0623\u0643\u064a\u062f \u062a\u062d\u0648\u064a\u0644 \u0623\u0648 \u0644\u0642\u0637\u0629 \u0634\u0627\u0634\u0629.", preview: "\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0645\u0644\u0641", notePlaceholder: "\u0627\u0644\u0645\u0631\u062c\u0639 \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u0633\u0644 \u0623\u0648 \u0623\u064a \u0633\u064a\u0627\u0642 \u0622\u062e\u0631...", balanceUpdate: "\u0628\u0639\u062f \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629\u060c \u064a\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0631\u0635\u064a\u062f \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 \u0648\u064a\u0645\u0643\u0646 \u0625\u0635\u062f\u0627\u0631 \u0625\u064a\u0635\u0627\u0644."
  }
} as const;

export function ProofUploadForm({ token, methods, defaultAmountUsd, defaultAmountLbp, defaultMethodLabel, lang = "en" }: ProofUploadFormProps) {
  const copy = uploadCopy[lang];
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewBlobRef = useRef<string | null>(null);
  const uploadLockRef = useRef(false);
  const canSubmit = Boolean(file) && !isUploading;

  useEffect(() => {
    const dateTimer = window.setTimeout(() => {
      setPaymentDate(new Date().toISOString().split("T")[0]);
    }, 0);

    return () => {
      window.clearTimeout(dateTimer);
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
      }
    };
  }, []);

  const clearPreview = () => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    setFile(null);
    setPreviewUrl(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleSubmit = async (formData: FormData) => {
    if (uploadLockRef.current) return;

    const formFile = formData.get("proof");
    const f = formFile instanceof File && formFile.size > 0 ? formFile : file;

    if (!f || f.size === 0) {
      toast.error(copy.missing);
      return;
    }

    if (!ACCEPT.includes(f.type)) {
      toast.error(copy.invalid);
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (f.size > maxSize) {
      toast.error(copy.tooLarge);
      return;
    }

    const amountUsd = formData.get("amount_usd") as string;
    const amountLbp = formData.get("amount_lbp") as string;

    if (amountUsd && parseFloat(amountUsd) <= 0) {
      toast.error(copy.amountUsd);
      return;
    }

    if (amountLbp && parseInt(amountLbp, 10) <= 0) {
      toast.error(copy.amountLbp);
      return;
    }

    formData.set("proof", f);

    uploadLockRef.current = true;
    setIsUploading(true);
    try {
      await uploadProofAction(formData);
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.failed;
      if (typeof message === "string" && message.toLowerCase().includes("duplicate")) {
        toast.warning(message);
      } else {
        toast.error(message);
      }
      uploadLockRef.current = false;
      setIsUploading(false);
    }
  };

  const onPick = (nextFile: File | null, syncInput = false) => {
    if (!nextFile || nextFile.size === 0) {
      clearPreview();
      return;
    }

    if (syncInput && inputRef.current) {
      try {
        const dt = new DataTransfer();
        dt.items.add(nextFile);
        inputRef.current.files = dt.files;
      } catch {
        // Some mobile browsers do not allow assigning FileList. State still carries the file.
      }
    }

    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }

    setFile(nextFile);
    if (nextFile.type === "application/pdf") {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(nextFile);
    previewBlobRef.current = url;
    setPreviewUrl(url);
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-700 shadow-sm">
        <p className="font-semibold text-ink">{copy.what}</p>
        <ol className="mt-2 grid gap-2">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cedar" aria-hidden />
            <span>{copy.attached}</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cedar" aria-hidden />
            <span>{copy.review}</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cedar" aria-hidden />
            <span>{copy.balanceUpdate}</span>
          </li>
        </ol>
      </div>

      <form ref={formRef} action={handleSubmit} className="mt-4 grid gap-4 pb-24 sm:pb-0">
        <input name="token" type="hidden" value={token} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="amount_usd">
              {copy.amountUsdLabel}
            </label>
            <input
              className="field"
              id="amount_usd"
              name="amount_usd"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Example: 100"
              defaultValue={defaultAmountUsd || ""}
              disabled={isUploading}
            />
            <p className="mt-1 text-[10px] text-slate-500">{copy.optionalPartial}</p>
          </div>
          <div>
            <label className="label" htmlFor="amount_lbp">
              {copy.amountLbpLabel}
            </label>
            <input
              className="field"
              id="amount_lbp"
              name="amount_lbp"
              type="number"
              step="1"
              min="1"
              placeholder="Example: 9000000"
              defaultValue={defaultAmountLbp || ""}
              disabled={isUploading}
            />
            <p className="mt-1 text-[10px] text-slate-500">{copy.optionalLbp}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="payment_date">
              {copy.paymentDate}
            </label>
            <input
              className="field"
              id="payment_date"
              name="payment_date"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
              disabled={isUploading}
            />
          </div>
          <div>
            <label className="label" htmlFor="method">
              {copy.method}
            </label>
            <select className="field" id="method" name="method" defaultValue={defaultMethodLabel || (methods?.length === 1 ? methods[0].label : "")} disabled={isUploading}>
              {methods?.length !== 1 && <option value="">{copy.selectMethod}</option>}
              {(methods || []).map((method, index) => (
                <option key={`${method.label}-${index}`} value={method.label}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label className="label mb-0" htmlFor="proof">
              {copy.proof}
            </label>
            <span className="text-[10px] font-semibold text-slate-500">{copy.accepted}</span>
          </div>
          <input
            ref={inputRef}
            accept={ACCEPT.join(",")}
            className="sr-only"
            id="proof"
            name="proof"
            type="file"
            disabled={isUploading}
            onChange={(event) => onPick(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className={cn(
              "relative flex min-h-[168px] w-full touch-manipulation flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-4 py-6 text-center shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-q",
              dragOver ? "border-cedar bg-cedar/5 shadow-card" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-card",
              isUploading && "pointer-events-none opacity-60"
            )}
            onDragLeave={() => setDragOver(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) onPick(dropped, true);
            }}
            onClick={() => inputRef.current?.click()}
          >
            {file?.type === "application/pdf" ? (
              <FileText className="h-8 w-8 text-cedar" aria-hidden />
            ) : (
              <UploadCloud className="h-8 w-8 text-cedar" aria-hidden />
            )}
            <span className="text-sm font-semibold text-ink">{file ? copy.ready : copy.tap}</span>
            <span className="max-w-xs text-xs leading-relaxed text-slate-500">
              {file ? copy.reviewBeforeSubmit : copy.proofHint}
            </span>
          </button>

          {file ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <p className="min-w-0 font-medium">
                {copy.selected} <span className="break-all">{file.name}</span> ({(file.size / 1024).toFixed(0)} KB)
              </p>
              <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500" onClick={clearPreview} disabled={isUploading} aria-label={copy.remove}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}

          {previewUrl ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- client preview blob URL */}
              <img src={previewUrl} alt={copy.preview} className="mx-auto max-h-48 w-auto object-contain" />
            </div>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="note">
            {copy.note}
          </label>
          <textarea className="field min-h-24" id="note" name="note" disabled={isUploading} placeholder={copy.notePlaceholder} />
        </div>

        {isUploading ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200" aria-busy aria-live="polite">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-cedar" />
          </div>
        ) : null}

        <div className="hidden sm:block">
          <button className="btn btn-primary w-full touch-manipulation py-3 text-sm font-bold sm:py-2.5" type="submit" disabled={!canSubmit}>
            {isUploading ? copy.uploading : file ? copy.upload : copy.choose}
          </button>
        </div>
      </form>

      <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/90 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-14px_36px_-22px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:hidden print:hidden">
        <div className="pointer-events-auto mx-auto max-w-lg">
          <button
            type="button"
            className="btn btn-primary w-full touch-manipulation py-3 text-sm font-bold"
            disabled={!canSubmit}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {isUploading ? copy.uploading : file ? copy.upload : copy.choose}
          </button>
        </div>
      </div>
    </>
  );
}
