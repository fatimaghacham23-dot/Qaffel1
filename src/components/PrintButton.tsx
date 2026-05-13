"use client";

import { Printer } from "lucide-react";

interface PrintButtonProps {
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function PrintButton({ 
  label = "Print invoice", 
  className = "btn btn-primary", 
  showIcon = false 
}: PrintButtonProps) {
  return (
    <button
      onClick={() => window.print()}
      className={`${className} inline-flex items-center gap-2 print:hidden`}
      type="button"
    >
      {showIcon && <Printer size={14} />}
      {label}
    </button>
  );
}
