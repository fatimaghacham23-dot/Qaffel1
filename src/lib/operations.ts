import { getDepositStatus, type DepositInvoice } from "./deposit";
import { documentStatus, isQuoteDocument } from "./documents";
import { getDisplayInvoiceStatus, type MinimalProof } from "./status";
import type { InvoiceStatus } from "./types";

export type FriendlyLifecycle =
  | "Draft"
  | "Sent"
  | "Viewed"
  | "Partial"
  | "Paid"
  | "Overdue"
  | "Expired"
  | "Quote";

/** User-facing lifecycle labels (DB enums unchanged). */
export function getFriendlyLifecycleLabel(input: {
  invoice: {
    status: InvoiceStatus;
    due_date?: string | null;
    valid_until?: string | null;
    document_type?: string | null;
    approval_status?: string | null;
  };
  proofs: MinimalProof[];
  reconciledStatus?: InvoiceStatus;
}): FriendlyLifecycle | string {
  const invoice = input.invoice;
  const proofs = input.proofs || [];
  const isQuote = isQuoteDocument(invoice);
  const statusBase = input.reconciledStatus ?? invoice.status;

  if (isQuote) {
    const qs = documentStatus({ ...invoice, status: statusBase });
    if (qs === "expired") return "Expired";
    if (qs === "approved") return "Paid";
    if (qs === "rejected") return "Draft";
    return "Quote";
  }

  const display = getDisplayInvoiceStatus({ ...invoice, status: statusBase });

  if (display === "paid") return "Paid";
  if (display === "partial") return "Partial";
  if (display === "overdue") return "Overdue";
  if (display === "draft") return "Draft";
  if (display === "rejected") return "Draft";

  const engaged = proofs.some((p) =>
    ["pending", "accepted", "rejected"].includes((p.status || "").toLowerCase())
  );
  if (engaged) return "Viewed";

  if (display === "sent" || display === "unpaid") return "Sent";

  return display.charAt(0).toUpperCase() + display.slice(1);
}

export type PriorityFlagKey =
  | "needs_follow_up"
  | "awaiting_proof_review"
  | "deposit_pending"
  | "overdue"
  | "expiring_soon";

export type PriorityFlag = { key: PriorityFlagKey; label: string };

const MS_DAY = 86400000;

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / MS_DAY);
}

/** Operational priority chips derived from invoice + proofs only (no fabricated data). */
export function getInvoicePriorityFlags(input: {
  invoice: DepositInvoice & { valid_until?: string | null; due_date?: string | null; document_type?: string | null };
  proofs: MinimalProof[];
  displayStatus: string;
  reconciledStatus?: InvoiceStatus;
}): PriorityFlag[] {
  const { invoice, proofs } = input;
  const isQuote = isQuoteDocument(invoice);
  const statusForDeposit = input.reconciledStatus ?? invoice.status;
  const invoiceForDeposit = { ...invoice, status: statusForDeposit };
  const display = input.displayStatus;

  const flags: PriorityFlag[] = [];
  const seen = new Set<PriorityFlagKey>();

  const push = (key: PriorityFlagKey, label: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    flags.push({ key, label });
  };

  const pendingProofs = proofs.filter((p) => (p.status || "").toLowerCase() === "pending");
  if (pendingProofs.length > 0) {
    push("awaiting_proof_review", "Awaiting proof review");
  }

  if (!isQuote) {
    const deposit = getDepositStatus(invoiceForDeposit, proofs);
    if (deposit?.label === "Not paid") {
      push("deposit_pending", "Deposit pending");
    }
  }

  if (display === "overdue") {
    push("overdue", "Overdue");
  }

  if (!isQuote && invoice.valid_until) {
    const days = daysUntil(invoice.valid_until);
    if (days !== null && days >= 0 && days <= 7 && display !== "paid") {
      push("expiring_soon", "Expiring soon");
    }
  }

  if (!isQuote && display !== "paid" && display !== "draft") {
    const dueIn = daysUntil(invoice.due_date || null);
    const isDueSoon = dueIn !== null && dueIn >= 0 && dueIn <= 7;
    const notOverdueYet = display !== "overdue";
    if (isDueSoon && notOverdueYet && ["sent", "unpaid", "partial"].includes(display)) {
      push("needs_follow_up", "Needs follow-up");
    }
  }

  return flags;
}

export type ClientHealth = "good" | "attention" | "risk";

export function getClientHealth(input: {
  hasOverdueInvoice: boolean;
  hasOpenBalance: boolean;
}): ClientHealth {
  if (input.hasOverdueInvoice) return "risk";
  if (input.hasOpenBalance) return "attention";
  return "good";
}

export type PaymentMethodRow = {
  type: string;
  label: string;
  instructions: string;
  is_active: boolean;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  account_reference?: string | null;
  qr_image_path?: string | null;
  external_link?: string | null;
};

/** Mirrors PaymentMethodsManager heuristic: short or placeholder instructions need attention. */
export function paymentMethodNeedsDetailAttention(method: PaymentMethodRow): boolean {
  const text = `${method.label}\n${method.instructions}`.toLowerCase();
  return (
    method.instructions.trim().length < 12 ||
    /(^|\n)\s*(name|phone|bank|iban|account name|receiver name):\s*($|\n)/i.test(method.instructions) ||
    text.includes("todo") ||
    text.includes("replace")
  );
}

export type PaymentReadiness = {
  hasActiveMethod: boolean;
  whishOmtComplete: boolean;
  instructionsPresent: boolean;
  /** Methods flagged as needing filled-in details */
  incompleteMethods: number;
};

export function evaluatePaymentReadiness(methods: PaymentMethodRow[]): PaymentReadiness {
  const active = methods.filter((m) => m.is_active);
  const hasActiveMethod = active.length > 0;

  const whishOmt = active.filter((m) => {
    const t = (m.type || "").toLowerCase();
    return t.includes("whish") || t.includes("omt");
  });
  const whishOmtComplete =
    whishOmt.length === 0
      ? true
      : whishOmt.every((m) => !paymentMethodNeedsDetailAttention(m));

  const instructionsPresent = active.every((m) => m.instructions.trim().length >= 8);
  const incompleteMethods = active.filter((m) => paymentMethodNeedsDetailAttention(m)).length;

  return {
    hasActiveMethod,
    whishOmtComplete,
    instructionsPresent,
    incompleteMethods
  };
}

export type ProfileCompleteness = {
  businessName: boolean;
  phone: boolean;
  email: boolean;
  /** Stored branding — uses business name until a dedicated logo field exists */
  brandIdentity: boolean;
  paymentMethodsActive: boolean;
  businessAddress: boolean;
};

export function evaluateProfileCompleteness(input: {
  profile: { business_name?: string | null; phone?: string | null; business_address?: string | null } | null;
  userEmail: string | null | undefined;
  hasActivePaymentMethod: boolean;
}): ProfileCompleteness {
  return {
    businessName: Boolean(input.profile?.business_name?.trim()),
    phone: Boolean(input.profile?.phone?.trim()),
    email: Boolean(input.userEmail?.trim()),
    brandIdentity: Boolean(input.profile?.business_name?.trim()),
    paymentMethodsActive: input.hasActivePaymentMethod,
    businessAddress: Boolean(input.profile?.business_address?.trim())
  };
}

/** Pending proof age tier for urgency badges on /proofs */
export type ProofUrgency = "fresh" | "over24h" | "over3d";

export function getPendingProofUrgency(uploadedAt: string | null | undefined): ProofUrgency {
  if (!uploadedAt) return "fresh";
  const uploaded = new Date(uploadedAt).getTime();
  if (Number.isNaN(uploaded)) return "fresh";
  const hours = (Date.now() - uploaded) / (1000 * 60 * 60);
  if (hours >= 72) return "over3d";
  if (hours >= 24) return "over24h";
  return "fresh";
}
