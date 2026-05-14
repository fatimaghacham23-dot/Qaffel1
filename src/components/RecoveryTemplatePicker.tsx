"use client";

import { useState, useTransition } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { recordReminderEventAction } from "@/app/actions";
import {
  RECOVERY_WHATSAPP_TEMPLATES,
  buildRecoveryTemplateBody,
  buildRecoveryTemplateCtx,
  type RecoveryTemplateDef
} from "@/lib/recovery-templates";

type Props = {
  invoiceId: string;
  followUpStage: string;
  clientPhone?: string | null;
  ctx: ReturnType<typeof buildRecoveryTemplateCtx>;
};

function recommendedTemplateIds(stage: string) {
  if (stage === "partial") return new Set(["recovery_partial_thanks", "recovery_payment_plan_offer"]);
  if (stage === "overdue_late") return new Set(["recovery_escalation_operational", "recovery_payment_plan_offer"]);
  if (stage === "overdue_recent") return new Set(["recovery_gentle_overdue"]);
  return new Set(["recovery_gentle_overdue"]);
}

function normalizeWhatsAppPhone(phone: string) {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("961")) return clean;
  if (clean.startsWith("0")) return `961${clean.slice(1)}`;
  return `961${clean}`;
}

export function RecoveryTemplatePicker({ invoiceId, followUpStage, clientPhone, ctx }: Props) {
  const [pending, startTransition] = useTransition();
  const [lang] = useState<"en" | "ar">("en");
  const recommended = recommendedTemplateIds(followUpStage);
  const templates = [...RECOVERY_WHATSAPP_TEMPLATES].sort((a, b) => {
    const ar = recommended.has(a.id) ? 0 : 1;
    const br = recommended.has(b.id) ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.label.localeCompare(b.label);
  });

  const run = (template: RecoveryTemplateDef, mode: "copy" | "whatsapp") => {
    const body = buildRecoveryTemplateBody(template, lang, ctx);
    startTransition(async () => {
      try {
        if (mode === "copy") {
          await navigator.clipboard.writeText(body);
          toast.success("Copied");
        } else {
          try {
            await navigator.clipboard.writeText(body);
            toast.success("Copied and opened WhatsApp");
          } catch {
            toast.message("Opening WhatsApp with the reminder text.");
          }
        }
        await recordReminderEventAction(invoiceId, followUpStage, `${mode}:${template.id}`);
        if (mode === "whatsapp" && clientPhone) {
          const clean = normalizeWhatsAppPhone(clientPhone);
          window.open(`https://wa.me/${clean}?text=${encodeURIComponent(body)}`, "_blank");
        } else if (mode === "whatsapp" && !clientPhone) {
          toast.error("Add a client phone number for WhatsApp.");
        }
      } catch {
        toast.error("Could not record reminder activity");
      }
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recovery templates</p>
      <p className="mt-1 text-[11px] text-slate-500">
        Advisory copy only — nothing sends automatically. English today; Arabic-ready structure lives in the template definitions.
      </p>
      <ul className="mt-3 space-y-2">
        {templates.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold text-ink">{t.label}</p>
                {recommended.has(t.id) ? (
                  <span className="rounded-full border border-cedar/20 bg-cedar/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cedar">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{buildRecoveryTemplateBody(t, lang, ctx).slice(0, 140)}…</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="btn btn-secondary flex items-center gap-1 text-xs"
                onClick={() => run(t, "copy")}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              <button
                type="button"
                disabled={pending}
                className="btn btn-primary flex items-center gap-1 bg-[#25D366] text-xs text-white hover:bg-[#128C7E]"
                onClick={() => run(t, "whatsapp")}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Copy &amp; WhatsApp
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
