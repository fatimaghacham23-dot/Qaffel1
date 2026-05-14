import { money } from "@/lib/format";

export type RecoveryTemplateCtx = {
  clientName?: string | null;
  invoiceNumber?: string | null;
  title: string;
  remainingLabel: string;
  publicUrl: string;
};

export type RecoveryTemplateDef = {
  id: string;
  category: "recovery" | "payment_plan" | "escalation" | "partial_thanks";
  label: string;
  /** English copy; Arabic can be added as `ar` later without changing behavior. */
  locales: { en: (c: RecoveryTemplateCtx) => string; ar?: (c: RecoveryTemplateCtx) => string };
};

function greeting(c: RecoveryTemplateCtx) {
  return c.clientName ? `Hi ${c.clientName},` : "Hi,";
}

function invRef(c: RecoveryTemplateCtx) {
  return c.invoiceNumber ? `invoice #${c.invoiceNumber}` : `your invoice (${c.title})`;
}

export const RECOVERY_WHATSAPP_TEMPLATES: RecoveryTemplateDef[] = [
  {
    id: "recovery_gentle_overdue",
    category: "recovery",
    label: "Gentle overdue check-in",
    locales: {
      en: (c) =>
        `${greeting(c)} Hope you are doing well. I wanted to follow up on ${invRef(c)}. The remaining balance is ${c.remainingLabel}. Here is the secure page whenever you are ready: ${c.publicUrl}. If anything is unclear, reply here and we will sort it out.`
    }
  },
  {
    id: "recovery_payment_plan_offer",
    category: "payment_plan",
    label: "Offer manual installments",
    locales: {
      en: (c) =>
        `${greeting(c)} If it helps, we can split the remaining ${c.remainingLabel} on ${invRef(c)} into a few manual installments (no automatic charges). I will track each milestone on my side. Here is the page: ${c.publicUrl}. Tell me what schedule works for you.`
    }
  },
  {
    id: "recovery_escalation_operational",
    category: "escalation",
    label: "Operational overdue follow-up",
    locales: {
      en: (c) =>
        `${greeting(c)} I am following up on ${invRef(c)} which is still open for ${c.remainingLabel}. The link is still active: ${c.publicUrl}. If you already paid, upload proof on that page so I can reconcile quickly.`
    }
  },
  {
    id: "recovery_partial_thanks",
    category: "partial_thanks",
    label: "Thank you + remaining balance",
    locales: {
      en: (c) =>
        `${greeting(c)} Thank you for the payment so far. The remaining balance on ${invRef(c)} is ${c.remainingLabel}. You can continue here: ${c.publicUrl}.`
    }
  }
];

export function buildRecoveryTemplateBody(
  template: RecoveryTemplateDef,
  lang: "en" | "ar",
  ctx: RecoveryTemplateCtx
): string {
  if (lang === "ar" && template.locales.ar) return template.locales.ar(ctx);
  return template.locales.en(ctx);
}

export function buildRecoveryTemplateCtx(input: {
  clientName?: string | null;
  invoiceNumber?: string | null;
  title: string;
  remainingPrimary: number;
  primaryCurrency: "USD" | "LBP";
  publicToken: string;
}): RecoveryTemplateCtx {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    clientName: input.clientName,
    invoiceNumber: input.invoiceNumber,
    title: input.title,
    remainingLabel: money(input.remainingPrimary, input.primaryCurrency),
    publicUrl: `${base}/pay/${input.publicToken}`
  };
}
