"use client";

import { cn } from "@/lib/utils";

type DeleteInvoiceButtonProps = {
  className?: string;
  label?: string;
  confirmMessage?: string;
};

export function DeleteInvoiceButton({
  className,
  label = "Delete invoice",
  confirmMessage = "Delete forever?",
}: DeleteInvoiceButtonProps) {
  return (
    <button
      className={cn(className)}
      type="submit"
      onClick={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
