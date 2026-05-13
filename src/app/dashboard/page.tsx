import Link from "next/link";
import { CircleCheck, ReceiptText, UserRoundCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DashboardAreaChart, type DashboardTrendDatum } from "@/components/DashboardAreaChart";
import DashboardClock from "@/components/DashboardClock";
import { DashboardFinancialCard } from "@/components/DashboardFinancialCard";
import { DashboardStatsCards } from "@/components/DashboardStatsCards";
import { OperationsChecklist } from "@/components/OperationsChecklist";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { isQuoteDocument } from "@/lib/documents";
import { money, shortDate } from "@/lib/format";
import { evaluatePaymentReadiness, evaluateProfileCompleteness, type PaymentMethodRow } from "@/lib/operations";
import { buildOperationsCenterModel } from "@/lib/operations-center";
import { buildIntelligenceBundle } from "@/lib/intelligence-layer";
import { OperationsCenterView } from "@/components/OperationsCenterView";
import { DashboardIntelligenceSection } from "@/components/DashboardIntelligenceSection";
import { getDisplayInvoiceStatus, reconcileInvoiceStatus } from "@/lib/status";
import { requireUser } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/types";

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

  const intelligenceBundle = buildIntelligenceBundle({
    invoices: safeInvoices as any,
    events: (invoiceEvents || []) as any,
    clients: (clientContacts || []).map((c) => ({
      id: c.id,
      name: (c as { name?: string | null }).name ?? null,
      created_at: (c as { created_at?: string }).created_at || ""
    }))
  });

  const lastPayment = Array.isArray(recentAcceptedPayment) ? recentAcceptedPayment[0] : null;
  const lastPaymentInvoiceId = lastPayment
    ? (Array.isArray((lastPayment as any).invoices)
        ? (lastPayment as any).invoices?.[0]?.id
        : (lastPayment as any).invoices?.id)
    : null;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Operations command center, cash signals, and proof queue — everything is computed from your real invoices, clients, and events.
          </p>
        </div>
        <Link className="btn btn-primary" href="/invoices/new">
          New invoice or quote
        </Link>
      </div>

      {!hasPaymentMethods && (
        <div className="mb-6 rounded-lg border-2 border-cedar/20 bg-cedar/5 p-6">
          <h2 className="text-lg font-bold text-ink">Set up how clients can pay you</h2>
          <p className="mt-2 text-slate-600">
            Add Whish, OMT, cash, bank transfer, or any manual payment instructions you want clients to see on invoice payment pages.
          </p>
          <div className="mt-4">
            <Link className="btn btn-primary" href="/settings/payment-methods">
              Add payment methods
            </Link>
          </div>
        </div>
      )}

      <OperationsCenterView model={opsModel} clientPhones={clientPhones} />

      <DashboardIntelligenceSection bundle={intelligenceBundle} />

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(460px,520px)]">
        <DashboardFinancialCard
          paidThisMonth={money(paidThisMonth, "USD")}
          outstanding={money(totalUnpaid, "USD")}
          activityData={financialActivityData}
        />
        <DashboardClock />
      </div>

      <div className="mt-5">
        <DashboardStatsCards
          totalCollected={money(totalPaid, "USD")}
          outstandingBalance={money(totalUnpaid, "USD")}
          pendingProofs={pendingProofs}
          overdueInvoices={overdueCount}
        />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue amount</p>
          <p className="mt-2 text-2xl font-bold text-ink">{money(overdueAmountUsd, "USD")}</p>
          <p className="mt-1 text-xs text-slate-500">Total USD on overdue invoices</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open quotes</p>
          <p className="mt-2 text-2xl font-bold text-ink">{quoteCount.toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500">Not counted as outstanding invoice debt</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top client by balance due</p>
          {topClientByBalanceDue && topClientName ? (
            <>
              <p className="mt-2 text-lg font-bold text-ink truncate">{topClientName}</p>
              <p className="mt-1 text-sm font-semibold text-amber-700">{money(topClientByBalanceDue.amountUsd, "USD")}</p>
              <Link className="mt-2 inline-block text-xs font-semibold text-cedar" href="/clients">
                View clients &rarr;
              </Link>
            </>
          ) : (
            <PremiumEmptyState
              title="No balances due yet."
              description="Clients with open balances will appear here once invoices are sent or become overdue."
              example="When you send an invoice with a future due date, outstanding totals roll up here by client."
              icon={<UserRoundCheck className="h-6 w-6" aria-hidden="true" />}
              action={
                <Link className="btn btn-secondary text-xs" href="/invoices/new">
                  Issue an invoice
                </Link>
              }
            />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent accepted payment</p>
          {lastPayment ? (
            <>
              <p className="mt-2 text-lg font-bold text-ink">
                {lastPayment.amount_usd ? money(lastPayment.amount_usd, "USD") : ""}
                {lastPayment.amount_usd && lastPayment.amount_lbp ? " + " : ""}
                {lastPayment.amount_lbp ? money(lastPayment.amount_lbp, "LBP") : ""}
              </p>
              <p className="mt-1 text-xs text-slate-500">
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

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
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
              hint: paymentReadiness.incompleteMethods > 0 ? `${paymentReadiness.incompleteMethods} active method(s) still look like placeholders.` : undefined,
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

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DashboardAreaChart
          data={trendData}
          hasTrendData={hasTrendData}
          paidTotal={totalPaid}
          outstandingTotal={totalUnpaid}
        />

        <div className="grid gap-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cedar">Proofs</p>
                <h2 className="mt-2 text-lg font-bold text-ink">Recent payment proofs</h2>
              </div>
              <Link className="text-sm font-semibold text-cedar" href="/proofs">
                Review all
              </Link>
            </div>
            <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-500">Pending in review queue</p>
              <p className="mt-1 text-2xl font-bold text-ink">{pendingProofs}</p>
            </div>
            <div className="grid gap-3">
              {proofsWithSignedUrls.length === 0 ? (
                <PremiumEmptyState
                  title="No proofs uploaded yet."
                  description="Client payment screenshots and PDFs will appear here for review."
                  example="Send your client the public /pay/… link — uploads land in your proof queue automatically."
                  icon={<ReceiptText className="h-6 w-6" aria-hidden="true" />}
                  action={
                    <Link className="btn btn-primary text-xs" href="/invoices">
                      Open invoices
                    </Link>
                  }
                />
              ) : (
                proofsWithSignedUrls.map((proof) => (
                  <div key={proof.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cedar">Profile</p>
                <h2 className="mt-2 text-lg font-bold text-ink">Business profile</h2>
              </div>
              <Link className="text-sm font-semibold text-cedar hover:underline" href="/settings/profile">
                Edit
              </Link>
            </div>
            <div className="grid gap-4">
              {!profile?.business_name && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm text-amber-700">
                    <strong>Professional tip:</strong> Add your business name in settings so it appears on invoices.
                  </p>
                  <Link className="mt-2 inline-block text-sm font-bold text-amber-800 underline" href="/settings/profile">
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
    </AppShell>
  );
}
