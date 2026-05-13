"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { resolveSafeQrImageSrc } from "@/lib/safe-qr-url";

const FALLBACK = "QR unavailable — use phone/account details.";

type Props = {
  srcRaw: string | null | undefined;
  alt: string;
  className?: string;
};

/**
 * Public pay-page QR renderer: validates src, loading/error UI, no raw path leakage on failure.
 * Remote HTTPS uses native img (tenant-defined hosts; avoids remotePatterns maintenance).
 */
export function SafePaymentQrImage({ srcRaw, alt, className }: Props) {
  const resolved = useMemo(() => resolveSafeQrImageSrc(srcRaw), [srcRaw]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  if (!srcRaw?.trim()) {
    return null;
  }

  if (!resolved) {
    return <p className="text-xs leading-snug text-slate-600">{FALLBACK}</p>;
  }

  const box = "relative h-32 w-32 overflow-hidden rounded-md border border-slate-200 bg-white";
  const imgClass = `object-contain ${className ?? ""}`.trim();

  const onError = () => setPhase("error");
  const onLoad = () => setPhase("ready");

  if (phase === "error") {
    return <p className="text-xs leading-snug text-slate-600">{FALLBACK}</p>;
  }

  return (
    <div className="space-y-2">
      <div className={box}>
        {phase === "loading" ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-slate-100"
            aria-hidden
          />
        ) : null}
        {resolved.kind === "relative" ? (
          <Image
            src={resolved.path}
            alt={alt}
            fill
            sizes="128px"
            className={`z-0 ${imgClass}`}
            unoptimized
            onLoad={onLoad}
            onError={onError}
            priority={false}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- HTTPS/data QR hosts are workspace-defined; src is validated in resolveSafeQrImageSrc
          <img
            src={resolved.kind === "https" ? resolved.href : resolved.dataUrl}
            alt={alt}
            className={`relative z-0 h-full w-full ${imgClass}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={onLoad}
            onError={onError}
          />
        )}
      </div>
      {phase === "loading" ? (
        <p className="text-[10px] text-slate-500" aria-live="polite">
          Loading QR…
        </p>
      ) : null}
    </div>
  );
}
