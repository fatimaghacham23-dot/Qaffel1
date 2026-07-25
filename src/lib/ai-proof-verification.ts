import "server-only";
import { createHash } from "crypto";

export type AiExtractedFields = {
  amount_usd: number | null;
  amount_lbp: number | null;
  currency: string | null;
  method_text: string | null;
  date_time_text: string | null;
  receiver_name: string | null;
  sender_name: string | null;
};

export type AiImageQuality = "readable" | "blurry" | "partially_cropped" | "unclear" | "not_visible" | "unsupported";

export type AiQueueTag = "likely_valid" | "needs_attention" | "unclear_screenshot" | "amount_mismatch";

export type AiProofReviewStored = {
  version: 1;
  extracted: AiExtractedFields;
  model_notes: string[];
  image_quality: AiImageQuality;
  warnings: string[];
  queue_tag: AiQueueTag;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAiVerificationEnabled(): boolean {
  return (
    String(process.env.AI_VERIFICATION_ENABLED || "").toLowerCase() === "true" &&
    Boolean(String(process.env.GITHUB_MODELS_API_KEY || "").trim())
  );
}

export function proofImageFingerprint(imageUrl: string, uploadedAt: string | null | undefined): string {
  const payload = `${imageUrl}|${uploadedAt || ""}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function isProofImageForAi(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  const lower = imageUrl.toLowerCase();
  if (lower.includes(".pdf")) return false;
  return /\.(jpe?g|png|webp)(\?|#|$)/i.test(lower);
}

export function parseStoredAiReview(raw: unknown): AiProofReviewStored | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Partial<AiProofReviewStored>;
  if (o.version !== 1 || !o.extracted || !Array.isArray(o.warnings) || !o.queue_tag) return null;
  return o as AiProofReviewStored;
}

function nearEqual(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol;
}

export function computeWarningsAndQueueTag(input: {
  extracted: AiExtractedFields;
  image_quality: AiImageQuality;
  model_notes: string[];
  invoicePrimaryCurrency: string;
  invoiceAmountUsd: number;
  invoiceAmountLbp: number;
  remainingPrimary: number;
  proofAmountUsd: number | null;
  proofAmountLbp: number | null;
}): { warnings: string[]; queue_tag: AiQueueTag } {
  const warnings: string[] = [];
  const {
    extracted,
    image_quality,
    invoicePrimaryCurrency,
    invoiceAmountUsd,
    invoiceAmountLbp,
    remainingPrimary,
    proofAmountUsd,
    proofAmountLbp
  } = input;

  if (image_quality === "blurry" || image_quality === "unclear") {
    warnings.push("Screenshot appears blurry or unclear — verify details manually.");
  }
  if (image_quality === "partially_cropped") {
    warnings.push("Possible crop — key fields may be cut off.");
  }
  if (image_quality === "unsupported" || image_quality === "not_visible") {
    warnings.push("Unsupported or unclear image for automated reading.");
  }

  const cur = (extracted.currency || "").toUpperCase().trim();
  const primary = invoicePrimaryCurrency.toUpperCase();
  const curNorm = cur.replace(/\s+/g, "_");
  if (
    cur &&
    curNorm !== "NOT_VISIBLE" &&
    curNorm !== "NOT" &&
    cur !== "UNCLEAR" &&
    primary &&
    cur !== primary
  ) {
    warnings.push(`Possible wrong currency: screenshot suggests ${cur} but invoice primary is ${primary}.`);
  }

  const aiUsd = extracted.amount_usd;
  const aiLbp = extracted.amount_lbp;
  const hasAiUsd = aiUsd !== null && aiUsd !== undefined && Number.isFinite(aiUsd) && aiUsd > 0;
  const hasAiLbp = aiLbp !== null && aiLbp !== undefined && Number.isFinite(aiLbp) && aiLbp > 0;
  const hasAiAmount = hasAiUsd || hasAiLbp;

  if (proofAmountUsd != null && hasAiUsd && !nearEqual(proofAmountUsd, aiUsd!, 0.02)) {
    warnings.push(
      "Amount mismatch: AI-read USD differs from the amount the client entered on the upload form."
    );
  }
  if (proofAmountLbp != null && hasAiLbp && !nearEqual(proofAmountLbp, aiLbp!, 1)) {
    warnings.push(
      "Amount mismatch: AI-read LBP differs from the amount the client entered on the upload form."
    );
  }

  if (!hasAiAmount) {
    warnings.push("Amount not clearly visible on screenshot — compare manually.");
  } else if (primary === "USD" && hasAiUsd && invoiceAmountUsd > 0) {
    if (!nearEqual(aiUsd!, remainingPrimary, 0.02) && !nearEqual(aiUsd!, invoiceAmountUsd, 0.02)) {
      warnings.push(
        "Amount mismatch: AI-read USD does not closely match remaining balance or full invoice total."
      );
    }
  } else if (primary === "LBP" && hasAiLbp && invoiceAmountLbp > 0) {
    if (!nearEqual(aiLbp!, remainingPrimary, 1) && !nearEqual(aiLbp!, invoiceAmountLbp, 1)) {
      warnings.push(
        "Amount mismatch: AI-read LBP does not closely match remaining balance or full invoice total."
      );
    }
  }

  let queue_tag: AiQueueTag = "likely_valid";
  const hasAmountMismatch = warnings.some((w) => w.startsWith("Amount mismatch"));
  if (hasAmountMismatch) {
    queue_tag = "amount_mismatch";
  } else if (image_quality === "blurry" || image_quality === "unclear" || image_quality === "not_visible") {
    queue_tag = "unclear_screenshot";
  } else if (warnings.length > 0) {
    queue_tag = "needs_attention";
  }

  return { warnings, queue_tag };
}

const VISION_SYSTEM = `You are a cautious document assistant for payment screenshots only.
Rules:
- Output a single JSON object, no markdown, no prose outside JSON.
- Never invent amounts, names, or dates. If you cannot read a field, use null or the string "not visible".
- Never claim certainty. Use model_notes for caveats (e.g. "low confidence", "partially obscured").
- Do not claim bank-grade or official verification.
- For currency use "USD", "LBP", "not visible", or "unclear" only.

JSON schema:
{
  "extracted": {
    "amount_usd": number | null,
    "amount_lbp": number | null,
    "currency": string | null,
    "method_text": string | null,
    "date_time_text": string | null,
    "receiver_name": string | null,
    "sender_name": string | null
  },
  "model_notes": string[],
  "image_quality": "readable" | "blurry" | "partially_cropped" | "unclear" | "not_visible" | "unsupported"
}`;

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(trimmed);
  if (fence) return fence[1].trim();
  return trimmed;
}

export async function callGithubGpt4oVision(params: {
  base64DataUrl: string;
}): Promise<{ extracted: AiExtractedFields; model_notes: string[]; image_quality: AiImageQuality }> {
  const token = String(process.env.GITHUB_MODELS_API_KEY || "").trim();
  if (!token) throw new Error("GITHUB_MODELS_API_KEY is not configured.");

  const body = {
    model: "openai/gpt-4o",
    temperature: 0.1,
    messages: [
      { role: "system", content: VISION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this payment screenshot. Return only the JSON object as specified."
          },
          {
            type: "image_url",
            image_url: { url: params.base64DataUrl }
          }
        ]
      }
    ]
  };

  const res = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`GitHub Models error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Empty response from model.");
  }

  let parsed: {
    extracted?: AiExtractedFields;
    model_notes?: string[];
    image_quality?: AiImageQuality;
  };
  try {
    parsed = JSON.parse(stripJsonFence(content)) as typeof parsed;
  } catch {
    throw new Error("Model did not return valid JSON.");
  }

  const extracted: AiExtractedFields = {
    amount_usd: parsed.extracted?.amount_usd ?? null,
    amount_lbp: parsed.extracted?.amount_lbp ?? null,
    currency: parsed.extracted?.currency ?? null,
    method_text: parsed.extracted?.method_text ?? null,
    date_time_text: parsed.extracted?.date_time_text ?? null,
    receiver_name: parsed.extracted?.receiver_name ?? null,
    sender_name: parsed.extracted?.sender_name ?? null
  };

  const model_notes = Array.isArray(parsed.model_notes) ? parsed.model_notes.map(String) : [];
  const image_quality = (parsed.image_quality || "unclear") as AiImageQuality;

  return { extracted, model_notes, image_quality };
}

export function buildAiSummary(stored: AiProofReviewStored): string {
  const e = stored.extracted;
  const parts: string[] = [];
  if (e.amount_usd != null) parts.push(`USD: ${e.amount_usd}`);
  if (e.amount_lbp != null) parts.push(`LBP: ${e.amount_lbp}`);
  if (e.currency) parts.push(`Currency read: ${e.currency}`);
  if (e.method_text) parts.push(`Method text: ${e.method_text}`);
  if (e.date_time_text) parts.push(`Date/time: ${e.date_time_text}`);
  if (e.receiver_name) parts.push(`Receiver: ${e.receiver_name}`);
  if (stored.model_notes.length) parts.push(`Notes: ${stored.model_notes.join("; ")}`);
  parts.push(`Image: ${stored.image_quality}`);
  parts.push(`Tag: ${stored.queue_tag}`);
  return parts.join(" · ");
}

export { MAX_IMAGE_BYTES };
