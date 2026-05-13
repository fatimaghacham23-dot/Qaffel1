"use client";

import { cn } from "@/lib/utils";

type PrintReceiptButtonProps = {
  className?: string;
  label?: string;
};

export function PrintReceiptButton({
  className,
  label = "Print Receipt",
}: PrintReceiptButtonProps) {
  return (
    <button
      type="button"
      className={cn(className)}
      onClick={() => typeof window !== "undefined" && window.print()}
    >
      {label}
    </button>
  );
}
