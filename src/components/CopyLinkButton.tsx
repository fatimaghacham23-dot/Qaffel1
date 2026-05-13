"use client";

import { CopyButton } from "@/components/CopyButton";

type CopyLinkButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

export function CopyLinkButton({
  value,
  label = "Copy link",
  copiedLabel = "Copied",
  className,
}: CopyLinkButtonProps) {
  return <CopyButton value={value} label={label} copiedLabel={copiedLabel} className={className} />;
}
