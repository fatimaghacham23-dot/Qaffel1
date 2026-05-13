"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "btn btn-secondary text-xs"
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  return (
    <button onClick={handleCopy} className={className} type="button">
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? copiedLabel : label}
    </button>
  );
}
