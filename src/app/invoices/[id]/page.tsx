import Link from "next/link";
import {
  CircleDollarSign,
  Copy,
  ExternalLink,
  FileCheck2,
  Link2,
  MessageCircle,
  ReceiptText,
  RefreshCw
} from "lucide-react";
import { 
  convertQuoteToInvoiceAction,
  deleteInvoiceAction, 
  updateInvoiceAction, 
  duplicateInvoiceAction
} from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { InvoicePriorityBadges } from "@/components/InvoicePriorityBadges";
import { StatusBadge } from "@/components/StatusBadge";
import { ProofReviewForm } from "@/components/ProofReviewForm";
import { CopyButton } from "@/components/CopyButton";
import { ManualPaymentForm } from "@/components/ManualPaymentForm";
import { VoidPaymentButton } from "@/components/VoidPaymentButton";
import { FollowUpSection } from "@/components/FollowUpSection";
import { ExtendInvoiceValidityForm } from "@/components/ExtendInvoiceValidityForm";
import { InvoiceDepositFields } from "@/components/InvoiceDepositFields";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DeleteInvoiceButton } from "@/components/DeleteInvoiceButton";
import { QuickActionGrid, type ProductivityAction } from "@/components/ProductivityQuickActions";
import { SuggestedNextActionsCard } from "@/components/SuggestedNextActionsCard";
import { documentNoun, documentNounTitle, documentStatus, isQuoteDocument } from "@/lib/documents";
import { money, shortDate } from "@/lib/format";
import { getDepositStatus } from "@/lib/deposit";
import { getFriendlyLifecycleLabel, getInvoicePriorityFlags } from "@/lib/operations";
import { getDisplayInvoiceStatus, getRemainingBalance, reconcileInvoiceStatus } from "@/lib/status";
import { isAiVerificationEnabled, isProofImageForAi, parseStoredAiReview } from "@/lib/ai-proof-verification";
import { requireUser } from "@/lib/supabase/server";
import { invoiceStatuses } from "@/lib/types";
import { PaymentPlanEditor } from "@/components/PaymentPlanEditor";
import { InvoiceWorkMemoryPanel } from "@/components/workspace/InvoiceWorkMemoryPanel";
import { WorkspaceMessageTemplatesCard } from "@/components/workspace/WorkspaceMessageTemplatesCard";
import { AssignmentInlineBadges, OperationalAssignmentPanel } from "@/components/OperationalAssignmentPanel";
import { getAssignmentMembers, getAssignmentsForTarget } from "@/lib/assignment-data";
import { parsePaymentPlan } from "@/lib/payment-plan";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { hasPermission } from "@/lib/permissions";
import {
  computeRecoveryForInvoice,
  recoveryNextActionLabel,
  recoveryTierLabel,
  responsivenessLabel,
  type RecoveryInvoiceRow
} from "@/lib/recovery-engine";
import { buildSuggestedNextActionsForInvoice } from "@/lib/workflow-assistant";

function StatusChip({ tone, label }: { tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }) {
  const tones = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700"
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "good" | "warn" | "info";
}) {
  const tones = {
    neutral: "border-slate-200 bg-white",
    good: "border-emerald-100 bg-emerald-50/70",
    warn: "border-amber-100 bg-amber-50/70",
    info: "border-sky-100 bg-sky-50/70"
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-600">{detail}</p> : null}
    </div>
  );
}

export default async function InvoiceDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const ctx = await getWorkspaceContext();

  const [
    { data: invoice },
    { data: clients },
    { data: proofs },
    { data: events },
    { data: methods },
    { data: lastReminder },
    { data: recoveryContextRows },
    { data: invoiceWorkNotes },
    { data: workspaceTemplates }
  ] = await Promise.all([
    supabase.from("invoices").select("*, clients(id, name, phone, email)").eq("id", id).maybeSingle(),
    supabase.from("clients").select("id, name, phone, email").eq("workspace_id", ctx.workspaceId).order("name", { ascending: true }),
    supabase
      .from("payment_proofs")
      .select("*")
      .eq("invoice_id", id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("invoice_events")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("payment_methods").select("id, label, instructions").eq("workspace_id", ctx.workspaceId).eq("is_active", true).order("created_at", { ascending: true }),
    supabase
      .from("invoice_events")
      .select("created_at, metadata, actor_name, actor_role")
      .eq("invoice_id", id)
      .eq("event_type", "reminder_copied")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select(
        "id, client_id, status, created_at, document_type, currency, amount_usd, amount_lbp, due_date, valid_until, deposit_enabled, deposit_type, deposit_percent, deposit_amount_usd, deposit_amount_lbp, exchange_rate_lbp_per_usd, payment_proofs(status, amount_usd, amount_lbp, confirmed_at, uploaded_at)"
      )
      .eq("workspace_id", ctx.workspaceId),
    supabase
      .from("invoice_workspace_notes")
      .select("id, invoice_id, category, body, is_pinned, created_at, updated_at")
      .eq("invoice_id", id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("workspace_message_templates")
      .select("id, category, label, body, is_favorite, use_count, last_used_at, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("is_favorite", { ascending: false })
      .order("last_used_at", { ascending: false })
      .limit(40)
  ]);

  if (!invoice) {
    return (
      <AppShell>
        <div className="mb-6 text-center py-20">
          <h1 className="text-2xl font-bold text-ink">Invoice not found</h1>
          <p className="mt-2 text-slate-600">The invoice you are looking for does not exist or you do not have permission to view it.</p>
          <div className="mt-6">
            <Link className="btn btn-primary" href="/invoices">
              Back to invoices
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const assignmentMembers = await getAssignmentMembers(supabase, ctx.workspaceId);
  const invoiceAssignments = await getAssignmentsForTarget({
    supabase,
    workspaceId: ctx.workspaceId,
    targetType: "invoice",
    targetId: invoice.id,
    members: assignmentMembers
  });
  const canManageAssignments = hasPermission(ctx.role, "assignments.manage");
  const canWorkAssignments = hasPermission(ctx.role, "assignments.work");

  const proofsWithSignedUrls = await Promise.all(
    (proofs || []).map(async (proof) => {
      const aiImageEligible = isProofImageForAi(proof.image_url);
      if (!proof.image_url) {
        return { ...proof, ai_image_eligible: aiImageEligible };
      }
      if (proof.image_url.startsWith("http")) {
        return { ...proof, ai_image_eligible: aiImageEligible };
      }

      const { data } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(proof.image_url, 3600);

      return {
        ...proof,
        ai_image_eligible: aiImageEligible,
        image_url: data?.signedUrl || proof.image_url
      };
    })
  );

  const aiVerificationEnabled = isAiVerificationEnabled();

  const balance = getRemainingBalance(invoice, proofsWithSignedUrls);
  const reconciledStatus = reconcileInvoiceStatus(invoice, proofsWithSignedUrls);
  const minimalProofs = proofsWithSignedUrls.map((p) => ({
    status: p.status || "",
    amount_usd: p.amount_usd,
    amount_lbp: p.amount_lbp
  }));
  const parsedPlan = parsePaymentPlan((invoice as { payment_plan?: unknown }).payment_plan);
  const recoveryAll = (recoveryContextRows || []) as RecoveryInvoiceRow[];
  const recoveryInvoiceRow: RecoveryInvoiceRow = {
    ...(invoice as RecoveryInvoiceRow),
    payment_proofs: proofsWithSignedUrls.map((p) => ({
      status: p.status,
      amount_usd: p.amount_usd,
      amount_lbp: p.amount_lbp,
      confirmed_at: (p as { confirmed_at?: string | null }).confirmed_at,
      uploaded_at: (p as { uploaded_at?: string | null }).uploaded_at
    }))
  };
  const recoveryEvents = (events || []).map(
    (e: { invoice_id: string; event_type: string; created_at: string; metadata?: unknown }) => ({
      invoice_id: e.invoice_id,
      event_type: e.event_type,
      created_at: e.created_at,
      metadata: (e.metadata as Record<string, unknown>) || null
    })
  );
  const recovery = computeRecoveryForInvoice({
    invoice: recoveryInvoiceRow,
    proofs: minimalProofs,
    events: recoveryEvents,
    allUserInvoices: recoveryAll.map((r) => ({ ...r, payment_proofs: r.payment_proofs || [] }))
  });
  const isQuote = isQuoteDocument(invoice);
  const displayStatus = isQuote
    ? documentStatus({ ...invoice, status: reconciledStatus })
    : getDisplayInvoiceStatus({ ...invoice, status: reconciledStatus });
  const friendlyLifecycle = getFriendlyLifecycleLabel({
    invoice: { ...invoice, status: reconciledStatus },
    proofs: minimalProofs,
    reconciledStatus
  });
  const priorityFlags = getInvoicePriorityFlags({
    invoice,
    proofs: minimalProofs,
    displayStatus,
    reconciledStatus
  });
  const noun = documentNoun(invoice);
  const nounTitle = documentNounTitle(invoice);
  const depositStatus = getDepositStatus(invoice, proofsWithSignedUrls);
  const depositFullyPaid = depositStatus?.label === "Fully paid invoice";
  const isExpired = invoice.valid_until && new Date(invoice.valid_until) < new Date() && (isQuote ? displayStatus === "expired" : displayStatus !== "paid");
  const showExtendValidity =
    !isQuote &&
    Boolean(invoice.valid_until) &&
    displayStatus !== "paid" &&
    (isExpired ||
      (() => {
        const vu = new Date(invoice.valid_until as string);
        if (Number.isNaN(vu.getTime())) return false;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        vu.setHours(0, 0, 0, 0);
        const days = Math.round((vu.getTime() - now.getTime()) / 86400000);
        return days >= 0 && days <= 14;
      })());
  const hasPaymentMethods = (methods || []).length > 0;
  const acceptedProofs = proofsWithSignedUrls.filter((proof) => proof.status === "accepted");
  const voidedProofs = proofsWithSignedUrls.filter((proof) => proof.status === "voided");
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${invoice.public_token}`;
  const clientEmail = invoice.clients?.email;
  const clientPhone = invoice.clients?.phone;
  const pendingProofCount = proofsWithSignedUrls.filter((proof) => proof.status === "pending").length;
  const statusChips = [
    isExpired ? { tone: "danger" as const, label: "Expired link" } : null,
    displayStatus === "overdue" ? { tone: "danger" as const, label: "Overdue invoice" } : null,
    invoice.deposit_enabled ? { tone: "info" as const, label: "Deposit requested" } : null,
    displayStatus === "partial" ? { tone: "info" as const, label: "Partial payment" } : null,
    displayStatus === "paid" ? { tone: "good" as const, label: "Fully paid" } : null,
    voidedProofs.length > 0 ? { tone: "neutral" as const, label: "Voided payment" } : null,
    !clientPhone ? { tone: "warn" as const, label: "Missing client phone" } : null,
    !clientEmail ? { tone: "warn" as const, label: "Missing client email" } : null,
    displayStatus === "draft" ? { tone: "neutral" as const, label: "Draft invoice" } : null,
    invoice.approval_status === "pending" ? { tone: "warn" as const, label: "Client approval required" } : null,
    !isQuote && acceptedProofs.length === 0 ? { tone: "warn" as const, label: "No accepted payments" } : null,
    !isQuote && !hasPaymentMethods ? { tone: "warn" as const, label: "No payment methods active" } : null,
    invoice.public_token ? { tone: "good" as const, label: "Portal link active" } : null
  ].filter(Boolean) as Array<{ tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }>;

  const invoiceSuggestedActions = buildSuggestedNextActionsForInvoice({
    invoice: {
      ...(invoice as any),
      payment_proofs: proofsWithSignedUrls
    },
    allInvoices: recoveryAll.map((row) => ({ ...row, payment_proofs: row.payment_proofs || [] })) as any,
    events: (events || []) as any
  });

  const baseEvents = events || [];
  const collapsedBaseEvents = baseEvents.reduce((acc: any[], event: any) => {
    const previous = acc[acc.length - 1];
    const isReceiptView = event.event_type === "receipt_viewed";
    const sameAsPreviousReceiptView = Boolean(
      isReceiptView &&
      previous &&
      previous.event_type === "receipt_viewed" &&
      previous.message === event.message
    );

    if (sameAsPreviousReceiptView) {
      const currentCount = Number(previous.collapsed_count || 1);
      previous.collapsed_count = currentCount + 1;
      return acc;
    }

    acc.push({ ...event, collapsed_count: 1 });
    return acc;
  }, []);
  const hasExpiredEvent = baseEvents.some((event: any) => event.event_type === "invoice_expired");
  const timelineEvents = isExpired && !hasExpiredEvent
    ? [
        {
          id: "invoice-expired",
          message: "Invoice expired",
          created_at: invoice.valid_until || new Date().toISOString()
        },
        ...collapsedBaseEvents
      ]
    : collapsedBaseEvents;

  const contextualActionCandidates: Array<ProductivityAction | null> = [
    pendingProofCount > 0
      ? {
          label: "Review proofs",
          description: `${pendingProofCount} pending upload${pendingProofCount === 1 ? "" : "s"}`,
          href: "#proofs-review",
          icon: FileCheck2,
          badge: pendingProofCount,
          tone: "attention"
        }
      : null,
    !isQuote && balance.primaryBalance > 0
      ? {
          label: displayStatus === "overdue" ? "Copy reminder" : "Follow up",
          description: displayStatus === "overdue" ? "Recovery action first" : "Balance still open",
          href: "#follow-up",
          icon: MessageCircle,
          tone: displayStatus === "overdue" ? "attention" : "default"
        }
      : null,
    showExtendValidity
      ? {
          label: "Extend validity",
          description: isExpired ? "Payment link expired" : "Payment link expiring soon",
          href: "#extend-validity",
          icon: RefreshCw,
          tone: "attention"
        }
      : null,
    !isQuote && displayStatus !== "paid"
      ? {
          label: "Record payment",
          description: "Cash, Whish, OMT, bank",
          href: "#manual-payment",
          icon: CircleDollarSign
        }
      : null,
    acceptedProofs[0]?.receipt_token
      ? {
          label: "Open receipt",
          description: "Share proof of payment",
          href: `/receipt/${acceptedProofs[0].receipt_token}`,
          icon: ReceiptText,
          tone: "positive",
          external: true
        }
      : null,
    invoice.public_token
      ? {
          label: "Public page",
          description: "Client payment surface",
          href: `/pay/${invoice.public_token}`,
          icon: ExternalLink,
          external: true
        }
      : null,
    invoice.public_token
      ? {
          label: "Copy link",
          description: "Use the public URL panel below",
          href: "#public-link",
          icon: Copy
        }
      : null
  ];
  const contextualActions = contextualActionCandidates.filter((action): action is ProductivityAction => Boolean(action));

  return (
    <AppShell>
      <div className="mb-6">
        <Link className="text-sm font-semibold text-cedar print:hidden" href="/invoices">
          Back to invoices
        </Link>
        <section className="mt-3 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
          <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={displayStatus} label={friendlyLifecycle} />
                <StatusBadge status={isQuote ? "quote" : "active"} label={nounTitle} />
                {invoice.approval_status && invoice.approval_status !== "not_required" ? (
                  <StatusBadge status={invoice.approval_status} label={`Approval: ${invoice.approval_status}`} />
                ) : null}
              </div>
              <h1 className="mt-4 break-words text-3xl font-bold tracking-normal text-ink lg:text-4xl">
                {invoice.invoice_number ? `${invoice.invoice_number} - ${invoice.title}` : invoice.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="font-semibold text-ink">{invoice.clients?.name || "No client selected"}</span>
                <span>Created {shortDate(invoice.created_at)}</span>
                <span>{invoice.due_date ? `Due ${shortDate(invoice.due_date)}` : "No due date"}</span>
              </div>
              <InvoicePriorityBadges flags={priorityFlags} className="mt-4" />
              <AssignmentInlineBadges assignments={invoiceAssignments} />
              <div className="mt-4 flex flex-wrap gap-2">
                {statusChips.map((chip) => (
                  <StatusChip key={chip.label} tone={chip.tone} label={chip.label} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Primary actions</p>
              <div className="mt-4 grid gap-2">
                <Link className="btn btn-primary w-full text-xs" href={`/invoices/${invoice.id}/print`} target="_blank">
                  <ReceiptText className="h-4 w-4" aria-hidden="true" />
                  Print {noun}
                </Link>
                <Link className="btn btn-secondary w-full text-xs" href={`/pay/${invoice.public_token}`} target="_blank">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open public page
                </Link>
                {isQuote && (
                  <form action={convertQuoteToInvoiceAction}>
                    <input name="id" type="hidden" value={invoice.id} />
                    <button className="btn btn-primary w-full text-xs" type="submit">
                      Convert to invoice
                    </button>
                  </form>
                )}
                <form action={duplicateInvoiceAction}>
                  <input name="id" type="hidden" value={invoice.id} />
                  <button className="btn btn-secondary w-full text-xs" type="submit">
                    Duplicate
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>

      <QuickActionGrid
        className="mb-6"
        title="Contextual actions"
        subtitle={
          displayStatus === "overdue"
            ? "Recovery actions are prioritized for this overdue invoice."
            : pendingProofCount > 0
              ? "Proof review is the next operational step."
              : displayStatus === "paid"
                ? "Receipt and sharing actions are ready."
                : "Fast actions for this invoice state."
        }
        actions={contextualActions}
        compact
      />

      <SuggestedNextActionsCard actions={invoiceSuggestedActions} />

      {isExpired && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700 font-medium">
            Expired: This {noun} link has expired. Extend it below to allow client access.
          </p>
        </div>
      )}

      {isQuote && (
        <div className="mb-6 rounded-md border border-violet-200 bg-violet-50 p-4">
          <p className="text-sm font-semibold text-violet-900">This is a quote, not a payment request yet.</p>
          <p className="mt-1 text-sm text-violet-800">
            Convert it to an invoice when you are ready to collect payment. The public client link will stay the same.
          </p>
        </div>
      )}

      {!isQuote && !hasPaymentMethods && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">
            No payment methods active. Clients will see no instructions.
          </p>
          <Link className="mt-2 inline-block text-xs font-bold text-amber-800 underline" href="/settings/payment-methods">
            Add methods
          </Link>
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard
          label={`${nounTitle} amount`}
          value={invoice.currency === "USD" ? money(invoice.amount_usd, "USD") : money(invoice.amount_lbp, "LBP")}
          detail={`Primary currency: ${invoice.currency || "USD"}`}
        />
        {isQuote ? (
          <>
            <SummaryCard label="Document type" value="Quote" detail="Payment collection starts after conversion" tone="info" />
            <SummaryCard label="Approval" value={invoice.approval_status || "not_required"} detail="Client approval workflow" />
          </>
        ) : (
          <>
            <SummaryCard
              label="Total paid"
              value={invoice.currency === "USD" ? money(balance.totalPaidUsd, "USD") : money(balance.totalPaidLbp, "LBP")}
              detail={`${acceptedProofs.length} accepted payment${acceptedProofs.length === 1 ? "" : "s"}`}
              tone="good"
            />
            <SummaryCard
              label="Remaining"
              value={money(balance.primaryBalance, balance.primaryCurrency as any)}
              detail={balance.primaryBalance > 0 ? "Needs follow-up" : "Settled"}
              tone={balance.primaryBalance > 0 ? "warn" : "good"}
            />
          </>
        )}
      </div>

      {!isQuote && depositStatus && (
        <section className="panel mb-6 border-sky-100 bg-sky-50/70">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Deposit requested</p>
              <p className="mt-1 text-xl font-bold text-ink">
                {money(depositStatus.request.amount, depositStatus.request.currency)}
              </p>
              {depositStatus.request.type === "percent" && depositStatus.request.percent ? (
                <p className="mt-1 text-xs text-sky-700">{depositStatus.request.percent}% of invoice total</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Deposit status</p>
              <p className="mt-1 text-xl font-bold text-ink">{depositStatus.label}</p>
              {depositStatus.label === "Not paid" ? (
                <p className="mt-1 text-xs text-sky-700">
                  Deposit still due: {money(depositStatus.remainingDeposit, depositStatus.request.currency)}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700">
                {depositFullyPaid ? "Remaining invoice balance" : "Remaining after deposit"}
              </p>
              <p className="mt-1 text-xl font-bold text-ink">
                {depositFullyPaid
                  ? money(0, depositStatus.request.currency)
                  : money(depositStatus.request.remainingAfterDeposit, depositStatus.request.currency)}
              </p>
              {depositStatus.request.note ? (
                <p className="mt-1 text-xs italic text-sky-700">{depositStatus.request.note}</p>
              ) : null}
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <OperationalAssignmentPanel
            targetType="invoice"
            targetId={invoice.id}
            assignments={invoiceAssignments}
            members={assignmentMembers}
            canManage={canManageAssignments}
            canWork={canWorkAssignments}
            allowedTypes={["operations_owner", "finance_owner", "follow_up_owner", "payment_plan_owner", "approval_owner"]}
            title={`${nounTitle} ownership`}
            description="Keep the person or team responsible for review, finance, follow-up, and payment-plan continuity visible."
          />

          {!isQuote && recovery ? (
            <section className="panel border-indigo-100 bg-indigo-50/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">Recovery overview</h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Priority tier: {recoveryTierLabel(recovery.tier)}. Derived from due dates,
                    balances, reminders you copied, portal views, and this client&apos;s paid history.
                  </p>
                </div>
                <Link className="btn btn-secondary text-xs" href="/recoveries">
                  Recovery center
                </Link>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                <div>
                  <p>
                    <span className="font-semibold text-ink">Days overdue:</span> {recovery.daysOverdue}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-ink">Last reminder copied:</span>{" "}
                    {recovery.lastReminderAt ? shortDate(recovery.lastReminderAt) : "—"}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-ink">Client pattern:</span> {responsivenessLabel(recovery.responsiveness)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Suggested next steps</p>
                  <ul className="mt-1 list-inside list-decimal">
                    {recovery.nextActions.map((a) => (
                      <li key={a}>{recoveryNextActionLabel(a)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {!isQuote && balance.primaryBalance > 0 && !balance.unknown ? (
            <PaymentPlanEditor
              invoiceId={invoice.id}
              currency={balance.primaryCurrency as "USD" | "LBP"}
              remainingPrimary={balance.primaryBalance}
              initialPlan={parsedPlan}
            />
          ) : null}

          {!isQuote && (
            <FollowUpSection 
              invoice={invoice} 
              client={invoice.clients} 
              remainingBalance={balance} 
              lastReminder={lastReminder}
              events={(events || []) as any}
              proofs={proofsWithSignedUrls as any}
            />
          )}

          <WorkspaceMessageTemplatesCard initialTemplates={(workspaceTemplates || []) as any} />

          <InvoiceWorkMemoryPanel invoiceId={invoice.id} initialNotes={(invoiceWorkNotes || []) as any} />

          {showExtendValidity && (
            <ExtendInvoiceValidityForm 
              invoiceId={invoice.id} 
              currentValidUntil={invoice.valid_until} 
            />
          )}

          <section id="public-link" className="panel scroll-mt-24">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink">Public link</h2>
                <p className="mt-1 text-sm text-slate-600">Client-facing payment or quote page.</p>
              </div>
              <StatusChip tone={invoice.public_token ? "good" : "warn"} label={invoice.public_token ? "Portal link active" : "No portal link"} />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <p className="break-all rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-mono text-slate-600">
                {publicUrl}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <CopyButton 
                  value={publicUrl} 
                  label="Copy full link" 
                  className="btn btn-secondary text-xs flex-1"
                />
                <Link className="btn btn-secondary text-xs sm:w-auto" href={`/pay/${invoice.public_token}`} target="_blank">
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  View page
                </Link>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="mb-4 text-lg font-bold text-ink">{nounTitle} details</h2>
            <form action={updateInvoiceAction} className="grid gap-4">
              <input name="id" type="hidden" value={invoice.id} />
              <div>
                <p className="text-sm font-semibold text-ink">Document identity</p>
                <p className="mt-1 text-xs text-slate-500">Client, title, and client-facing description.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">{nounTitle} number</label>
                  <input className="field" defaultValue={invoice.invoice_number || ""} name="invoice_number" />
                </div>
                <div>
                  <label className="label">Client</label>
                  <select className="field" defaultValue={invoice.client_id || ""} name="client_id">
                    <option value="">No client</option>
                    {(clients || []).map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Title</label>
                <input className="field" defaultValue={invoice.title} name="title" required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="field min-h-24" defaultValue={invoice.description || ""} name="description" />
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-semibold text-ink">Amounts and due date</p>
                <p className="mt-1 text-xs text-slate-500">Primary currency, alternate amount, and invoice timing.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="label">Amount USD</label>
                  <input className="field" defaultValue={invoice.amount_usd || ""} min="0" name="amount_usd" type="number" step="0.01" />
                </div>
                <div>
                  <label className="label">Amount LBP</label>
                  <input className="field" defaultValue={invoice.amount_lbp || ""} min="0" name="amount_lbp" type="number" step="1" />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select className="field" defaultValue={invoice.currency || "USD"} name="currency">
                    <option value="USD">USD</option>
                    <option value="LBP">LBP</option>
                  </select>
                </div>
                <div>
                  <label className="label">Due date</label>
                  <input className="field" defaultValue={invoice.due_date || ""} name="due_date" type="date" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Status</label>
                  <select className="field" defaultValue={isQuote ? invoice.status || "draft" : displayStatus || "draft"} name="status">
                    {invoiceStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Approval status</label>
                  <select className="field" defaultValue={invoice.approval_status || "not_required"} name="approval_status">
                    <option value="not_required">not_required</option>
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="rejected">rejected</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-semibold text-ink">Status and public access</p>
                <p className="mt-1 text-xs text-slate-500">Keep approval and validity clear before clients pay.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Valid until</label>
                  <input className="field" defaultValue={invoice.valid_until ? invoice.valid_until.slice(0, 16) : ""} name="valid_until" type="datetime-local" />
                </div>
                <div>
                  <label className="label">Exchange rate LBP per USD</label>
                  <input className="field" defaultValue={invoice.exchange_rate_lbp_per_usd || ""} min="0" name="exchange_rate_lbp_per_usd" step="1" type="number" />
                </div>
              </div>
              <div>
                <label className="label">Rate note</label>
                <textarea className="field min-h-20" defaultValue={invoice.rate_note || ""} name="rate_note" />
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-sm font-semibold text-ink">Deposit request</p>
                <p className="mt-1 text-xs text-slate-500">Optional upfront payment terms shown on the public page.</p>
              </div>
              <InvoiceDepositFields
                defaultCurrency={invoice.currency || "USD"}
                defaultDocumentType={invoice.document_type || "invoice"}
                defaultEnabled={Boolean(invoice.deposit_enabled)}
                defaultFixedAmountLbp={invoice.deposit_amount_lbp}
                defaultFixedAmountUsd={invoice.deposit_amount_usd}
                defaultInvoiceAmountLbp={invoice.amount_lbp}
                defaultInvoiceAmountUsd={invoice.amount_usd}
                defaultNote={invoice.deposit_note}
                defaultPercent={invoice.deposit_percent}
                defaultType={invoice.deposit_type}
                idPrefix="edit_deposit"
              />
              <div className="flex gap-2 mt-4">
                <button className="btn btn-primary" type="submit">Update {noun}</button>
              </div>
            </form>
          </section>

          <section className="panel">
            <h2 className="mb-4 text-lg font-bold text-ink">Timeline</h2>
            <div className="space-y-4">
              {timelineEvents.map((event: any) => (
                <div key={event.id} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 flex-none rounded-full bg-slate-200" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {event.message}
                      {event.collapsed_count > 1 ? ` (${event.collapsed_count}x)` : ""}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {shortDate(event.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {!isQuote ? (
            <ManualPaymentForm invoiceId={invoice.id} isPaid={displayStatus === "paid"} />
          ) : (
            <section className="panel border-violet-100 bg-violet-50">
              <h2 className="mb-2 text-lg font-bold text-ink">Quote mode</h2>
              <p className="text-sm text-violet-800">
                Payment collection and proof review will appear after this quote is converted to an invoice.
              </p>
            </section>
          )}

          {!isQuote && (
            <section id="proofs-review" className="panel scroll-mt-24">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">Payments and proofs</h2>
                  <p className="mt-1 text-sm text-slate-600">Manual payments, uploaded proof review, receipts, and void actions.</p>
                </div>
                {acceptedProofs.length > 0 ? (
                  <StatusChip tone="good" label={`${acceptedProofs.length} accepted`} />
                ) : (
                  <StatusChip tone="warn" label="No accepted payments" />
                )}
              </div>
              <div className="space-y-4">
              {(proofsWithSignedUrls || []).map((proof) => (
                <div key={proof.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge status={proof.status} />
                    <span className="text-[10px] text-slate-400">{shortDate(proof.uploaded_at)}</span>
                  </div>
                  <div className="text-sm font-bold text-ink mb-2">
                    {proof.amount_usd ? money(proof.amount_usd, "USD") : ""}
                    {proof.amount_usd && proof.amount_lbp ? " + " : ""}
                    {proof.amount_lbp ? money(proof.amount_lbp, "LBP") : ""}
                  </div>
                  {proof.status === "pending" && (
                    <ProofReviewForm
                      key={`${proof.id}-${(proof as any).reviewer_decision_note || ""}-${(proof as any).ai_analyzed_at || ""}`}
                      proofId={proof.id}
                      invoiceId={invoice.id}
                      currentInvoiceStatus={reconciledStatus}
                      method={proof.method}
                      aiVerificationEnabled={aiVerificationEnabled}
                      aiImageEligible={Boolean((proof as any).ai_image_eligible)}
                      aiStored={parseStoredAiReview((proof as any).ai_review_json)}
                      aiSummary={(proof as any).ai_review_summary ?? null}
                      aiAnalyzedAt={(proof as any).ai_analyzed_at ?? null}
                      reviewerDecisionNote={(proof as any).reviewer_decision_note ?? null}
                      invoicePrimaryCurrency={invoice.currency || "USD"}
                      invoiceAmountUsd={Number(invoice.amount_usd || 0)}
                      invoiceAmountLbp={Number(invoice.amount_lbp || 0)}
                      remainingPrimary={balance.primaryBalance}
                      proofAmountUsd={proof.amount_usd}
                      proofAmountLbp={proof.amount_lbp}
                      paymentDate={proof.payment_date}
                      proofImageUrl={proof.image_url ?? null}
                    />
                  )}
                  {proof.status === "accepted" && (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link 
                          className="btn btn-secondary text-[10px] py-1 px-2" 
                          href={`/receipt/${proof.receipt_token}`} 
                          target="_blank"
                        >
                          Open receipt
                        </Link>
                        <CopyLinkButton 
                          value={`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/receipt/${proof.receipt_token}`} 
                          label="Copy link" 
                          className="btn btn-secondary text-[10px] py-1 px-2" 
                        />
                      </div>
                      <VoidPaymentButton proofId={proof.id} />
                    </div>
                  )}
                </div>
              ))}
              {proofsWithSignedUrls.length === 0 && <p className="text-sm text-slate-500 italic">No proofs yet.</p>}
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-red-200 bg-red-50/70 p-5 print:hidden">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-red-800">Delete danger zone</p>
            <p className="mt-1 text-sm text-red-700">Deleting this {noun} removes it from your workspace. Payment and reconciliation logic is unchanged.</p>
          </div>
          <form action={deleteInvoiceAction}>
            <input name="id" type="hidden" value={invoice.id} />
            <DeleteInvoiceButton className="btn btn-danger w-full text-xs sm:w-auto" />
          </form>
        </div>
      </section>
    </AppShell>
  );
}
