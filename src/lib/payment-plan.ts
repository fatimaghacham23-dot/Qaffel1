import { finiteN } from "@/lib/safe-metrics";

export type PaymentPlanMilestone = {
  id: string;
  amount_usd?: number | null;
  amount_lbp?: number | null;
  due_date?: string | null;
  /** Set when the freelancer marks this installment as received (manual). */
  satisfied_at?: string | null;
};

export type InvoicePaymentPlan = {
  currency: "USD" | "LBP";
  milestones: PaymentPlanMilestone[];
  notes?: string | null;
};

export function parsePaymentPlan(raw: unknown): InvoicePaymentPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const milestones = Array.isArray(o.milestones) ? o.milestones : [];
  const cur = (o.currency === "LBP" ? "LBP" : "USD") as "USD" | "LBP";
  const cleaned: PaymentPlanMilestone[] = milestones
    .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === "object"))
    .map((m, idx) => ({
      id: String(m.id || `milestone-${idx}`),
      amount_usd: m.amount_usd != null ? finiteN(Number(m.amount_usd)) : null,
      amount_lbp: m.amount_lbp != null ? finiteN(Number(m.amount_lbp)) : null,
      due_date: m.due_date ? String(m.due_date) : null,
      satisfied_at: m.satisfied_at ? String(m.satisfied_at) : null
    }));
  if (!cleaned.length) return null;
  return { currency: cur, milestones: cleaned, notes: o.notes ? String(o.notes) : null };
}

export function paymentPlanProgress(plan: InvoicePaymentPlan): {
  total: number;
  satisfied: number;
  remaining: number;
  next: PaymentPlanMilestone | null;
} {
  const primary = plan.currency;
  let total = 0;
  let satisfied = 0;
  for (const m of plan.milestones) {
    const amt = primary === "USD" ? finiteN(Number(m.amount_usd || 0)) : finiteN(Number(m.amount_lbp || 0));
    total += amt;
    if (m.satisfied_at) satisfied += amt;
  }
  const remaining = Math.max(0, total - satisfied);
  const next = plan.milestones.find((m) => !m.satisfied_at) ?? null;
  return { total, satisfied, remaining, next };
}
