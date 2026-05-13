"use client";

import { useState, useRef } from "react";
import { uploadProofAction } from "@/app/actions";
import type { PublicPaymentMethodOption } from "@/lib/public-pay-method";
import { toast } from "sonner";

interface ProofUploadFormProps {
  token: string;
  methods: PublicPaymentMethodOption[];
  defaultAmountUsd?: number | null;
  defaultAmountLbp?: number | null;
  defaultMethodLabel?: string | null;
}

export function ProofUploadForm({ token, methods, defaultAmountUsd, defaultAmountLbp, defaultMethodLabel }: ProofUploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    const file = formData.get("proof") as File;
    
    if (!file || file.size === 0) {
      toast.error("Please upload a screenshot or receipt.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a JPG, PNG, WebP, or PDF file.");
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size is 5MB.");
      return;
    }

    const amountUsd = formData.get("amount_usd") as string;
    const amountLbp = formData.get("amount_lbp") as string;

    if (amountUsd && (parseFloat(amountUsd) <= 0)) {
      toast.error("Payment amount USD must be greater than 0.");
      return;
    }

    if (amountLbp && (parseInt(amountLbp) <= 0)) {
      toast.error("Payment amount LBP must be greater than 0.");
      return;
    }

    setIsUploading(true);
    try {
      await uploadProofAction(formData);
      // Success is handled by server redirect
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

  return (
    <form ref={formRef} action={handleSubmit} className="mt-4 grid gap-4">
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
          <p className="mt-1 text-[10px] text-slate-500 italic">Optional, but helps the business track partial payments.</p>
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
          <p className="mt-1 text-[10px] text-slate-500 italic">Optional, but helps the business track partial payments.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="payment_date">
            Payment date
          </label>
          <input 
            className="field" 
            id="payment_date" 
            name="payment_date" 
            type="date" 
            defaultValue={new Date().toISOString().split('T')[0]}
            disabled={isUploading}
          />
        </div>
        <div>
          <label className="label" htmlFor="method">
            Method used
          </label>
          <select
            className="field"
            id="method"
            name="method"
            defaultValue={defaultMethodLabel || (methods?.length === 1 ? methods[0].label : "")}
          >
            {methods?.length !== 1 && <option value="">Select method</option>}
            {(methods || []).map((method, idx) => (
              <option key={`${method.label}-${idx}`} value={method.label}>
                {method.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="proof">
          Screenshot or PDF
        </label>
        <input 
          accept="image/jpeg,image/png,image/webp,application/pdf" 
          className="field" 
          id="proof" 
          name="proof" 
          required 
          type="file" 
          disabled={isUploading}
        />
        <p className="mt-1 text-[10px] text-slate-500 italic">JPG, PNG, WebP, or PDF. Max 5MB.</p>
      </div>
      <div>
        <label className="label" htmlFor="note">
          Note (optional)
        </label>
        <textarea 
          className="field min-h-24" 
          id="note" 
          name="note" 
          disabled={isUploading}
          placeholder="Any additional details..."
        />
      </div>
      <button 
        className="btn btn-primary w-full" 
        type="submit" 
        disabled={isUploading}
      >
        {isUploading ? "Uploading..." : "Upload proof"}
      </button>
    </form>
  );
}
