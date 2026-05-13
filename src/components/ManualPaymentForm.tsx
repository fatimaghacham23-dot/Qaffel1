"use client";

import { useTransition, useRef, useState } from "react";
import { toast } from "sonner";
import { createManualPaymentAction } from "@/app/actions";
import { todayIso } from "@/lib/format";

export function ManualPaymentForm({ invoiceId, isPaid }: { invoiceId: string; isPaid?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      try {
        await createManualPaymentAction(formData);
        toast.success("Payment recorded successfully!");
        formRef.current?.reset();
        setShowForm(false);
      } catch (error: any) {
        const message = error?.message || "Failed to record payment";
        if (
          typeof message === "string" &&
          message.toLowerCase().includes("duplicate payment") &&
          !String(formData.get("allow_duplicate") || "").includes("1")
        ) {
          const confirmed = window.confirm(`${message}\n\nDo you want to record it anyway?`);
          if (confirmed) {
            const retryData = new FormData();
            for (const [key, value] of formData.entries()) {
              retryData.append(key, value);
            }
            retryData.set("allow_duplicate", "1");

            try {
              await createManualPaymentAction(retryData);
              toast.success("Payment recorded successfully!");
              formRef.current?.reset();
              setShowForm(false);
              return;
            } catch (retryError: any) {
              toast.error(retryError?.message || "Failed to record payment");
              return;
            }
          }
        }

        toast.error(message);
      }
    });
  };

  if (isPaid && !showForm) {
    return (
      <div className="panel bg-emerald-50/50 border-emerald-100 flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-emerald-800 italic">
          This invoice is fully paid.
        </p>
        <button 
          onClick={() => setShowForm(true)}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline decoration-emerald-200"
        >
          Record additional payment
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-ink">Record manual payment</h2>
        {showForm && (
          <button 
            onClick={() => setShowForm(false)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Record a payment received directly (Cash, Whish, OMT, etc.)
      </p>
      
      <form action={handleSubmit} ref={formRef} className="grid gap-4">
        <input type="hidden" name="invoice_id" value={invoiceId} />
        <input type="hidden" name="allow_duplicate" value="0" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="manual_amount_usd">Amount USD</label>
            <input 
              className="field" 
              id="manual_amount_usd" 
              name="amount_usd" 
              type="number" 
              step="0.01" 
              min="0.01" 
              placeholder="Example: 100"
            />
          </div>
          <div>
            <label className="label" htmlFor="manual_amount_lbp">Amount LBP</label>
            <input 
              className="field" 
              id="manual_amount_lbp" 
              name="amount_lbp" 
              type="number" 
              step="1" 
              min="1" 
              placeholder="Example: 9000000"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="manual_payment_date">Payment date</label>
            <input 
              className="field" 
              id="manual_payment_date" 
              name="payment_date" 
              type="date" 
              defaultValue={todayIso()}
            />
          </div>
          <div>
            <label className="label" htmlFor="manual_method">Method</label>
            <input 
              className="field" 
              id="manual_method" 
              name="method" 
              type="text" 
              placeholder="Cash, Whish, Bank, etc." 
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="manual_note">Note (Optional)</label>
          <textarea 
            className="field min-h-20" 
            id="manual_note" 
            name="note" 
            placeholder="Any additional details..."
          />
        </div>

        <button 
          className="btn btn-primary w-fit" 
          type="submit" 
          disabled={isPending}
        >
          {isPending ? "Recording..." : "Record payment"}
        </button>
      </form>
    </div>
  );
}
