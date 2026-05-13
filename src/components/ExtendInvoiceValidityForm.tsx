"use client";

import { useState } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { extendInvoiceValidityAction } from "@/app/actions";
import { toast } from "sonner";

interface ExtendInvoiceValidityFormProps {
  invoiceId: string;
  currentValidUntil: string | null;
}

export function ExtendInvoiceValidityForm({ invoiceId, currentValidUntil }: ExtendInvoiceValidityFormProps) {
  const [isPending, setIsRecording] = useState(false);
  const [customDate, setCustomDate] = useState("");

  const handleExtend = async (days?: number, date?: string) => {
    setIsRecording(true);
    const formData = new FormData();
    formData.append("id", invoiceId);
    if (days) formData.append("days", days.toString());
    if (date) formData.append("custom_date", date);

    try {
      await extendInvoiceValidityAction(formData);
      toast.success("Payment link extended successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extend link");
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div id="extend-validity" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
          <RefreshCw size={20} className={isPending ? "animate-spin" : ""} />
        </div>
        <div>
          <h3 className="font-bold text-amber-900">Payment link expired</h3>
          <p className="text-xs text-amber-800">The client can no longer view details or upload proofs.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleExtend(3)}
            disabled={isPending}
            className="btn btn-secondary text-xs bg-white"
          >
            Extend 3 days
          </button>
          <button
            onClick={() => handleExtend(7)}
            disabled={isPending}
            className="btn btn-secondary text-xs bg-white"
          >
            Extend 7 days
          </button>
          <button
            onClick={() => handleExtend(14)}
            disabled={isPending}
            className="btn btn-secondary text-xs bg-white"
          >
            Extend 14 days
          </button>
        </div>

        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="date"
              className="field pl-9 text-xs py-2"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              disabled={isPending}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <button
            onClick={() => handleExtend(undefined, customDate)}
            disabled={isPending || !customDate}
            className="btn btn-primary text-xs whitespace-nowrap"
          >
            Set custom date
          </button>
        </div>
      </div>
    </div>
  );
}
