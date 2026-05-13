"use client";

import { approveInvoiceByTokenAction, rejectInvoiceByTokenAction } from "@/app/actions";
import { useState } from "react";
import { toast } from "sonner";

interface ClientApprovalBoxProps {
  documentType?: "invoice" | "quote";
  token: string;
}

export function ClientApprovalBox({ documentType = "invoice", token }: ClientApprovalBoxProps) {
  const [isPending, setIsPending] = useState(false);
  const label = documentType === "quote" ? "Quote" : "Invoice";
  const lowerLabel = label.toLowerCase();

  const handleAction = async (formData: FormData, action: typeof approveInvoiceByTokenAction) => {
    const name = formData.get("name") as string;
    if (!name?.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    setIsPending(true);
    try {
      await action(formData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process approval.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="panel border-cedar bg-cedar/5 p-6 mb-6">
      <h2 className="text-xl font-bold text-ink">{label} Approval</h2>
      <p className="mt-1 text-sm text-slate-600">
        Please review the {lowerLabel} details and {documentType === "quote" ? "approve or reject this estimate." : "approve before making a payment."}
      </p>
      
      <div className="mt-4 grid gap-4">
        <div>
          <label className="label" htmlFor="client_name">
            Your Name
          </label>
          <input 
            className="field" 
            id="client_name" 
            name="name" 
            required 
            placeholder="e.g. John Doe"
            disabled={isPending}
            form="approval-form"
          />
        </div>
        <div>
          <label className="label" htmlFor="client_note">
            Note (optional)
          </label>
          <textarea 
            className="field min-h-20" 
            id="client_note" 
            name="note" 
            placeholder="Any feedback or confirmation..."
            disabled={isPending}
            form="approval-form"
          />
        </div>
        
        <form id="approval-form" className="flex gap-3">
          <input name="token" type="hidden" value={token} />
          <button 
            className="btn btn-primary flex-1" 
            formAction={(fd) => handleAction(fd, approveInvoiceByTokenAction)}
            disabled={isPending}
          >
            {isPending ? "Processing..." : `Approve ${label}`}
          </button>
          <button 
            className="btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex-1" 
            formAction={(fd) => handleAction(fd, rejectInvoiceByTokenAction)}
            disabled={isPending}
          >
            {isPending ? "Processing..." : "Reject"}
          </button>
        </form>
      </div>
    </div>
  );
}
