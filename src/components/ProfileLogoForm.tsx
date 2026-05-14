"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { uploadBusinessLogoAction, removeBusinessLogoAction } from "@/app/actions";

export function ProfileLogoForm({ hasLogo }: { hasLogo: boolean }) {
  const [pending, start] = useTransition();

  const onPick = (f: FileList | null) => {
    const file = f?.[0];
    if (!file) return;
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("logo", file);
        await uploadBusinessLogoAction(fd);
        toast.success("Logo updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    });
  };

  const onRemove = () => {
    start(async () => {
      try {
        await removeBusinessLogoAction();
        toast.success("Logo removed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove logo");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logo</p>
      <p className="mt-1 text-xs text-slate-600">PNG, JPG, or WEBP · max 2MB · stored privately; clients see a time-limited link.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="btn btn-secondary cursor-pointer text-xs">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(e) => onPick(e.target.files)}
          />
          {pending ? "Uploading…" : "Upload logo"}
        </label>
        {hasLogo ? (
          <button type="button" className="btn btn-secondary text-xs" disabled={pending} onClick={onRemove}>
            Remove logo
          </button>
        ) : null}
      </div>
    </div>
  );
}
