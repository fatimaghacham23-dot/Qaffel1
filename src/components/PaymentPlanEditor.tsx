"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { money, shortDate } from "@/lib/format";
import {
  saveInvoicePaymentPlanAction,
  clearInvoicePaymentPlanAction,
  setPaymentPlanMilestoneSatisfiedAction
} from "@/app/actions";
import type { InvoicePaymentPlan, PaymentPlanMilestone } from "@/lib/payment-plan";
import { paymentPlanProgress } from "@/lib/payment-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  invoiceId: string;
  currency: "USD" | "LBP";
  remainingPrimary: number;
  initialPlan: InvoicePaymentPlan | null;
};

function newMilestoneId(i: number) {
  return `milestone-${Date.now()}-${i}`;
}

function dateAfterDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PaymentPlanEditor({ invoiceId, currency, remainingPrimary, initialPlan }: Props) {
  const [plan, setPlan] = useState<InvoicePaymentPlan | null>(initialPlan);
  const [splitCount, setSplitCount] = useState(3);
  const [pending, startTransition] = useTransition();
  const actionLockRef = useRef(false);

  const progress = useMemo(() => (plan ? paymentPlanProgress(plan) : null), [plan]);

  const applyEqualSplit = (count = splitCount, withDueDates = false) => {
    const n = Math.max(2, Math.min(8, Math.floor(count)));
    if (!Number.isFinite(remainingPrimary) || remainingPrimary <= 0) {
      toast.error("No remaining balance to split.");
      return;
    }
    const milestones: PaymentPlanMilestone[] = [];
    let allocated = 0;
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      const amt = isLast
        ? Math.max(0, remainingPrimary - allocated)
        : currency === "USD"
          ? Math.round((remainingPrimary / n) * 100) / 100
          : Math.floor(remainingPrimary / n);
      allocated += amt;
      milestones.push({
        id: newMilestoneId(i),
        amount_usd: currency === "USD" ? amt : null,
        amount_lbp: currency === "LBP" ? amt : null,
        due_date: withDueDates ? dateAfterDays((i + 1) * 14) : null,
        satisfied_at: null
      });
    }
    setPlan({ currency, milestones, notes: plan?.notes ?? null });
    setSplitCount(n);
  };

  const updateMilestone = (id: string, patch: Partial<PaymentPlanMilestone>) => {
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        milestones: prev.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m))
      };
    });
  };

  const save = () => {
    if (actionLockRef.current) return;
    if (!plan || !plan.milestones.length) {
      toast.error("Create milestones first.");
      return;
    }
    actionLockRef.current = true;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("invoice_id", invoiceId);
        fd.set("plan_json", JSON.stringify(plan));
        await saveInvoicePaymentPlanAction(fd);
        toast.success("Payment plan saved");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not save plan");
      } finally {
        actionLockRef.current = false;
      }
    });
  };

  const clear = () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("invoice_id", invoiceId);
        await clearInvoicePaymentPlanAction(fd);
        setPlan(null);
        toast.success("Payment plan cleared");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not clear plan");
      } finally {
        actionLockRef.current = false;
      }
    });
  };

  const toggleMilestone = (mid: string, satisfied: boolean) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("invoice_id", invoiceId);
        fd.set("milestone_id", mid);
        fd.set("satisfied", satisfied ? "1" : "0");
        await setPaymentPlanMilestoneSatisfiedAction(fd);
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            milestones: prev.milestones.map((m) =>
              m.id === mid ? { ...m, satisfied_at: satisfied ? new Date().toISOString() : null } : m
            )
          };
        });
        toast.success(satisfied ? "Marked as received" : "Mark cleared");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      } finally {
        actionLockRef.current = false;
      }
    });
  };

  return (
    <section id="payment-plan" className="panel scroll-mt-24 border-amber-100 bg-amber-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Offer payment plan</h2>
          <p className="mt-1 text-xs text-slate-600">
            Manual milestones only — you mark installments when money arrives. No subscriptions or automatic charging.
          </p>
        </div>
        {progress ? (
          <p className="text-xs font-semibold text-amber-900">
            Plan progress: {money(currency === "USD" ? progress.satisfied : progress.satisfied, currency)} /{" "}
            {money(currency === "USD" ? progress.total : progress.total, currency)}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-amber-100 bg-white/75 p-3">
        <p className="text-[10px] font-bold uppercase text-slate-500">Fast setup</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[2, 3, 4].map((count) => (
            <Button key={count} type="button" variant="outline" size="sm" onClick={() => applyEqualSplit(count)} disabled={pending}>
              {count} parts
            </Button>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={() => applyEqualSplit(3, true)} disabled={pending}>
            3 parts + dates
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-500">Split count</p>
          <Input
            type="number"
            min={2}
            max={8}
            className="mt-1 w-24"
            value={splitCount}
            onChange={(e) => setSplitCount(Number(e.target.value))}
          />
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => applyEqualSplit()} disabled={pending}>
          Split remaining evenly
        </Button>
        {plan ? (
          <Button type="button" variant="outline" size="sm" onClick={clear} disabled={pending}>
            Clear plan
          </Button>
        ) : null}
      </div>

      {plan && plan.milestones.length > 0 ? (
        <div className="mt-4 space-y-3">
          {plan.milestones.map((m, idx) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 p-3 text-sm"
            >
              <span className="w-8 font-bold text-slate-400">{idx + 1}</span>
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Amount ({currency})</span>
                <Input
                  type="number"
                  className="w-32"
                  disabled={Boolean(m.satisfied_at)}
                  value={currency === "USD" ? (m.amount_usd ?? "") : (m.amount_lbp ?? "")}
                  onChange={(e) =>
                    updateMilestone(m.id, currency === "USD" ? { amount_usd: Number(e.target.value) } : { amount_lbp: Number(e.target.value) })
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Due (optional)</span>
                <Input
                  type="date"
                  className="w-40"
                  value={m.due_date || ""}
                  onChange={(e) => updateMilestone(m.id, { due_date: e.target.value || null })}
                />
              </label>
              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                {m.satisfied_at ? (
                  <span className="text-xs text-emerald-700">Received {shortDate(m.satisfied_at)}</span>
                ) : (
                  <span className="text-xs text-slate-500">Outstanding</span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={m.satisfied_at ? "outline" : "default"}
                  disabled={pending}
                  onClick={() => toggleMilestone(m.id, !m.satisfied_at)}
                >
                  {m.satisfied_at ? "Undo received" : "Mark received"}
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" className="btn btn-primary text-xs" disabled={pending} onClick={save}>
            Save plan to invoice
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Use “Split remaining evenly” to draft milestones, then adjust amounts or due dates.</p>
      )}
    </section>
  );
}
