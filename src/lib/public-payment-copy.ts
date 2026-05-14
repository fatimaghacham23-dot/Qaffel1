export type PublicPaymentPhase =
  | "paid"
  | "partial"
  | "overdue"
  | "expired"
  | "deposit_due"
  | "awaiting_approval"
  | "rejected"
  | "proof_pending"
  | "awaiting_payment"
  | "quote";

export type PublicPaymentTimelineStep = {
  id: string;
  label: string;
  description: string;
  done: boolean;
  current?: boolean;
};

function waHref(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  let n = d;
  if (n.startsWith("961")) return `https://wa.me/${n}`;
  if (n.startsWith("0")) n = `961${n.slice(1)}`;
  else if (!n.startsWith("961")) n = `961${n}`;
  return `https://wa.me/${n}`;
}

export function businessWhatsAppHref(phone: string | null | undefined): string | null {
  return waHref(phone);
}

/** Client-facing status headline, derived only from existing invoice/proof state. */
export function publicPaymentPhase(input: {
  isQuote: boolean;
  displayStatus: string;
  isExpired: boolean;
  approvalStatus: string | null | undefined;
  showDepositRequest: boolean;
  pendingProofCount: number;
}): { phase: PublicPaymentPhase; headline: string; subline: string } {
  const { isQuote, displayStatus, isExpired, approvalStatus, showDepositRequest, pendingProofCount } = input;
  const ds = displayStatus;

  if (isQuote) {
    return {
      phase: "quote",
      headline: "Quote ready for review",
      subline: "Review the scope, amount, and validity before approving or discussing changes with the business."
    };
  }

  if (approvalStatus === "rejected") {
    return {
      phase: "rejected",
      headline: "Not accepting payment",
      subline: "This document was rejected. Contact the business before sending money."
    };
  }

  if (isExpired) {
    return {
      phase: "expired",
      headline: "Payment link expired",
      subline: "Ask the business for an updated link before sending payment or uploading proof."
    };
  }

  if (approvalStatus === "pending") {
    return {
      phase: "awaiting_approval",
      headline: "Awaiting your approval",
      subline: "Approve this document first. Payment instructions apply after approval."
    };
  }

  if (ds === "paid") {
    return {
      phase: "paid",
      headline: "Payment confirmed",
      subline: "This invoice is fully settled in the business records."
    };
  }

  if (pendingProofCount > 0) {
    return {
      phase: "proof_pending",
      headline: "Manual review in progress",
      subline: "Your uploaded proof is waiting for the business to review. The invoice updates after acceptance."
    };
  }

  if (ds === "partial") {
    return {
      phase: "partial",
      headline: "Partial payment recorded",
      subline: "A payment has been accepted. Pay the remaining balance when you and the business are ready."
    };
  }

  if (showDepositRequest) {
    return {
      phase: "deposit_due",
      headline: "Deposit requested",
      subline: "Pay the requested deposit first unless you have arranged a different amount with the business."
    };
  }

  if (ds === "overdue") {
    return {
      phase: "overdue",
      headline: "Past due, still payable",
      subline: "You can still pay from this page, upload proof if you already paid, or contact the business to agree next steps."
    };
  }

  return {
    phase: "awaiting_payment",
    headline: "Payment due",
    subline: "Choose a payment method, send the payment, then upload proof for manual review."
  };
}

export function buildPublicPaymentTimeline(input: {
  isQuote: boolean;
  displayStatus: string;
  isExpired: boolean;
  approvalStatus: string | null | undefined;
  pendingProofCount: number;
  hasAcceptedPayments: boolean;
}): PublicPaymentTimelineStep[] {
  const { isQuote, displayStatus, isExpired, approvalStatus, pendingProofCount, hasAcceptedPayments } = input;

  if (isQuote) {
    return [
      { id: "issued", label: "Quote issued", description: "Review the details and total.", done: true },
      {
        id: "decision",
        label: "Your decision",
        description: "Approve the quote or discuss changes directly with the business.",
        done: approvalStatus === "approved"
      },
      { id: "next", label: "Invoice next", description: "The business can convert this to an invoice when you are aligned.", done: false }
    ];
  }

  if (isExpired) {
    return [
      { id: "expired", label: "Link expired", description: "This payment page is no longer valid.", done: true },
      { id: "contact", label: "Request an updated link", description: "Contact the business before sending payment.", done: false }
    ];
  }

  if (approvalStatus === "rejected") {
    return [
      { id: "rejected", label: "Document rejected", description: "Payment upload is disabled for this document.", done: true },
      { id: "contact", label: "Contact the business", description: "Ask for a revised invoice or updated instructions.", done: false }
    ];
  }

  const approvalOk = approvalStatus !== "pending";
  const hasProgress = hasAcceptedPayments || pendingProofCount > 0 || displayStatus === "partial";
  const fullyPaid = displayStatus === "paid";

  const steps: PublicPaymentTimelineStep[] = [
    {
      id: "ready",
      label: approvalOk ? "Invoice ready" : "Approval needed",
      description: approvalOk ? "The amount, due date, and payment methods are visible on this link." : "Approve this invoice before payment.",
      done: approvalOk
    },
    {
      id: "pay",
      label: "Pay and upload proof",
      description: "Use one listed method. Upload a screenshot or PDF so the business can match the payment.",
      done: hasProgress || fullyPaid
    },
    {
      id: "review",
      label: "Manual review",
      description: "The business accepts, rejects, or records payments manually. Uploads are not auto-approved.",
      done: pendingProofCount === 0 && (hasAcceptedPayments || fullyPaid || displayStatus === "partial")
    },
    {
      id: "closed",
      label: "Fully settled",
      description: "No remaining balance is shown on this invoice.",
      done: fullyPaid
    }
  ];

  let currentAssigned = false;
  for (const step of steps) {
    if (!step.done && !currentAssigned) {
      step.current = true;
      currentAssigned = true;
    }
  }

  return steps;
}

/** Lists payment method labels actually configured; no popularity or speed claims. */
export function formatMethodListForHelper(labels: string[]): string | null {
  const unique = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  if (!unique.length) return null;
  return `Accepted on this page: ${unique.join(" / ")}.`;
}
