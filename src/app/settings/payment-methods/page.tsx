import { AppShell } from "@/components/AppShell";
import { OperationsChecklist } from "@/components/OperationsChecklist";
import { PaymentMethodsManager } from "@/components/PaymentMethodsManager";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { evaluatePaymentReadiness } from "@/lib/operations";
import { requireUser } from "@/lib/supabase/server";

export default async function PaymentMethodsPage() {
  const { supabase, user } = await requireUser();
  const { data: methods } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const activeCount = (methods || []).filter((method) => method.is_active).length;
  const paymentReadiness = evaluatePaymentReadiness(
    (methods || []).filter((m) => m.is_active).map((m) => ({
      type: m.type,
      label: m.label,
      instructions: m.instructions,
      is_active: m.is_active
    }))
  );

  return (
    <AppShell>
      <PageContainer width="default">
      <PageHeader
        title="Payment methods"
        description="Manage how clients can pay you on public invoice pages."
        actions={<a className="btn btn-primary" href="#payment-methods">Manage methods</a>}
      />
      <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Public payment readiness</p>
              <p className="mt-1 text-sm text-slate-600">Active methods are shown on client payment pages.</p>
            </div>
            <StatusBadge
              status={activeCount > 0 ? "active" : "warning"}
              label={activeCount > 0 ? `${activeCount} active method${activeCount === 1 ? "" : "s"}` : "No payment methods active"}
            />
          </div>
        </div>
        <OperationsChecklist
          title="Readiness checklist"
          description="Matches the dashboard operations card."
          items={[
            {
              id: "active",
              label: "At least one active payment method",
              ok: paymentReadiness.hasActiveMethod,
              hint: "Turn on Whish, OMT, bank transfer, or other instructions.",
              fixHref: "#payment-methods",
              fixLabel: "Jump to methods"
            },
            {
              id: "whish",
              label: "Whish / OMT details complete",
              ok: paymentReadiness.whishOmtComplete,
              hint: "Receiver name and phone should be explicit.",
              fixHref: "#payment-methods",
              fixLabel: "Edit below"
            },
            {
              id: "instr",
              label: "Client-facing instructions present",
              ok: paymentReadiness.instructionsPresent && paymentReadiness.incompleteMethods === 0,
              hint:
                paymentReadiness.incompleteMethods > 0
                  ? `${paymentReadiness.incompleteMethods} method(s) may still contain placeholders.`
                  : undefined,
              fixHref: "#payment-methods",
              fixLabel: "Review below"
            }
          ]}
        />
      </div>
      <div id="payment-methods">
        <PaymentMethodsManager methods={methods || []} />
      </div>
      </PageContainer>
    </AppShell>
  );
}
