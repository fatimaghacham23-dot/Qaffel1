"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Maximize2, X } from "lucide-react";

type ProofImagePreviewProps = {
  imageUrl: string;
  alt?: string;
  /** Thumbnail size class */
  thumbClassName?: string;
};

export function ProofImagePreview({ imageUrl, alt = "Payment proof", thumbClassName = "h-24 w-28" }: ProofImagePreviewProps) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setZoomed(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const isPdf = imageUrl.toLowerCase().includes(".pdf");

  if (isPdf) {
    return (
      <a
        className={`grid ${thumbClassName} place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-cedar/30`}
        href={imageUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="text-[10px] font-semibold">PDF</span>
        <span className="sr-only">Open proof PDF</span>
      </a>
    );
  }

  return (
    <>
      <div className="relative inline-block touch-manipulation">
        <button
          type="button"
          className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left shadow-sm transition hover:border-cedar/40 ${thumbClassName}`}
          onClick={() => setOpen(true)}
        >
          <Image src={imageUrl} alt={alt} fill className="object-cover" sizes="120px" unoptimized />
          <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            <Maximize2 className="h-2.5 w-2.5" aria-hidden />
            Zoom
          </span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/80 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Proof image preview"
          onClick={close}
        >
          <div className="mx-auto flex min-w-0 w-full max-w-4xl flex-1 flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-2 text-white sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold sm:text-sm">Pinch or scroll to inspect · tap outside to close</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25"
                  onClick={() => setZoomed((z) => !z)}
                >
                  {zoomed ? "Fit" : "Zoom"}
                </button>
                <a
                  className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25"
                  href={imageUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open full image
                </a>
                <button
                  type="button"
                  className="rounded-lg bg-white/15 p-2 text-white hover:bg-white/25"
                  aria-label="Close"
                  onClick={close}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div
              className="relative min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl bg-black touch-pan-x touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <div
                className={`flex min-h-full min-w-full items-center justify-center p-2 ${zoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
                onClick={() => setZoomed((z) => !z)}
              >
                {/* Native img: CSS zoom + arbitrary signed URLs */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={alt}
                  className={`max-h-[85vh] w-auto max-w-none rounded-lg object-contain shadow-2xl transition-transform duration-200 ${
                    zoomed ? "scale-[1.75] sm:scale-150" : "scale-100"
                  }`}
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
