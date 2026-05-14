import { isQuoteDocument } from "@/lib/documents";
import {
  evaluatePaymentReadiness,
  evaluateProfileCompleteness,
  paymentMethodNeedsDetailAttention,
  type PaymentMethodRow
} from "@/lib/operations";
import { getDisplayInvoiceStatus, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";
import type { InvoiceStatus } from "@/lib/types";

export type LaunchStepKey =
  | "business_profile"
  | "logo_branding"
  | "payment_methods"
  | "first_client"
  | "first_invoice"
  | "public_payment_page"
  | "first_proof_review"
  | "first_payment"
  | "follow_up_habit";

export type LaunchStepCategory = "identity" | "payments" | "workflow" | "operations";

export type BusinessLaunchStep = {
  key: LaunchStepKey;
  category: LaunchStepCategory;
  title: string;
  description: string;
  why: string;
  href: string;
  ctaLabel: string;
  completed: boolean;
  optional?: boolean;
};

export type BusinessLaunchReadiness = {
  score: number;
  tier: "foundation" | "launching" | "operational";
  strengths: string[];
  missingSetup: string[];
  recommendations: string[];
};

export type BusinessLaunchHelpItem = {
  id: string;
  title: string;
  body: string;
  href?: string;
  ctaLabel?: string;
};

export type BusinessLaunchModel = {
  steps: BusinessLaunchStep[];
  completedCount: number;
  totalCount: number;
  percent: number;
  nextStep: BusinessLaunchStep | null;
  isComplete: boolean;
  isNewWorkspace: boolean;
  readiness: BusinessLaunchReadiness;
  help: BusinessLaunchHelpItem[];
};

export type BusinessLaunchProfile = {
  business_name?: string | null;
  phone?: string | null;
  business_address?: string | null;
  logo_storage_path?: string | null;
  brand_color?: string | null;
  brand_accent?: string | null;
  document_theme?: string | null;
} | null;

export type BusinessLaunchClient = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  created_at?: string | null;
};

export type BusinessLaunchProof = MinimalProof & {
  id?: string | null;
  uploaded_at?: string | null;
  confirmed_at?: string | null;
  payment_date?: string | null;
  voided_at?: string | null;
  method?: string | null;
};

export type BusinessLaunchInvoice = {
  id?: string | null;
  status: InvoiceStatus;
  document_type?: string | null;
  approval_status?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  currency?: string | null;
  created_at?: string | null;
  due_date?: string | null;
  valid_until?: string | null;
  public_token?: string | null;
  client_id?: string | null;
  deposit_enabled?: boolean | null;
  deposit_amount_usd?: number | string | null;
  deposit_amount_lbp?: number | string | null;
  deposit_percent?: number | string | null;
  payment_plan?: unknown;
  payment_proofs?: BusinessLaunchProof[] | null;
};

export type BusinessLaunchEvent = {
  invoice_id?: string | null;
  event_type: string;
  created_at?: string | null;
  metadata?: unknown;
};

export type BuildBusinessLaunchInput = {
  profile: BusinessLaunchProfile;
  userEmail?: string | null;
  paymentMethods: PaymentMethodRow[];
  clients: BusinessLaunchClient[];
  invoices: BusinessLaunchInvoice[];
  events: BusinessLaunchEvent[];
};

function normalizeProofs(invoice: BusinessLaunchInvoice): MinimalProof[] {
  return (invoice.payment_proofs || []).map((proof) => ({
    status: proof.status || "",
    amount_usd: proof.amount_usd == null ? null : Number(proof.amount_usd),
    amount_lbp: proof.amount_lbp == null ? null : Number(proof.amount_lbp)
  }));
}

function displayStatus(invoice: BusinessLaunchInvoice) {
  const reconciled = reconcileInvoiceStatus(
    {
      amount_usd: invoice.amount_usd == null ? null : Number(invoice.amount_usd),
      amount_lbp: invoice.amount_lbp == null ? null : Number(invoice.amount_lbp),
      currency: invoice.currency,
      status: invoice.status
    },
    normalizeProofs(invoice)
  );
  return getDisplayInvoiceStatus({ status: reconciled, due_date: invoice.due_date });
}

function isReviewedProofStatus(status: string | null | undefined) {
  return ["accepted", "rejected", "voided"].includes((status || "").toLowerCase());
}

function hasCustomBranding(profile: BusinessLaunchProfile) {
  const theme = (profile?.document_theme || "").trim().toLowerCase();
  const brandColor = (profile?.brand_color || "").trim().toLowerCase();
  return Boolean(
    profile?.logo_storage_path?.trim() ||
      profile?.brand_accent?.trim() ||
      (theme && theme !== "professional") ||
      (brandColor && brandColor !== "#116466")
  );
}

function hasDepositSetup(invoices: BusinessLaunchInvoice[]) {
  return invoices.some((invoice) =>
    Boolean(
      invoice.deposit_enabled ||
        Number(invoice.deposit_amount_usd || 0) > 0 ||
        Number(invoice.deposit_amount_lbp || 0) > 0 ||
        Number(invoice.deposit_percent || 0) > 0
    )
  );
}

function hasPaymentPlanSetup(invoices: BusinessLaunchInvoice[]) {
  return invoices.some((invoice) => {
    if (!invoice.payment_plan) return false;
    if (typeof invoice.payment_plan === "string") return invoice.payment_plan.trim().length > 2;
    if (Array.isArray(invoice.payment_plan)) return invoice.payment_plan.length > 0;
    if (typeof invoice.payment_plan === "object") return Object.keys(invoice.payment_plan as Record<string, unknown>).length > 0;
    return false;
  });
}

function eventTypes(events: BusinessLaunchEvent[]) {
  return new Set(events.map((event) => event.event_type));
}

function tierForScore(score: number): BusinessLaunchReadiness["tier"] {
  if (score >= 80) return "operational";
  if (score >= 45) return "launching";
  return "foundation";
}

function scoreReadiness(input: {
  profileReady: boolean;
  brandingReady: boolean;
  paymentReady: boolean;
  hasClient: boolean;
  hasInvoice: boolean;
  hasPublicPage: boolean;
  hasReviewedProof: boolean;
  hasFirstPayment: boolean;
  hasRecoveryHabit: boolean;
}) {
  let score = 0;
  if (input.profileReady) score += 12;
  if (input.brandingReady) score += 8;
  if (input.paymentReady) score += 18;
  if (input.hasClient) score += 10;
  if (input.hasInvoice) score += 14;
  if (input.hasPublicPage) score += 10;
  if (input.hasReviewedProof) score += 10;
  if (input.hasFirstPayment) score += 10;
  if (input.hasRecoveryHabit) score += 8;
  return Math.min(100, score);
}

function limited(items: string[], max = 3) {
  return items.slice(0, max);
}

export function buildBusinessLaunchModel(input: BuildBusinessLaunchInput): BusinessLaunchModel {
  const methods = input.paymentMethods || [];
  const activeMethods = methods.filter((method) => method.is_active);
  const billableInvoices = (input.invoices || []).filter((invoice) => !isQuoteDocument(invoice));
  const events = input.events || [];
  const eventSet = eventTypes(events);
  const paymentReadiness = evaluatePaymentReadiness(activeMethods);
  const profileCompleteness = evaluateProfileCompleteness({
    profile: input.profile,
    userEmail: input.userEmail,
    hasActivePaymentMethod: activeMethods.length > 0
  });

  const profileReady = profileCompleteness.businessName && profileCompleteness.phone && profileCompleteness.email;
  const brandingReady = hasCustomBranding(input.profile);
  const incompleteActiveMethods = activeMethods.filter(paymentMethodNeedsDetailAttention).length;
  const paymentReady =
    paymentReadiness.hasActiveMethod &&
    paymentReadiness.whishOmtComplete &&
    paymentReadiness.instructionsPresent &&
    incompleteActiveMethods === 0;
  const hasClient = input.clients.length > 0;
  const hasInvoice = billableInvoices.length > 0;
  const hasPublicPage = billableInvoices.some((invoice) => Boolean(invoice.public_token));
  const hasReviewedProof =
    billableInvoices.some((invoice) => (invoice.payment_proofs || []).some((proof) => isReviewedProofStatus(proof.status))) ||
    eventSet.has("proof_accepted") ||
    eventSet.has("proof_rejected") ||
    eventSet.has("payment_voided");
  const hasFirstPayment =
    billableInvoices.some((invoice) => displayStatus(invoice) === "paid") ||
    billableInvoices.some((invoice) => (invoice.payment_proofs || []).some((proof) => (proof.status || "").toLowerCase() === "accepted")) ||
    eventSet.has("proof_accepted") ||
    eventSet.has("manual_payment");
  const hasRecoveryHabit =
    eventSet.has("reminder_copied") ||
    eventSet.has("deposit_requested") ||
    eventSet.has("payment_plan_saved") ||
    hasDepositSetup(billableInvoices) ||
    hasPaymentPlanSetup(billableInvoices);

  const steps: BusinessLaunchStep[] = [
    {
      key: "business_profile",
      category: "identity",
      title: "Add business profile basics",
      description: "Business name, account email, and phone are present.",
      why: "These fields appear across invoices, receipts, and client-facing pages.",
      href: "/settings/profile",
      ctaLabel: "Edit profile",
      completed: profileReady
    },
    {
      key: "logo_branding",
      category: "identity",
      title: "Set logo or document branding",
      description: "Use a logo, document theme, or brand accent so public pages feel recognizable.",
      why: "Branding helps clients trust that the payment page belongs to your business.",
      href: "/settings/profile",
      ctaLabel: "Open branding",
      completed: brandingReady
    },
    {
      key: "payment_methods",
      category: "payments",
      title: "Activate clear payment methods",
      description: "At least one active method has complete client instructions.",
      why:
        incompleteActiveMethods > 0
          ? `${incompleteActiveMethods} active method${incompleteActiveMethods === 1 ? "" : "s"} still need clearer details.`
          : "Clients need visible Whish, OMT, cash, bank, or custom instructions before they can pay.",
      href: "/settings/payment-methods",
      ctaLabel: "Manage methods",
      completed: paymentReady
    },
    {
      key: "first_client",
      category: "workflow",
      title: "Add your first client",
      description: "Create a client record with the contact details you use for follow-up.",
      why: "Clients anchor invoices, statements, WhatsApp follow-up, and balance tracking.",
      href: "/clients/new",
      ctaLabel: "New client",
      completed: hasClient
    },
    {
      key: "first_invoice",
      category: "workflow",
      title: "Create your first invoice",
      description: "Issue one billable invoice so the payment workflow can start.",
      why: "Invoices create the public payment page, proof upload path, and collection timeline.",
      href: "/invoices/new",
      ctaLabel: "New invoice",
      completed: hasInvoice
    },
    {
      key: "public_payment_page",
      category: "payments",
      title: "Open a public payment page",
      description: "Confirm that at least one invoice has a client-facing payment link.",
      why: "The public page is where clients see payment methods and upload proof for manual review.",
      href: "/invoices",
      ctaLabel: "Open invoices",
      completed: hasPublicPage
    },
    {
      key: "first_proof_review",
      category: "workflow",
      title: "Review your first payment proof",
      description: "Accept, reject, or void a proof after checking the uploaded screenshot or receipt.",
      why: "Qaffel keeps proof review manual so payment authority stays with your team.",
      href: "/proofs",
      ctaLabel: "Review proofs",
      completed: hasReviewedProof
    },
    {
      key: "first_payment",
      category: "workflow",
      title: "Confirm your first payment",
      description: "Record an accepted proof or manual payment tied to an invoice.",
      why: "Confirmed payments unlock receipts, paid status, and cleaner client statements.",
      href: "/proofs",
      ctaLabel: "Open proofs",
      completed: hasFirstPayment
    },
    {
      key: "follow_up_habit",
      category: "operations",
      title: "Try one follow-up control",
      description: "Use a reminder, deposit request, or payment plan on a real invoice when it fits.",
      why: "Follow-up tools improve consistency without sending anything automatically.",
      href: "/invoices",
      ctaLabel: "Find invoice",
      completed: hasRecoveryHabit,
      optional: true
    }
  ];

  const coreSteps = steps.filter((step) => !step.optional);
  const completedCount = coreSteps.filter((step) => step.completed).length;
  const totalCount = coreSteps.length;
  const percent = totalCount ? Math.round((completedCount / totalCount) * 100) : 100;
  const nextStep = coreSteps.find((step) => !step.completed) || steps.find((step) => step.optional && !step.completed) || null;

  const score = scoreReadiness({
    profileReady,
    brandingReady,
    paymentReady,
    hasClient,
    hasInvoice,
    hasPublicPage,
    hasReviewedProof,
    hasFirstPayment,
    hasRecoveryHabit
  });

  const strengths = limited([
    profileReady ? "Business identity is visible on client-facing surfaces." : "",
    paymentReady ? "Clients have at least one complete payment path." : "",
    hasPublicPage ? "A public payment page is available for invoice collection." : "",
    hasReviewedProof ? "Manual proof review has been exercised." : "",
    hasRecoveryHabit ? "Follow-up controls have been used or configured." : ""
  ].filter(Boolean));

  const missingSetup = limited([
    !profileReady ? "Complete business name, phone, and account email." : "",
    !brandingReady ? "Add a logo or adjust document branding." : "",
    !paymentReady ? "Activate one complete payment method." : "",
    !hasClient ? "Add the first client contact." : "",
    !hasInvoice ? "Create the first billable invoice." : "",
    !hasReviewedProof && hasInvoice ? "Review the first uploaded proof when it arrives." : "",
    !hasFirstPayment && hasInvoice ? "Confirm the first real payment after manual review." : ""
  ].filter(Boolean));

  const recommendations = limited([
    !paymentReady ? "Start with Whish or OMT if most clients pay through mobile transfers." : "",
    paymentReady && !hasInvoice ? "Create a small first invoice to preview the full client payment flow." : "",
    hasInvoice && !hasRecoveryHabit ? "When an invoice is unpaid, copy a reminder or add a deposit/payment plan only when appropriate." : "",
    hasFirstPayment && !brandingReady ? "Brand receipts and public pages before sending more links." : ""
  ].filter(Boolean));

  const help: BusinessLaunchHelpItem[] = [
    {
      id: "payment-proof-flow",
      title: "How proof review works",
      body: "Clients upload a screenshot or receipt from the public page. Your team still checks it manually before confirmation.",
      href: "/proofs",
      ctaLabel: "Open proofs"
    },
    {
      id: "payment-methods-conversion",
      title: "Why payment methods matter",
      body: "Clear Whish, OMT, cash, or bank instructions reduce back-and-forth before a client can pay.",
      href: "/settings/payment-methods",
      ctaLabel: "Review methods"
    },
    {
      id: "deposits-and-plans",
      title: "Deposits and payment plans",
      body: "Use deposits or plans when the agreement needs stages. Qaffel tracks the workflow, but never collects automatically.",
      href: "/invoices/new",
      ctaLabel: "Create invoice"
    }
  ];

  return {
    steps,
    completedCount,
    totalCount,
    percent,
    nextStep,
    isComplete: completedCount === totalCount,
    isNewWorkspace: input.clients.length === 0 && billableInvoices.length === 0 && activeMethods.length === 0,
    readiness: {
      score,
      tier: tierForScore(score),
      strengths: strengths.length > 0 ? strengths : ["Workspace foundation is ready to be configured."],
      missingSetup,
      recommendations
    },
    help
  };
}
