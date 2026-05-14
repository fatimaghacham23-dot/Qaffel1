import Link from "next/link";
import { CircleCheck, ReceiptText, UserRoundCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DashboardAreaChart, type DashboardTrendDatum } from "@/components/DashboardAreaChart";
import DashboardClock from "@/components/DashboardClock";
import { DashboardFinancialCard } from "@/components/DashboardFinancialCard";
import { DashboardFinancialKpiStrip } from "@/components/DashboardFinancialKpiStrip";
import { DashboardProductivityLayer } from "@/components/DashboardProductivityLayer";
import { DashboardSetupProgress } from "@/components/DashboardSetupProgress";
import { DashboardStatsCards } from "@/components/DashboardStatsCards";
import { OperationsChecklist } from "@/components/OperationsChecklist";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { isQuoteDocument } from "@/lib/documents";
import { money, shortDate } from "@/lib/format";
import { evaluatePaymentReadiness, evaluateProfileCompleteness, type PaymentMethodRow } from "@/lib/operations";
import { buildOperationsCenterModel } from "@/lib/operations-center";
import { buildTodaysPriorities } from "@/lib/todays-priorities";
import { buildIntelligenceBundle } from "@/lib/intelligence-layer";
import { OperationsCenterView } from "@/components/OperationsCenterView";
import { DashboardIntelligenceSection } from "@/components/DashboardIntelligenceSection";
import { MissionCollapsible } from "@/components/MissionCollapsible";
import { TodaysPrioritiesStrip } from "@/components/TodaysPrioritiesStrip";
import { WorkflowAssistantPanel } from "@/components/WorkflowAssistantPanel";
import { getDisplayInvoiceStatus, reconcileInvoiceStatus } from "@/lib/status";
import { requireUser } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/types";
import { computeRecoveryForInvoice, recoveryKpis, type RecoveryInvoiceRow } from "@/lib/recovery-engine";
import { buildWorkflowAssistantModel } from "@/lib/workflow-assistant";
import { buildBusinessLaunchModel } from "@/lib/business-launch";

type DashboardInvoice = {
  amount_usd?: number | string | null;
  created_at?: string | null;
  document_type?: string | null;
  due_date?: string | null;
  status: InvoiceStatus;
  payment_proofs?: { status?: string | null; amount_usd?: number | null; amount_lbp?: number | null }[];
};

function rowProofs(inv: DashboardInvoice) {
  return (inv.payment_proofs || []).map((p) => ({
    status: p.status || "",
    amount_usd: p.amount_usd,
    amount_lbp: p.amount_lbp
  }));
}

function reconciledDisplayStatus(inv: DashboardInvoice) {
  const rec = reconcileInvoiceStatus(inv as any, rowProofs(inv));
  return getDisplayInvoiceStatus({ ...inv, status: rec });
}

function buildInvoiceTrend(invoices: DashboardInvoice[]): DashboardTrendDatum[] {
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (5 - index));

    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: monthFormatter.format(date),
      paidAmount: 0,
      outstandingAmount: 0
    };
  });

  const buckets = new Map(months.map((month) => [month.key, month]));

  for (const invoice of invoices) {
    if (isQuoteDocument(invoice)) continue;
    if (!invoice.created_at) continue;

    const createdAt = new Date(invoice.created_at);
    const bucket = buckets.get(`${createdAt.getFullYear()}-${createdAt.getMonth()}`);
    if (!bucket) continue;

    const amount = Number(invoice.amount_usd || 0);
    const displayStatus = reconciledDisplayStatus(invoice);

    if (displayStatus === "paid") {
      bucket.paidAmount += amount;
    } else if (["sent", "unpaid", "partial", "overdue"].includes(displayStatus)) {
      bucket.outstandingAmount += amount;
    }
  }

  return months.map(({ label, paidAmount, outstandingAmount }) => ({
    label,
    paidAmount,
    outstandingAmount
  }));
}

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [
    { data: profile },
    { data: invoices },
    { data: proofs },
    { data: activePaymentMethods },
    { count: pendingProofCount },
    { data: recentAcceptedPayment },
    { data: clientContacts },
    { data: pendingProofRows },
    { data: invoiceEvents }
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("invoices")
      .select(
        "*, exchange_rate_lbp_per_usd, clients(id, name, phone, email), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, payment_date, method, voided_at)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_proofs")
      .select("*, invoices!inner(id, title, invoice_number, user_id)")
      .eq("invoices.user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(5),
    supabase
      .from("payment_methods")
      .select("type, label, instructions, is_active, receiver_name, receiver_phone, account_reference, qr_image_path, external_link")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("payment_proofs")
      .select("id, invoices!inner(user_id)", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("invoices.user_id", user.id),
    supabase
      .from("payment_proofs")
      .select("status, amount_usd, amount_lbp, payment_date, uploaded_at, method, invoices!inner(id, user_id, client_id, invoice_number, title)")
      .eq("status", "accepted")
      .eq("invoices.user_id", user.id)
      .order("confirmed_at", { ascending: false })
      .order("uploaded_at", { ascending: false })
      .limit(1),
    supabase.from("clients").select("id, phone, email, name, created_at").eq("user_id", user.id),
    supabase
      .from("payment_proofs")
      .select("id, uploaded_at, invoice_id, invoices!inner(id, title, invoice_number, user_id)")
      .eq("status", "pending")
      .eq("invoices.user_id", user.id)
      .order("uploaded_at", { ascending: true })
      .limit(120),
    supabase
      .from("invoice_events")
      .select("id, invoice_id, event_type, message, created_at, metadata")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(800)
  ]);

  // Generate signed URLs for payment proofs
  const proofsWithSignedUrls = await Promise.all(
    (proofs || []).map(async (proof) => {
      if (!proof.image_url) return proof;
      
      // If image_url is already a full URL (legacy), return as is
      if (proof.image_url.startsWith("http")) return proof;

      const { data, error } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(proof.image_url, 3600); // 1 hour

      return {
        ...proof,
        image_url: data?.signedUrl || proof.image_url
      };
    })
  );

  const methodsList = activePaymentMethods || [];
  const hasPaymentMethods = methodsList.length > 0;

  const safeInvoices = invoices || [];
  const billableInvoices = safeInvoices.filter((invoice) => !isQuoteDocument(invoice));
  const quoteCount = safeInvoices.length - billableInvoices.length;
  const paidThisMonth = billableInvoices
    .filter((invoice) => reconciledDisplayStatus(invoice) === "paid" && invoice.created_at >= monthStart.toISOString())
    .reduce((sum, invoice) => sum + Number(invoice.amount_usd || 0), 0);
  const totalPaid = billableInvoices
    .filter((invoice) => reconciledDisplayStatus(invoice) === "paid")
    .reduce((sum, invoice) => sum + Number(invoice.amount_usd || 0), 0);
  const totalUnpaid = billableInvoices
    .filter((invoice) => {
      const d = reconciledDisplayStatus(invoice);
      return ["sent", "unpaid", "partial"].includes(d) || d === "overdue";
    })
    .reduce((sum, invoice) => sum + Number(invoice.amount_usd || 0), 0);
  const overdueAmountUsd = billableInvoices
    .filter((invoice) => reconciledDisplayStatus(invoice) === "overdue")
    .reduce((sum, invoice) => {
      const amount = Number(invoice.amount_usd || 0);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  const overdueCount = billableInvoices.filter((invoice) => reconciledDisplayStatus(invoice) === "overdue").length;
  const pendingProofs = pendingProofCount || 0;

  const paymentReadiness = evaluatePaymentReadiness(methodsList);
  const profileCompleteness = evaluateProfileCompleteness({
    profile,
    userEmail: user.email,
    hasActivePaymentMethod: hasPaymentMethods
  });

  const trendData = buildInvoiceTrend(billableInvoices);
  const hasTrendData = billableInvoices.length > 1;

  const financialActivityData = trendData.map((bucket) => ({
    day: bucket.label,
    value: Number(bucket.paidAmount || 0) + Number(bucket.outstandingAmount || 0)
  }));

  const topClientByBalanceDue = (() => {
    const byClient = new Map<string, number>();

    for (const invoice of billableInvoices) {
      if (!invoice.client_id) continue;
      const displayStatus = reconciledDisplayStatus(invoice);
      if (!['sent', 'unpaid', 'partial', 'overdue'].includes(displayStatus)) continue;
      const current = byClient.get(invoice.client_id) || 0;
      byClient.set(invoice.client_id, current + Number(invoice.amount_usd || 0));
    }

    let best: { clientId: string; amountUsd: number } | null = null;
    for (const [clientId, amountUsd] of byClient.entries()) {
      if (!best || amountUsd > best.amountUsd) {
        best = { clientId, amountUsd };
      }
    }

    return best;
  })();

  const topClientName = topClientByBalanceDue
    ? (await supabase.from("clients").select("name").eq("id", topClientByBalanceDue.clientId).eq("user_id", user.id).maybeSingle()).data?.name
    : null;

  const clientPhones: Record<string, string> = {};
  for (const c of clientContacts || []) {
    if (c?.id && c.phone) clientPhones[c.id] = String(c.phone);
  }

  const opsModel = buildOperationsCenterModel({
    invoices: safeInvoices as any,
    pendingProofQueue: (pendingProofRows || []) as any,
    events: (invoiceEvents || []) as any,
    paymentMethods: (methodsList || []) as PaymentMethodRow[],
    profile,
    userEmail: user.email
  });

  const reminderCutoff = new Date();
  reminderCutoff.setDate(reminderCutoff.getDate() - 30);
  const remindersSent30d = (invoiceEvents || []).filter(
    (e) => e.event_type === "reminder_copied" && new Date(e.created_at) >= reminderCutoff
  ).length;

  const receiptViewedIds = new Set(
    (invoiceEvents || []).filter((e) => e.event_type === "receipt_viewed").map((e) => e.invoice_id as string)
  );
  let viewedNotPaidCount = 0;
  for (const inv of billableInvoices) {
    if (!receiptViewedIds.has(inv.id)) continue;
    if (reconciledDisplayStatus(inv) === "paid") continue;
    viewedNotPaidCount += 1;
  }

  const awaitingPaymentCount = billableInvoices.filter((inv) =>
    ["sent", "unpaid", "partial", "overdue"].includes(reconciledDisplayStatus(inv))
  ).length;

  const paymentConversion = {
    awaitingPaymentCount,
    viewedNotPaidCount,
    remindersSentCount: remindersSent30d,
    proofsAwaitingConfirmation: pendingProofs
  };

  const todaysPriorities = buildTodaysPriorities(opsModel, { pendingProofCount: pendingProofs });
  const workflowAssistant = buildWorkflowAssistantModel({
    invoices: safeInvoices as any,
    events: (invoiceEvents || []) as any
  });
  const businessLaunch = buildBusinessLaunchModel({
    profile,
    userEmail: user.email,
    paymentMethods: methodsList as PaymentMethodRow[],
    clients: clientContacts || [],
    invoices: safeInvoices as any,
    events: (invoiceEvents || []) as any
  });

  const intelligenceBundle = buildIntelligenceBundle({
    invoices: safeInvoices as any,
    events: (invoiceEvents || []) as any,
    clients: (clientContacts || []).map((c) => ({
      id: c.id,
      name: (c as { name?: string | null }).name ?? null,
      created_at: (c as { created_at?: string }).created_at || ""
    }))
  });

  const recoveryRows = billableInvoices.flatMap((inv) => {
    const proofs = rowProofs(inv);
    type ProofRow = {
      status?: string | null;
      amount_usd?: number | null;
      amount_lbp?: number | null;
      confirmed_at?: string | null;
      uploaded_at?: string | null;
    };
    const invRow: RecoveryInvoiceRow = {
      ...(inv as RecoveryInvoiceRow),
      payment_proofs: (inv.payment_proofs || []).map((p: ProofRow) => ({
        status: p.status || "",
        amount_usd: p.amount_usd,
        amount_lbp: p.amount_lbp,
        confirmed_at: p.confirmed_at,
        uploaded_at: p.uploaded_at
      }))
    };
    const allRows: RecoveryInvoiceRow[] = billableInvoices.map((b) => ({
      ...(b as RecoveryInvoiceRow),
      payment_proofs: (b.payment_proofs || []).map((p: ProofRow) => ({
        status: p.status || "",
        amount_usd: p.amount_usd,
        amount_lbp: p.amount_lbp,
        confirmed_at: p.confirmed_at,
        uploaded_at: p.uploaded_at
      }))
    }));
    const r = computeRecoveryForInvoice({
      invoice: invRow,
      proofs,
      events: (invoiceEvents || []).map((e: { invoice_id: string; event_type: string; created_at: string; metadata?: unknown }) => ({
        invoice_id: e.invoice_id,
        event_type: e.event_type,
        created_at: e.created_at,
        metadata: (e.metadata as Record<string, unknown>) || null
      })),
      allUserInvoices: allRows
    });
    return r ? [r] : [];
  });
  const recoveryDashKpis = recoveryKpis(recoveryRows);

  const lastPayment = Array.isArray(recentAcceptedPayment) ? recentAcceptedPayment[0] : null;
  const lastPaymentInvoiceId = lastPayment
    ? (Array.isArray((lastPayment as any).invoices)
        ? (lastPayment as any).invoices?.[0]?.id
        : (lastPayment as any).invoices?.id)
    : null;

  return (
    <AppShell>
      <div className="q-dashboard-stack">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/65 bg-white/[0.72] p-5 shadow-card backdrop-blur-md sm:p-6 md:p-7">
        <div>
          <p className="q-section-label text-cedar">Qaffel</p>
          <h1 className="page-title">Mission control</h1>
          <p className="q-subtitle mt-2 max-w-2xl">
            Priorities first, then cash position and your live operations queue. Intelligence and long charts stay tucked away until you need them.
          </p>
        </div>
        <Link className="btn btn-primary touch-manipulation" href="/invoices/new">
          New invoice or quote
        </Link>
      </div>

      <DashboardProductivityLayer
        priorities={todaysPriorities}
        pendingProofs={pendingProofs}
        recoveryCount={recoveryRows.length}
        overdueCount={overdueCount}
        hasPaymentMethods={hasPaymentMethods}
        lastPaymentInvoiceId={lastPaymentInvoiceId}
      />

      <div id="priorities">
        <TodaysPrioritiesStrip items={todaysPriorities} />
      </div>

      <WorkflowAssistantPanel model={workflowAssistant} />

      {recoveryRows.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-3xl border border-amber-200/55 bg-amber-50/45 p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="q-section-label text-amber-800/90">Recovery center</p>
            <p className="q-body mt-2 text-amber-950/85">
              {recoveryRows.length} overdue file{recoveryRows.length === 1 ? "" : "s"} ·{" "}
              {money(recoveryDashKpis.overdueRecoverableUsd, "USD")} USD at risk (primary totals) · avg{" "}
              {recoveryDashKpis.avgDaysOverdue} days overdue
            </p>
          </div>
          <Link className="btn btn-secondary shrink-0 text-xs" href="/recoveries">
            Open recovery center
          </Link>
        </div>
      ) : null}

      <DashboardSetupProgress model={businessLaunch} />

      <section id="financial-snapshot" className="space-y-4">
        <p className="q-section-label text-slate-500">Financial snapshot</p>
        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(460px,520px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <DashboardFinancialKpiStrip
            paidThisMonthUsd={paidThisMonth}
            waitingToCollectUsd={totalUnpaid}
            cashThisWeekUsd={opsModel.cashFlow.expectedIncomingWeekUsd}
            revenueAtRiskUsd={opsModel.cashFlow.overdueRecoverableUsd}
            proofsAwaitingReview={pendingProofs}
          />
          <DashboardFinancialCard
            paidThisMonth={money(paidThisMonth, "USD")}
            outstanding={money(totalUnpaid, "USD")}
            activityData={financialActivityData}
            omitHeroValue
          />
        </div>
        <DashboardClock />
      </div>
      </section>

      <div>
        <DashboardStatsCards
          totalCollected={money(totalPaid, "USD")}
          outstandingBalance={money(totalUnpaid, "USD")}
          pendingProofs={pendingProofs}
          overdueInvoices={overdueCount}
        />
      </div>

      <div id="live-operations" className="space-y-3">
        <p className="q-section-label text-slate-500">Live operations</p>
        <OperationsCenterView model={opsModel} clientPhones={clientPhones} paymentConversion={paymentConversion} />
      </div>

      <div className="q-stagger-children space-y-4">
        <MissionCollapsible
          id="dash-intelligence"
          title="Intelligence & analytics"
          subtitle="Revenue patterns, payment performance, reminders, and recommendations — all from your own invoice and event history."
          defaultOpen={false}
          expandLabel="Expand intelligence"
          collapseLabel="Collapse intelligence"
        >
          <DashboardIntelligenceSection bundle={intelligenceBundle} />
        </MissionCollapsible>

        <MissionCollapsible
          id="dash-charts-workspace"
          title="Charts, proofs & workspace setup"
          subtitle="Six-month paid vs waiting trend, proof inbox, profile details, and readiness checklists."
          defaultOpen={false}
          expandLabel="Expand analytics"
          collapseLabel="Collapse analytics"
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-slate-200/70 bg-white/[0.97] p-5 shadow-card backdrop-blur-[2px] sm:p-6">
                <p className="q-section-label text-slate-500">Money overdue</p>
                <p className="q-figure mt-3 text-2xl font-semibold tabular-nums tracking-tight text-ink">{money(overdueAmountUsd, "USD")}</p>
                <p className="q-caption mt-2">Total USD still overdue on invoices</p>
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-white/[0.97] p-5 shadow-card backdrop-blur-[2px] sm:p-6">
                <p className="q-section-label text-slate-500">Open quotes</p>
                <p className="q-figure mt-3 text-2xl font-semibold tabular-nums tracking-tight text-ink">{quoteCount.toLocaleString()}</p>
                <p className="q-caption mt-2">Not counted as invoice balance waiting to be collected</p>
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-white/[0.97] p-5 shadow-card backdrop-blur-[2px] sm:p-6">
                <p className="q-section-label text-slate-500">Top client · waiting to be collected</p>
                {topClientByBalanceDue && topClientName ? (
                  <>
                    <p className="mt-3 truncate text-lg font-semibold tracking-tight text-ink">{topClientName}</p>
                    <p className="q-figure mt-2 text-sm font-semibold tabular-nums text-amber-800/90">{money(topClientByBalanceDue.amountUsd, "USD")}</p>
                    <Link className="mt-2 inline-block text-xs font-semibold text-cedar" href="/clients">
                      View clients &rarr;
                    </Link>
                  </>
                ) : (
                  <PremiumEmptyState
                    title="No balances waiting on clients yet."
                    description="Clients with open balances will appear here once invoices are sent or become overdue."
                    example="When you send an invoice with a future due date, totals roll up here by client."
                    icon={<UserRoundCheck className="h-6 w-6" aria-hidden="true" />}
                    action={
                      <Link className="btn btn-secondary text-xs" href="/invoices/new">
                        Issue an invoice
                      </Link>
                    }
                  />
                )}
              </div>

              <div className="rounded-3xl border border-slate-200/70 bg-white/[0.97] p-5 shadow-card backdrop-blur-[2px] sm:p-6">
                <p className="q-section-label text-slate-500">Latest confirmed payment</p>
                {lastPayment ? (
                  <>
                    <p className="q-figure mt-3 text-lg font-semibold tabular-nums tracking-tight text-ink">
                      {lastPayment.amount_usd ? money(lastPayment.amount_usd, "USD") : ""}
                      {lastPayment.amount_usd && lastPayment.amount_lbp ? " + " : ""}
                      {lastPayment.amount_lbp ? money(lastPayment.amount_lbp, "LBP") : ""}
                    </p>
                    <p className="q-caption mt-2">
                      {lastPayment.payment_date ? shortDate(lastPayment.payment_date) : shortDate(lastPayment.uploaded_at)}
                      {lastPayment.method ? ` - ${lastPayment.method}` : ""}
                    </p>
                    {lastPaymentInvoiceId ? (
                      <Link className="mt-2 inline-block text-xs font-semibold text-cedar" href={`/invoices/${lastPaymentInvoiceId}`}>
                        View invoice &rarr;
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <PremiumEmptyState
                    title="No accepted payments yet."
                    description="Accepted manual payments and reviewed proofs will appear here."
                    example="Accept a proof from /proofs — the invoice balance updates and shows here."
                    icon={<CircleCheck className="h-6 w-6" aria-hidden="true" />}
                    action={
                      <Link className="btn btn-secondary text-xs" href="/proofs">
                        Review proofs
                      </Link>
                    }
                  />
                )}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <OperationsChecklist
                title="Payment method readiness"
                description="What clients see on your public invoice pages."
                items={[
                  {
                    id: "active",
                    label: "At least one active payment method",
                    ok: paymentReadiness.hasActiveMethod,
                    hint: "Activate Whish, OMT, bank transfer, or custom instructions.",
                    fixHref: "/settings/payment-methods",
                    fixLabel: "Open payment methods"
                  },
                  {
                    id: "whish-omt",
                    label: "Whish / OMT methods have complete details",
                    ok: paymentReadiness.whishOmtComplete,
                    hint: "Include receiver name and phone so clients can pay without guessing.",
                    fixHref: "/settings/payment-methods",
                    fixLabel: "Edit methods"
                  },
                  {
                    id: "instructions",
                    label: "Client-facing instructions are filled in",
                    ok: paymentReadiness.instructionsPresent && paymentReadiness.incompleteMethods === 0,
                    hint:
                      paymentReadiness.incompleteMethods > 0
                        ? `${paymentReadiness.incompleteMethods} active method(s) still look like placeholders.`
                        : undefined,
                    fixHref: "/settings/payment-methods",
                    fixLabel: "Review instructions"
                  }
                ]}
              />
              <OperationsChecklist
                title="Business profile completeness"
                description="Shown on invoices, receipts, and client-facing pages."
                items={[
                  {
                    id: "biz",
                    label: "Business name",
                    ok: profileCompleteness.businessName,
                    hint: "Appears at the top of client invoices.",
                    fixHref: "/settings/profile",
                    fixLabel: "Edit profile"
                  },
                  {
                    id: "phone",
                    label: "Business phone on profile",
                    ok: profileCompleteness.phone,
                    hint: "Clients can reach you for clarifications.",
                    fixHref: "/settings/profile",
                    fixLabel: "Edit profile"
                  },
                  {
                    id: "email",
                    label: "Account email",
                    ok: profileCompleteness.email,
                    hint: "Used for sign-in and invoice identity."
                  },
                  {
                    id: "brand",
                    label: "Brand identity (business name on documents)",
                    ok: profileCompleteness.brandIdentity,
                    hint: "Matches what clients expect on Whish/OMT receipts.",
                    fixHref: "/settings/profile",
                    fixLabel: "Edit profile"
                  },
                  {
                    id: "pay-m",
                    label: "Payment methods active",
                    ok: profileCompleteness.paymentMethodsActive,
                    hint: "Clients need instructions before they can pay.",
                    fixHref: "/settings/payment-methods",
                    fixLabel: "Add payment methods"
                  },
                  {
                    id: "addr",
                    label: "Business address (optional)",
                    ok: profileCompleteness.businessAddress,
                    hint: "Adds trust on printable invoices.",
                    fixHref: "/settings/profile",
                    fixLabel: "Edit profile"
                  }
                ]}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <DashboardAreaChart
                data={trendData}
                hasTrendData={hasTrendData}
                paidTotal={totalPaid}
                outstandingTotal={totalUnpaid}
              />

              <div className="grid gap-5">
                <section className="rounded-3xl border border-slate-200/70 bg-white/[0.97] p-6 shadow-card backdrop-blur-[2px] sm:p-7">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="q-section-label text-cedar">Proofs</p>
                      <h2 className="q-title mt-3">Recent payment proofs</h2>
                    </div>
                    <Link className="text-sm font-semibold text-cedar" href="/proofs">
                      Review all
                    </Link>
                  </div>
                  <div className="mb-5 rounded-2xl border border-slate-200/50 bg-slate-50/80 px-5 py-4">
                    <p className="q-body-muted">Awaiting review before confirmation</p>
                    <p className="q-figure mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">{pendingProofs}</p>
                  </div>
                  <div className="grid gap-3">
                    {proofsWithSignedUrls.length === 0 ? (
                      <PremiumEmptyState
                        title="No proofs uploaded yet."
                        description="Client payment screenshots and PDFs will appear here after invoice links are shared."
                        guidance={[
                          "Public payment pages show your active methods and proof upload form.",
                          "Uploaded proofs wait for manual review before payment confirmation.",
                          "Accepted proofs update invoices and make receipts available."
                        ]}
                        example="Open an invoice public page to preview exactly what clients will see."
                        icon={<ReceiptText className="h-6 w-6" aria-hidden="true" />}
                        action={
                          <Link className="btn btn-primary text-xs" href="/invoices">
                            Open invoices
                          </Link>
                        }
                      />
                    ) : (
                      proofsWithSignedUrls.map((proof) => (
                        <div key={proof.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white/80 p-3.5">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{proof.invoices?.title || "Invoice"}</p>
                            <p className="text-sm text-slate-500">{shortDate(proof.uploaded_at)}</p>
                          </div>
                          <StatusBadge status={proof.status} />
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200/70 bg-white/[0.97] p-6 shadow-card backdrop-blur-[2px] sm:p-7">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="q-section-label text-cedar">Profile</p>
                      <h2 className="q-title mt-3">Business profile</h2>
                    </div>
                    <Link className="text-sm font-semibold text-cedar hover:underline" href="/settings/profile">
                      Edit
                    </Link>
                  </div>
                  <div className="grid gap-4">
                    {!profile?.business_name && (
                      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/70 p-4 sm:p-5">
                        <p className="q-body text-amber-800/90">
                          <strong>Professional tip:</strong> Add your business name in settings so it appears on invoices.
                        </p>
                        <Link className="mt-2 inline-block text-sm font-semibold text-amber-900/90 underline-offset-2 hover:underline" href="/settings/profile">
                          Update profile &rarr;
                        </Link>
                      </div>
                    )}
                    <div className="grid gap-2 text-sm">
                      <div className="flex justify-between gap-4 border-b border-slate-50 pb-2">
                        <span className="text-slate-500">Business Name</span>
                        <span className="text-right font-medium text-ink">{profile?.business_name || "Not set"}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-50 pb-2">
                        <span className="text-slate-500">Full Name</span>
                        <span className="text-right font-medium text-ink">{profile?.full_name || "Not set"}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-slate-50 pb-2">
                        <span className="text-slate-500">Phone</span>
                        <span className="text-right font-medium text-ink">{profile?.phone || "Not set"}</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </MissionCollapsible>
      </div>
      </div>
    </AppShell>
  );
}
