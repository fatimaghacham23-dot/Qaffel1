"use client";

import { useState } from "react";
import { monogramFromName } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function BusinessLogoOrMonogram({
  logoUrl,
  businessName,
  className,
  monogramClassName
}: {
  logoUrl: string | null;
  businessName: string;
  className?: string;
  monogramClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const mono = monogramFromName(businessName);

  if (!logoUrl || failed) {
    return (
      <div
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-slate-200/80 bg-white text-sm font-black shadow-sm",
          monogramClassName
        )}
        style={{ color: "var(--brand-primary, #116466)" }}
        aria-hidden
      >
        {mono}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL from private bucket; no next/image remotePatterns for dynamic hosts
    <img
      src={logoUrl}
      alt=""
      className={cn("h-12 w-auto max-w-[140px] shrink-0 object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}
