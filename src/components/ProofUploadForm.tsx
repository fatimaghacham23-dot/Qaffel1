"use client";

import { useEffect, useRef, useState } from "react";
import { uploadProofAction } from "@/app/actions";
import type { PublicPaymentMethodOption } from "@/lib/public-pay-method";
import { toast } from "sonner";
import { CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProofUploadFormProps {
  token: string;
  methods: PublicPaymentMethodOption[];
  defaultAmountUsd?: number | null;
  defaultAmountLbp?: number | null;
  defaultMethodLabel?: string | null;
}

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ACCEPT_LABEL = "JPG, PNG, WebP, or PDF - max 5 MB";

export function ProofUploadForm({ token, methods, defaultAmountUsd, defaultAmountLbp, defaultMethodLabel }: ProofUploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewBlobRef = useRef<string | null>(null);
  const canSubmit = Boolean(file) && !isUploading;

  useEffect(() => {
    return () => {
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
    const formFile = formData.get("proof");
    const f = formFile instanceof File && formFile.size > 0 ? formFile : file;

    if (!f || f.size === 0) {
      toast.error("Please upload a screenshot or receipt.");
      return;
    }

    if (!ACCEPT.includes(f.type)) {
      toast.error("Please upload a JPG, PNG, WebP, or PDF file.");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (f.size > maxSize) {
      toast.error("File is too large. Maximum size is 5MB.");
      return;
    }

    const amountUsd = formData.get("amount_usd") as string;
    const amountLbp = formData.get("amount_lbp") as string;

    if (amountUsd && parseFloat(amountUsd) <= 0) {
      toast.error("Payment amount USD must be greater than 0.");
      return;
    }

    if (amountLbp && parseInt(amountLbp, 10) <= 0) {
      toast.error("Payment amount LBP must be greater than 0.");
      return;
    }

    formData.set("proof", f);

    setIsUploading(true);
    try {
      await uploadProofAction(formData);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload proof.";
      if (typeof message === "string" && message.toLowerCase().includes("duplicate")) {
        toast.warning(message);
      } else {
        toast.error(message);
      }
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
        <p className="font-semibold text-ink">What happens after upload?</p>
        <ol className="mt-2 grid gap-2">
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cedar" aria-hidden />
            <span>Your proof is attached to this invoice for the business to review.</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cedar" aria-hidden />
            <span>Uploads are reviewed manually and are never auto-approved.</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cedar" aria-hidden />
            <span>Once accepted, the invoice balance updates and a receipt can be issued.</span>
          </li>
        </ol>
      </div>

      <form ref={formRef} action={handleSubmit} className="mt-4 grid gap-4 pb-24 sm:pb-0">
        <input name="token" type="hidden" value={token} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="amount_usd">
              Amount paid USD
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
            <p className="mt-1 text-[10px] text-slate-500">Optional, but helpful for partial payments.</p>
          </div>
          <div>
            <label className="label" htmlFor="amount_lbp">
              Amount paid LBP
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
            <p className="mt-1 text-[10px] text-slate-500">Optional, but helpful for LBP transfers.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="payment_date">
              Payment date
            </label>
            <input className="field" id="payment_date" name="payment_date" type="date" defaultValue={new Date().toISOString().split("T")[0]} disabled={isUploading} />
          </div>
          <div>
            <label className="label" htmlFor="method">
              Method used
            </label>
            <select className="field" id="method" name="method" defaultValue={defaultMethodLabel || (methods?.length === 1 ? methods[0].label : "")} disabled={isUploading}>
              {methods?.length !== 1 && <option value="">Select method</option>}
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
              Screenshot or PDF
            </label>
            <span className="text-[10px] font-semibold text-slate-500">{ACCEPT_LABEL}</span>
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
            <span className="text-sm font-semibold text-ink">{file ? "Proof ready to submit" : "Tap to choose a receipt or screenshot"}</span>
            <span className="max-w-xs text-xs leading-relaxed text-slate-500">
              {file ? "Review the amount and method above, then submit." : "A clear receipt, transfer confirmation, or payment screenshot works best."}
            </span>
          </button>

          {file ? (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <p className="min-w-0 font-medium">
                Selected: <span className="break-all">{file.name}</span> ({(file.size / 1024).toFixed(0)} KB)
              </p>
              <button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500" onClick={clearPreview} disabled={isUploading} aria-label="Remove selected proof">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : null}

          {previewUrl ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- client preview blob URL */}
              <img src={previewUrl} alt="Upload preview" className="mx-auto max-h-48 w-auto object-contain" />
            </div>
          ) : null}
        </div>

        <div>
          <label className="label" htmlFor="note">
            Note (optional)
          </label>
          <textarea className="field min-h-24" id="note" name="note" disabled={isUploading} placeholder="Reference, sender name, or other context..." />
        </div>

        {isUploading ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200" aria-busy aria-live="polite">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-cedar" />
          </div>
        ) : null}

        <div className="hidden sm:block">
          <button className="btn btn-primary w-full touch-manipulation py-3 text-sm font-bold sm:py-2.5" type="submit" disabled={!canSubmit}>
            {isUploading ? "Uploading..." : file ? "Submit payment proof" : "Choose proof to continue"}
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
            {isUploading ? "Uploading..." : file ? "Submit payment proof" : "Choose proof to continue"}
          </button>
        </div>
      </div>
    </>
  );
}
