"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewProofAction, runAiProofVerificationAction, saveReviewerDecisionNoteAction } from "@/app/actions";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, Loader2, XCircle } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import type { AiProofReviewStored } from "@/lib/ai-proof-verification";
import {
  REVIEWER_NOTE_CHIPS,
  getAiBanner,
  getPrimaryAmountComparison,
  getWarningSeverity,
  type AmountRowStatus
} from "@/lib/ai-proof-review-ui";
import { ProofImagePreview } from "@/components/ProofImagePreview";

interface ProofReviewFormProps {
  proofId: string;
  invoiceId: string;
  currentInvoiceStatus: string;
  method?: string | null;
  aiVerificationEnabled: boolean;
  aiImageEligible: boolean;
  aiStored: AiProofReviewStored | null;
  aiSummary: string | null;
  aiAnalyzedAt: string | null;
  reviewerDecisionNote: string | null;
  invoicePrimaryCurrency: string;
  invoiceAmountUsd: number;
  invoiceAmountLbp: number;
  remainingPrimary: number;
  proofAmountUsd?: number | null;
  proofAmountLbp?: number | null;
  paymentDate?: string | null;
  proofImageUrl?: string | null;
}

const AI_LOADING_STEPS = [
  "Analyzing screenshot…",
  "Extracting payment details…",
  "Comparing invoice balance…"
] as const;

function amountCardTone(status: AmountRowStatus): { ring: string; bg: string; label: string } {
  if (status === "match") {
    return {
      ring: "ring-emerald-200/80",
      bg: "bg-emerald-50/90",
      label: "Match"
    };
  }
  if (status === "mismatch") {
    return {
      ring: "ring-red-200/80",
      bg: "bg-red-50/90",
      label: "Mismatch"
    };
  }
  return {
    ring: "ring-amber-200/80",
    bg: "bg-amber-50/80",
    label: "Unclear"
  };
}

function bannerClasses(tone: NonNullable<ReturnType<typeof getAiBanner>>["tone"]) {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-gradient-to-r from-emerald-50 to-white text-emerald-950";
    case "danger":
      return "border-red-200 bg-gradient-to-r from-red-50 to-white text-red-950";
    case "neutral":
      return "border-slate-200 bg-slate-50 text-slate-900";
    default:
      return "border-amber-200 bg-gradient-to-r from-amber-50 to-white text-amber-950";
  }
}

function severityBadge(sev: ReturnType<typeof getWarningSeverity>) {
  if (sev === "critical") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-800">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Critical
      </span>
    );
  }
  if (sev === "warning") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-900">
      <Info className="h-3 w-3" aria-hidden />
      Info
    </span>
  );
}

export function ProofReviewForm({
  proofId,
  invoiceId,
  currentInvoiceStatus,
  method,
  aiVerificationEnabled,
  aiImageEligible,
  aiStored,
  aiSummary,
  aiAnalyzedAt,
  reviewerDecisionNote,
  invoicePrimaryCurrency,
  invoiceAmountUsd,
  invoiceAmountLbp,
  remainingPrimary,
  proofAmountUsd,
  proofAmountLbp,
  paymentDate,
  proofImageUrl
}: ProofReviewFormProps) {
  const router = useRouter();
  const [isReviewPending, startReview] = useTransition();
  const [isAiPending, startAi] = useTransition();
  const [isNotePending, startNote] = useTransition();
  const [note, setNote] = useState(() => reviewerDecisionNote || "");
  const [aiStepIndex, setAiStepIndex] = useState(0);
  const reviewLockRef = useRef(false);
  const aiLockRef = useRef(false);
  const noteLockRef = useRef(false);

  useEffect(() => {
    if (!isAiPending) return;
    const id = window.setInterval(() => {
      setAiStepIndex((i) => (i + 1) % AI_LOADING_STEPS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [isAiPending]);

  const aiStepDisplay = isAiPending ? aiStepIndex : 0;

  const handleAction = (status: "accepted" | "rejected", invoiceStatus?: string) => {
    if (reviewLockRef.current) return;
    reviewLockRef.current = true;
    const formData = new FormData();
    formData.append("proof_id", proofId);
    formData.append("invoice_id", invoiceId);
    formData.append("proof_status", status);
    formData.append("invoice_status", invoiceStatus ?? (status === "accepted" ? "paid" : currentInvoiceStatus));

    startReview(async () => {
      try {
        await reviewProofAction(formData);
        if (status === "accepted") {
          toast.success("Payment proof accepted; invoice balance was reconciled.");
        } else {
          toast.success("Payment proof rejected.");
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update proof status.");
      } finally {
        reviewLockRef.current = false;
      }
    });
  };

  const runAiAssist = () => {
    if (aiLockRef.current) return;
    aiLockRef.current = true;
    setAiStepIndex(0);
    const formData = new FormData();
    formData.append("proof_id", proofId);
    formData.append("invoice_id", invoiceId);
    startAi(async () => {
      try {
        const result = await runAiProofVerificationAction(formData);
        if (result?.cached) {
          toast.message("AI review already up to date for this screenshot.");
        } else {
          toast.success("Advisory AI review completed. Manual acceptance is still required.");
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "AI assist failed.");
      } finally {
        aiLockRef.current = false;
      }
    });
  };

  const saveNote = (next?: string) => {
    if (noteLockRef.current) return;
    noteLockRef.current = true;
    const value = next ?? note;
    const formData = new FormData();
    formData.append("proof_id", proofId);
    formData.append("invoice_id", invoiceId);
    formData.append("reviewer_decision_note", value);
    startNote(async () => {
      try {
        await saveReviewerDecisionNoteAction(formData);
        setNote(value);
        toast.success("Reviewer note saved (internal only).");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save note.");
      } finally {
        noteLockRef.current = false;
      }
    });
  };

  const appendChip = (chip: string) => {
    setNote((prev) => {
      const t = prev.trim();
      if (!t) return chip;
      if (t.includes(chip)) return t;
      return `${t}\n${chip}`;
    });
  };

  const requestReupload = () => {
    if (noteLockRef.current) return;
    noteLockRef.current = true;
    const line = "Request: ask client to re-upload a clearer proof.";
    const next = note.trim() ? (note.includes("re-upload") ? note : `${note.trim()}\n${line}`) : line;
    setNote(next);
    const formData = new FormData();
    formData.append("proof_id", proofId);
    formData.append("invoice_id", invoiceId);
    formData.append("reviewer_decision_note", next);
    startNote(async () => {
      try {
        await saveReviewerDecisionNoteAction(formData);
        toast.success("Note saved — follow up with the client for a new screenshot.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save note.");
      } finally {
        noteLockRef.current = false;
      }
    });
  };

  const normalizedMethod = (method || "").toLowerCase();
  const isWhishOrOmt = normalizedMethod.includes("whish") || normalizedMethod.includes("omt");
  const primary = invoicePrimaryCurrency.toUpperCase() === "LBP" ? "LBP" : "USD";
  const invoiceTotalPrimary = primary === "USD" ? invoiceAmountUsd : invoiceAmountLbp;
  const clientPrimary =
    primary === "USD"
      ? proofAmountUsd != null && Number.isFinite(Number(proofAmountUsd))
        ? Number(proofAmountUsd)
        : null
      : proofAmountLbp != null && Number.isFinite(Number(proofAmountLbp))
        ? Number(proofAmountLbp)
        : null;

  const amountCompare = useMemo(
    () =>
      getPrimaryAmountComparison({
        primary,
        invoiceTotal: invoiceTotalPrimary,
        remaining: remainingPrimary,
        clientPrimary,
        aiUsd: aiStored?.extracted.amount_usd ?? null,
        aiLbp: aiStored?.extracted.amount_lbp ?? null
      }),
    [primary, invoiceTotalPrimary, remainingPrimary, clientPrimary, aiStored]
  );

  const banner = aiStored ? getAiBanner(aiStored) : null;
  const amountTone = amountCardTone(amountCompare.status);

  const invCur = (invoicePrimaryCurrency || "USD").toUpperCase();
  const aiCur = (aiStored?.extracted.currency || "").toUpperCase().trim();
  const currencyStatus: AmountRowStatus =
    !aiCur || aiCur === "UNKNOWN" || aiCur === "NOT VISIBLE"
      ? "unknown"
      : invCur === "LBP" && (aiCur.includes("LBP") || aiCur.includes("LL"))
        ? "match"
        : invCur === "USD" && (aiCur.includes("USD") || aiCur === "$" || aiCur === "US")
          ? "match"
          : invCur === aiCur
            ? "match"
            : "mismatch";
  const currencyTone = amountCardTone(currencyStatus);

  const warningsGrouped = useMemo(() => {
    if (!aiStored?.warnings.length) return { critical: [] as string[], warning: [] as string[], info: [] as string[] };
    const critical: string[] = [];
    const warning: string[] = [];
    const info: string[] = [];
    for (const w of aiStored.warnings) {
      const s = getWarningSeverity(w);
      if (s === "critical") critical.push(w);
      else if (s === "warning") warning.push(w);
      else info.push(w);
    }
    return { critical, warning, info };
  }, [aiStored]);

  return (
    <div className="flex flex-col gap-4 touch-manipulation">
      {proofImageUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Proof image</p>
            <p className="mt-0.5 text-xs text-slate-600">Tap to zoom · open full image from the preview.</p>
          </div>
          <ProofImagePreview imageUrl={proofImageUrl} alt="Payment proof" thumbClassName="h-28 w-32 sm:h-24 sm:w-28" />
        </div>
      ) : null}

      {aiVerificationEnabled && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-950">
          <p className="font-bold uppercase tracking-wide text-violet-800">AI verification assistant</p>
          <p className="mt-1 leading-relaxed text-violet-900">
            GPT-4o vision runs on your screenshot to surface hints. It is <strong>not</strong> bank-grade, can be wrong,
            and <strong>never</strong> auto-accepts or rejects. You always decide manually.
          </p>
          {aiImageEligible ? (
            <button
              type="button"
              className="btn btn-secondary mt-2 w-full text-xs sm:w-auto"
              disabled={isAiPending}
              onClick={runAiAssist}
            >
              {isAiPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  {AI_LOADING_STEPS[aiStepDisplay]}
                </span>
              ) : aiStored ? (
                "Re-run AI assist"
              ) : (
                "Run AI assist on screenshot"
              )}
            </button>
          ) : (
            <p className="mt-2 text-[11px] text-violet-800">
              AI screenshot assist is only available for pending JPG, PNG, or WebP uploads (not PDF).
            </p>
          )}
          {isAiPending ? (
            <div
              className="mt-3 space-y-2 rounded-lg border border-violet-200/80 bg-white/60 p-3"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold text-violet-900">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" aria-hidden />
                Advisory AI pass in progress
              </div>
              <ul className="grid gap-1.5 text-[10px] text-violet-800">
                {AI_LOADING_STEPS.map((step, i) => (
                  <li
                    key={step}
                    className={`flex items-center gap-2 rounded-md px-2 py-1 ${
                      i === aiStepDisplay ? "bg-violet-100/90 font-semibold text-violet-950" : "opacity-70"
                    }`}
                  >
                    {i < aiStepDisplay ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    ) : i === aiStepDisplay ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-600" aria-hidden />
                    ) : (
                      <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-violet-300" />
                    )}
                    {step.replace("…", "")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {banner ? (
        <div
          className={`rounded-xl border p-3 shadow-sm sm:p-4 ${bannerClasses(banner.tone)}`}
          role="status"
        >
          <div className="flex flex-wrap items-start gap-2">
            {banner.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            ) : banner.tone === "danger" ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
            ) : (
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold tracking-tight">{banner.title}</p>
              <p className="mt-1 text-xs leading-relaxed opacity-95">{banner.subtitle}</p>
            </div>
          </div>
        </div>
      ) : null}

      {aiStored ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
            <span className="font-semibold uppercase tracking-wide text-slate-600">Verification summary</span>
            {aiAnalyzedAt ? <span>Updated {shortDate(aiAnalyzedAt)}</span> : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Invoice (expected)</p>
              <p className="mt-2 text-lg font-bold text-ink">{amountCompare.invoiceTotalLabel}</p>
              <p className="mt-1 text-[11px] text-slate-600">Full invoice total ({primary})</p>
              <p className="mt-3 border-t border-slate-100 pt-2 text-sm font-semibold text-slate-800">
                Remaining due: {amountCompare.remainingLabel}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Client entered</p>
              <p className="mt-2 text-lg font-bold text-ink">{amountCompare.clientLabel}</p>
              <p className="mt-1 text-[11px] text-slate-600">Amount on upload ({primary})</p>
              {proofAmountUsd != null || proofAmountLbp != null ? (
                <p className="mt-2 text-[10px] text-slate-500">
                  {proofAmountUsd != null ? money(proofAmountUsd, "USD") : ""}
                  {proofAmountUsd != null && proofAmountLbp != null ? " · " : ""}
                  {proofAmountLbp != null ? money(proofAmountLbp, "LBP") : ""}
                </p>
              ) : null}
              {paymentDate ? (
                <p className="mt-2 text-[11px] text-slate-600">Payment date: {shortDate(paymentDate)}</p>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">AI detected</p>
              <p className="mt-2 text-lg font-bold text-ink">{amountCompare.aiLabel}</p>
              <p className="mt-1 text-[11px] text-slate-600">Primary line read from screenshot ({primary})</p>
              <p className="mt-2 text-[10px] text-slate-500">
                Also: {aiStored.extracted.amount_usd != null ? money(aiStored.extracted.amount_usd, "USD") : "—"} USD ·{" "}
                {aiStored.extracted.amount_lbp != null ? money(aiStored.extracted.amount_lbp, "LBP") : "—"} LBP
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={`rounded-xl border p-3 shadow-sm ring-2 ${amountTone.ring} ${amountTone.bg}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Amount check</p>
              <dl className="mt-2 space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-2 border-b border-black/5 pb-1">
                  <dt className="text-slate-600">Expected (remaining)</dt>
                  <dd className="font-semibold text-slate-900">{amountCompare.remainingLabel}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-black/5 pb-1">
                  <dt className="text-slate-600">AI detected</dt>
                  <dd className="font-semibold text-slate-900">{amountCompare.aiLabel}</dd>
                </div>
                <div className="flex justify-between gap-2 pt-0.5">
                  <dt className="font-bold text-slate-800">Status</dt>
                  <dd className="font-bold text-slate-900">{amountTone.label}</dd>
                </div>
              </dl>
            </div>
            <div
              className={`rounded-xl border p-3 shadow-sm ring-2 ${currencyTone.ring} ${currencyTone.bg}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Currency check</p>
              <dl className="mt-2 space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-2 border-b border-black/5 pb-1">
                  <dt className="text-slate-600">Invoice currency</dt>
                  <dd className="font-semibold text-slate-900">{invCur}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-black/5 pb-1">
                  <dt className="text-slate-600">AI detected</dt>
                  <dd className="max-w-[55%] text-right font-semibold break-words text-slate-900">
                    {aiStored.extracted.currency?.trim() || "Not visible"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 pt-0.5">
                  <dt className="font-bold text-slate-800">Status</dt>
                  <dd className="font-bold text-slate-900">{currencyTone.label}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-800">
            <p className="text-[10px] font-bold uppercase text-slate-500">Method & timestamp (AI read)</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[10px] text-slate-500">Method text</p>
                <p className="font-medium break-words">{aiStored.extracted.method_text || "Not visible"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500">Date / time text</p>
                <p className="break-words">{aiStored.extracted.date_time_text || "Not visible"}</p>
              </div>
            </div>
          </div>

          {aiStored.model_notes.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-500">Model notes</p>
              <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                {aiStored.model_notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(warningsGrouped.critical.length > 0 ||
            warningsGrouped.warning.length > 0 ||
            warningsGrouped.info.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-bold uppercase text-slate-600">AI flags (by severity)</p>
              <ul className="mt-2 space-y-2">
                {[...warningsGrouped.critical, ...warningsGrouped.warning, ...warningsGrouped.info].map((w, i) => (
                  <li
                    key={`${w}-${i}`}
                    className="flex flex-wrap items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2 text-[11px] text-slate-800"
                  >
                    {severityBadge(getWarningSeverity(w))}
                    <span className="min-w-0 flex-1 leading-snug">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {aiSummary ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
              <span className="font-semibold text-slate-800">Summary: </span>
              {aiSummary}
            </p>
          ) : null}

          <p className="text-[10px] leading-relaxed text-slate-500">
            AI suggestions are advisory only. Final review is always manual.
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <label className="text-xs font-semibold text-slate-700" htmlFor={`reviewer-note-${proofId}`}>
          Internal reviewer note
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REVIEWER_NOTE_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700 transition hover:border-cedar/30 hover:bg-white"
              onClick={() => appendChip(chip)}
            >
              + {chip}
            </button>
          ))}
        </div>
        <textarea
          id={`reviewer-note-${proofId}`}
          className="field mt-2 min-h-24 text-xs"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Your decision context (not shown to clients)…"
        />
        <button type="button" className="btn btn-secondary mt-2 text-xs" disabled={isNotePending} onClick={() => saveNote()}>
          {isNotePending ? "Saving…" : "Save reviewer note"}
        </button>
      </div>

      {isWhishOrOmt && (
        <ul className="grid gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          <li className="font-semibold text-slate-700">Before accepting, quickly check:</li>
          <li>• Amount matches the deposit or remaining balance.</li>
          <li>• Date on receipt matches the payment date.</li>
          <li>• Receiver name / phone matches your Whish or OMT details.</li>
          <li>• Screenshot is readable (no heavy blur or crop).</li>
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          onClick={() => handleAction("accepted", "paid")}
          disabled={isReviewPending}
          className="btn btn-primary order-1 w-full text-xs sm:w-auto sm:order-none"
        >
          Accept full
        </button>
        <button
          onClick={() => handleAction("accepted", "partial")}
          disabled={isReviewPending}
          className="btn btn-secondary order-2 w-full text-xs sm:w-auto sm:order-none"
        >
          Accept partial
        </button>
        <button
          type="button"
          onClick={requestReupload}
          disabled={isNotePending || isReviewPending}
          className="btn btn-secondary order-3 w-full border-amber-200 bg-amber-50/80 text-amber-950 hover:bg-amber-50 text-xs sm:w-auto sm:order-none"
        >
          {isNotePending ? "Saving…" : "Request re-upload"}
        </button>
        <button
          onClick={() => handleAction("rejected")}
          disabled={isReviewPending}
          className="btn order-4 w-full border border-red-200 bg-white text-red-800 hover:bg-red-50 text-xs sm:ml-auto sm:w-auto sm:order-none"
        >
          Reject proof
        </button>
      </div>
    </div>
  );
}
