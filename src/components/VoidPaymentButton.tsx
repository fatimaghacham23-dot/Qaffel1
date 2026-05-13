"use client";

import { useTransition } from "react";
import { voidPaymentAction } from "@/app/actions";
import { toast } from "sonner";

interface VoidPaymentButtonProps {
  proofId: string;
}

export function VoidPaymentButton({ proofId }: VoidPaymentButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleVoid = async () => {
    const reason = window.prompt("Why are you voiding this payment? (Optional)");
    if (reason === null) return; // User cancelled

    if (!window.confirm("Are you sure you want to void this payment? This will update the invoice balance.")) {
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("proof_id", proofId);
        if (reason) formData.append("reason", reason);

        await voidPaymentAction(formData);
        toast.success("Payment voided successfully");
      } catch (error: any) {
        toast.error(error.message || "Failed to void payment");
      }
    });
  };

  return (
    <button
      onClick={handleVoid}
      disabled={isPending}
      className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
      type="button"
    >
      {isPending ? "Voiding..." : "Void payment"}
    </button>
  );
}
