"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1600);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  }, [value]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        className,
        "transition-[transform,box-shadow,background-color] duration-q",
        copied && "border-emerald-200/90 bg-emerald-50/90 text-emerald-900 shadow-sm"
      )}
      type="button"
      aria-live="polite"
      aria-label={copied ? copiedLabel : label}
    >
      <span className={cn("inline-flex items-center gap-1.5", copied && "motion-safe:animate-q-success-pop")}>
        {copied ? <Check className="h-4 w-4 text-emerald-700" aria-hidden="true" /> : <Copy className="h-4 w-4 opacity-70" aria-hidden="true" />}
        <span>{copied ? copiedLabel : label}</span>
      </span>
    </button>
  );
}
