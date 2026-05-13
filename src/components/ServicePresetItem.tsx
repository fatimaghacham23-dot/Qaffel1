"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock3, CopyPlus, DollarSign, Edit3, ReceiptText, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { updateServicePresetAction, deleteServicePresetAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ServicePreset {
  id: string;
  name: string;
  description: string | null;
  amount_usd: number | null;
  amount_lbp: number | null;
  currency: string;
  default_validity_days: number | null;
}

interface ServicePresetItemProps {
  preset: ServicePreset;
}

function PresetIcon({ currency }: { currency: string }) {
  const usd = currency === "USD";
  return (
    <div
      className={cn(
        "grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-soft",
        usd ? "bg-gradient-to-br from-emerald-500 to-cedar" : "bg-gradient-to-br from-sky-500 to-indigo-500"
      )}
    >
      {usd ? <DollarSign className="h-5 w-5" aria-hidden="true" /> : <ReceiptText className="h-5 w-5" aria-hidden="true" />}
    </div>
  );
}

function AmountLine({ preset }: { preset: ServicePreset }) {
  const parts = [];
  if (preset.amount_usd) parts.push(money(preset.amount_usd, "USD"));
  if (preset.amount_lbp) parts.push(money(preset.amount_lbp, "LBP"));
  return <span>{parts.length > 0 ? parts.join(" + ") : "No amount set"}</span>;
}

export function ServicePresetItem({ preset }: ServicePresetItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (formData: FormData) => {
    setIsUpdating(true);
    try {
      await updateServicePresetAction(formData);
      toast.success("Preset updated successfully.");
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update preset.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isEditing) {
    return (
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
        <div className="rounded-2xl border border-cedar/25 bg-cedar/5 p-4">
          <form action={handleUpdate} className="grid gap-4">
            <input name="id" type="hidden" value={preset.id} />

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Edit preset</p>
                <p className="mt-1 text-xs text-muted-foreground">Update the service details used to prefill new invoices.</p>
              </div>
              <Button disabled={isUpdating} onClick={() => setIsEditing(false)} size="sm" type="button" variant="ghost">
                <X className="h-4 w-4" aria-hidden="true" />
                Cancel
              </Button>
            </div>

            <div className="border-t border-slate-200" />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-1">
                <label className="label" htmlFor={`edit-name-${preset.id}`}>
                  Name
                </label>
                <input className="field" defaultValue={preset.name} id={`edit-name-${preset.id}`} name="name" required />
              </div>
              <div className="md:col-span-1">
                <label className="label" htmlFor={`edit-currency-${preset.id}`}>
                  Currency
                </label>
                <select className="field" defaultValue={preset.currency} id={`edit-currency-${preset.id}`} name="currency">
                  <option value="USD">USD</option>
                  <option value="LBP">LBP</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor={`edit-desc-${preset.id}`}>
                  Description
                </label>
                <textarea className="field min-h-24 text-sm" defaultValue={preset.description || ""} id={`edit-desc-${preset.id}`} name="description" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label" htmlFor={`edit-usd-${preset.id}`}>
                  Amount USD
                </label>
                <input className="field" defaultValue={preset.amount_usd || ""} id={`edit-usd-${preset.id}`} min="0" name="amount_usd" step="0.01" type="number" />
              </div>
              <div>
                <label className="label" htmlFor={`edit-lbp-${preset.id}`}>
                  Amount LBP
                </label>
                <input className="field" defaultValue={preset.amount_lbp || ""} id={`edit-lbp-${preset.id}`} min="0" name="amount_lbp" step="1" type="number" />
              </div>
              <div>
                <label className="label" htmlFor={`edit-validity-${preset.id}`}>
                  Validity days
                </label>
                <input className="field" defaultValue={preset.default_validity_days || ""} id={`edit-validity-${preset.id}`} min="0" name="default_validity_days" type="number" />
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-slate-200 pt-4">
              <Button disabled={isUpdating} type="submit">
                {isUpdating ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </article>
    );
  }

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-cedar/20">
      <div className="flex items-start gap-4">
        <PresetIcon currency={preset.currency} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-bold text-ink">{preset.name}</h3>
            <Badge variant="outline" className="bg-slate-50 text-slate-700">
              {preset.currency || "USD"}
            </Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{preset.description || "No description yet."}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amounts</p>
          <p className="font-semibold text-ink">
            <AmountLine preset={preset} />
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Validity</p>
          <p className="text-slate-700">
            {preset.default_validity_days ? (
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                {preset.default_validity_days} days
              </span>
            ) : (
              "Not set"
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <Link className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-cedar px-3 text-sm font-semibold text-white transition hover:bg-cedar/90" href="/invoices/new">
          <CopyPlus className="h-4 w-4" aria-hidden="true" />
          Use
        </Link>
        <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
          <Edit3 className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
        <form action={deleteServicePresetAction} onSubmit={(event) => {
          if (!window.confirm("Delete this service preset? Existing invoices will not be changed.")) {
            event.preventDefault();
          }
        }}>
          <input name="id" type="hidden" value={preset.id} />
          <Button className="border-red-200 text-red-700 hover:bg-red-50" size="sm" type="submit" variant="outline">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
        </form>
      </div>
    </article>
  );
}
