import type { AiProofReviewStored } from "@/lib/ai-proof-verification";
import { parseStoredAiReview } from "@/lib/ai-proof-verification";
import { money } from "@/lib/format";

/** Quick-insert phrases for reviewer notes (append-friendly). */
export const REVIEWER_NOTE_CHIPS = [
  "Verified manually",
  "Amount mismatch",
  "Client uploaded unclear screenshot",
  "Duplicate transfer suspected"
] as const;

export type WarningSeverity = "critical" | "warning" | "info";

/** Classify existing warning strings for display only (does not change AI extraction). */
export function getWarningSeverity(text: string): WarningSeverity {
  const t = text.toLowerCase();
  if (
    t.includes("amount mismatch") ||
    t.includes("wrong currency") ||
    t.includes("does not closely match remaining") ||
    t.includes("does not closely match full invoice")
  ) {
    return "critical";
  }
  if (
    t.includes("blurry") ||
    t.includes("crop") ||
    t.includes("unclear") ||
    t.includes("unsupported") ||
    t.includes("not clearly visible")
  ) {
    return "warning";
  }
  return "info";
}

export type BannerTone = "success" | "caution" | "danger" | "neutral";

export function getAiBanner(aiStored: AiProofReviewStored | null): {
  tone: BannerTone;
  title: string;
  subtitle: string;
} | null {
  if (!aiStored) return null;
  switch (aiStored.queue_tag) {
    case "likely_valid":
      return {
        tone: "success",
        title: "Likely valid",
        subtitle: "No strong mismatches flagged — still verify manually before accepting."
      };
    case "amount_mismatch":
      return {
        tone: "danger",
        title: "Possible mismatch",
        subtitle: "Amount or currency may not line up — review carefully before accepting."
      };
    case "unclear_screenshot":
      return {
        tone: "caution",
        title: "Unclear screenshot",
        subtitle: "Image quality or visibility limits confidence — consider asking for a clearer upload."
      };
    default:
      return {
        tone: "caution",
        title: "Needs attention",
        subtitle: "One or more advisory flags — confirm details on the proof image."
      };
  }
}

function near(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol;
}

export type AmountRowStatus = "match" | "mismatch" | "unknown";

/** Compare primary-currency amounts for UI (advisory). */
export function getPrimaryAmountComparison(input: {
  primary: "USD" | "LBP";
  invoiceTotal: number;
  remaining: number;
  clientPrimary: number | null;
  aiUsd: number | null;
  aiLbp: number | null;
}): {
  remainingLabel: string;
  invoiceTotalLabel: string;
  clientLabel: string;
  aiLabel: string;
  status: AmountRowStatus;
} {
  const { primary, invoiceTotal, remaining, clientPrimary, aiUsd, aiLbp } = input;
  const aiPrimary = primary === "USD" ? aiUsd : aiLbp;
  const tol = primary === "USD" ? 0.02 : 1;

  const remainingLabel = money(remaining, primary);
  const invoiceTotalLabel = money(invoiceTotal, primary);
  const clientLabel =
    clientPrimary === null || clientPrimary === undefined || !Number.isFinite(clientPrimary)
      ? "—"
      : money(clientPrimary, primary);
  const aiLabel =
    aiPrimary === null || aiPrimary === undefined || !Number.isFinite(aiPrimary) || aiPrimary <= 0
      ? "Not visible"
      : money(aiPrimary, primary);

  if (aiPrimary === null || aiPrimary === undefined || !Number.isFinite(aiPrimary) || aiPrimary <= 0) {
    return {
      remainingLabel,
      invoiceTotalLabel,
      clientLabel,
      aiLabel,
      status: "unknown"
    };
  }

  const matchesRemaining = near(aiPrimary, remaining, tol);
  const matchesInvoice = near(aiPrimary, invoiceTotal, tol);
  const status: AmountRowStatus =
    matchesRemaining || matchesInvoice ? "match" : "mismatch";

  return {
    remainingLabel,
    invoiceTotalLabel,
    clientLabel,
    aiLabel,
    status
  };
}

/** Sort pending proofs: mismatch → unclear → needs_attention → likely_valid → no AI; then oldest first. */
export function aiQueueSortKey(proof: { status: string; ai_review_json?: unknown }): number {
  if (proof.status !== "pending") return 1000;
  const stored = parseStoredAiReview(proof.ai_review_json);
  const tag = stored?.queue_tag;
  if (tag === "amount_mismatch") return 0;
  if (tag === "unclear_screenshot") return 1;
  if (tag === "needs_attention") return 2;
  if (tag === "likely_valid") return 3;
  return 4;
}
