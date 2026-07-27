/** Kept structurally aligned with the active Recovery Engine without importing its runtime. */
export type RecoveryEngineCurrencyBucket = "recent" | "aging" | "critical";
export type RecoveryEngineCurrencyTier = "low_risk" | "attention" | "recovery_risk" | "critical";
export type RecoveryEngineCurrencyNextAction =
  | "send_gentle_reminder"
  | "offer_split_payment"
  | "extend_validity"
  | "regenerate_payment_link"
  | "follow_up_whatsapp"
  | "wait_recently_reminded"
  | "review_pending_proof_first";
export type RecoveryEngineCurrencyResponsiveness =
  | "unknown"
  | "usually_pays_quickly"
  | "slow_responder"
  | "often_pays_after_reminders"
  | "usually_partial_first"
  | "high_trust_repeat";

/**
 * Already-authorised, workspace-scoped recovery facts. Outstanding remains in
 * its source currency. amountPriorityRatio is a unitless, native-currency
 * ratio supplied only when a future loader has a supported same-currency
 * threshold; this contract never converts an amount to produce it.
 */
export type RecoveryEngineCurrencyCandidateFact = {
  candidateKey: string;
  currency: string;
  outstanding: number;
  daysOverdue: number;
  workspaceMatched: boolean;
  eligibleForRecovery: boolean;
  amountPriorityRatio: number | null;
  lastReminderAt: string | null;
  lastReminderStage: string | null;
  lastPaymentAt: string | null;
  reminderCopiedCount60d: number;
  viewedAfterReminder: boolean;
  partialPaymentsObserved: boolean;
  depositSatisfied: boolean;
  isRepeatClient: boolean;
  avgDaysToPay: number | null;
  paidCount: number;
  partialInvoiceCount: number;
  pendingProof: boolean;
  hasValidity: boolean;
  linkExpired: boolean;
  daysUntilLinkExpiry: number | null;
};

export type RecoveryEngineCurrencyScoreBreakdown = {
  overdueAge: number;
  amountPriority: number | null;
  reminders: number;
  viewedAfterReminder: number;
  partialPayment: number;
  depositSatisfied: number;
  repeatClient: number;
  slowPayer: number;
  quickRepeatPayer: number;
};

export type RecoveryEngineCurrencyCandidate = {
  candidateKey: string;
  currency: string;
  outstanding: number;
  daysOverdue: number;
  bucket: RecoveryEngineCurrencyBucket;
  priorityScore: number | null;
  tier: RecoveryEngineCurrencyTier | null;
  scoreBreakdown: RecoveryEngineCurrencyScoreBreakdown;
  amountPriorityAvailable: boolean;
  lastReminderAt: string | null;
  lastReminderStage: string | null;
  lastPaymentAt: string | null;
  reminderCopiedCount60d: number;
  viewedAfterReminder: boolean;
  partialPaymentsObserved: boolean;
  depositSatisfied: boolean;
  isRepeatClient: boolean;
  nextActions: RecoveryEngineCurrencyNextAction[];
  responsiveness: RecoveryEngineCurrencyResponsiveness;
  responsivenessReasons: string[];
};

export type RecoveryEngineCurrencyGroup = {
  currency: string;
  candidates: RecoveryEngineCurrencyCandidate[];
};

export type RecoveryEngineCurrencySharedSummary = {
  candidateCount: number;
  averageDaysOverdue: number;
  remindersLast60d: number;
  partialCount: number;
  criticalCount: number;
  amountPriorityUnavailableCount: number;
};

export type RecoveryEngineCurrencyResult = {
  currencyGroups: RecoveryEngineCurrencyGroup[];
  shared: RecoveryEngineCurrencySharedSummary;
};

export type RecoveryEngineCurrencyInput = {
  candidates: readonly RecoveryEngineCurrencyCandidateFact[];
  nowMs: number;
};

export const RECOVERY_USD_AMOUNT_PRIORITY_THRESHOLD = 8_000;

const currencyPattern = /^[A-Z]{3}$/;

function normaliseCurrency(value: string): string | null {
  const currency = value.trim().toUpperCase();
  return currencyPattern.test(currency) ? currency : null;
}

function count(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function nonNegative(value: number): number | null {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function dateOrNull(value: string | null): string | null {
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}

function tierFromScore(score: number): RecoveryEngineCurrencyTier {
  if (score >= 70) return "critical";
  if (score >= 45) return "recovery_risk";
  if (score >= 25) return "attention";
  return "low_risk";
}

function bucketFromDays(days: number): RecoveryEngineCurrencyBucket {
  if (days >= 30) return "critical";
  if (days >= 8) return "aging";
  return "recent";
}

function nextActions(input: {
  pendingProof: boolean;
  lastReminderAt: string | null;
  reminderCopiedCount60d: number;
  daysOverdue: number;
  hasValidity: boolean;
  linkExpired: boolean;
  daysUntilLinkExpiry: number | null;
  nowMs: number;
}): RecoveryEngineCurrencyNextAction[] {
  const actions: RecoveryEngineCurrencyNextAction[] = [];
  if (input.pendingProof) actions.push("review_pending_proof_first");
  const reminderAt = input.lastReminderAt ? Date.parse(input.lastReminderAt) : Number.NaN;
  const recentReminder = Number.isFinite(reminderAt) && input.nowMs - reminderAt <= 2 * 86400000;
  if (recentReminder && input.reminderCopiedCount60d > 0) {
    actions.push("wait_recently_reminded");
  } else {
    actions.push("send_gentle_reminder");
    if (input.daysOverdue >= 5) actions.push("follow_up_whatsapp");
  }
  if (input.daysOverdue >= 7) actions.push("offer_split_payment");
  if (input.daysOverdue >= 14 && !input.hasValidity) actions.push("extend_validity");
  if (input.daysOverdue >= 10 && (input.linkExpired || (input.daysUntilLinkExpiry !== null && input.daysUntilLinkExpiry <= 7))) {
    actions.push("extend_validity");
  }
  if (input.linkExpired) actions.push("regenerate_payment_link");
  return [...new Set(actions)];
}

function responsiveness(input: {
  partialInvoiceCount: number;
  isRepeatClient: boolean;
  paidCount: number;
  avgDaysToPay: number | null;
  reminderCopiedCount60d: number;
}): Pick<RecoveryEngineCurrencyCandidate, "responsiveness" | "responsivenessReasons"> {
  const reasons: string[] = [];
  let label: RecoveryEngineCurrencyResponsiveness = "unknown";
  if (input.partialInvoiceCount >= 2) {
    label = "usually_partial_first";
    reasons.push("This client has multiple invoices that were or are in a partial payment state.");
  } else if (input.isRepeatClient && input.paidCount >= 2 && input.avgDaysToPay !== null && input.avgDaysToPay <= 10) {
    label = "high_trust_repeat";
    reasons.push("Repeat client with multiple completed payments on record.");
  } else if (input.paidCount >= 2 && input.avgDaysToPay !== null && input.avgDaysToPay <= 5) {
    label = "usually_pays_quickly";
    reasons.push("Past invoices for this client were marked paid within a few days on average.");
  } else if (input.avgDaysToPay !== null && input.avgDaysToPay > 14 && input.paidCount >= 1) {
    label = "slow_responder";
    reasons.push("Past invoices for this client took longer than two weeks to reach paid on average.");
  }
  if (input.reminderCopiedCount60d >= 2) {
    if (label === "unknown") label = "often_pays_after_reminders";
    reasons.push("Multiple reminder copies were recorded for this invoice in the last 60 days.");
  }
  return { responsiveness: label, responsivenessReasons: reasons };
}

/**
 * Pure recovery successor. The legacy engine's LBP amount priority depends on
 * an exchange-rate conversion, so this contract accepts only a precomputed
 * native-currency ratio. Null intentionally yields an unavailable monetary
 * contribution rather than fabricating a converted score.
 */
export function deriveRecoveryEngineCurrencyResult(
  input: RecoveryEngineCurrencyInput
): RecoveryEngineCurrencyResult {
  if (!Number.isFinite(input.nowMs)) {
    return {
      currencyGroups: [],
      shared: { candidateCount: 0, averageDaysOverdue: 0, remindersLast60d: 0, partialCount: 0, criticalCount: 0, amountPriorityUnavailableCount: 0 }
    };
  }

  const grouped = new Map<string, RecoveryEngineCurrencyCandidate[]>();

  for (const fact of input.candidates) {
    const currency = normaliseCurrency(fact.currency);
    const outstanding = nonNegative(fact.outstanding);
    const daysOverdue = nonNegative(fact.daysOverdue);
    if (!currency || !fact.candidateKey.trim() || !fact.workspaceMatched || !fact.eligibleForRecovery || outstanding === null || outstanding <= 0 || daysOverdue === null || daysOverdue <= 0) {
      continue;
    }

    const amountPriorityRatio = finiteOrNull(fact.amountPriorityRatio);
    if ((fact.amountPriorityRatio !== null && !Number.isFinite(fact.amountPriorityRatio)) || (amountPriorityRatio !== null && amountPriorityRatio < 0)) continue;
    const reminderCopiedCount60d = count(fact.reminderCopiedCount60d);
    const paidCount = count(fact.paidCount);
    const partialInvoiceCount = count(fact.partialInvoiceCount);
    if (fact.avgDaysToPay !== null && !Number.isFinite(fact.avgDaysToPay)) continue;
    const avgDaysToPay = finiteOrNull(fact.avgDaysToPay);
    const daysUntilLinkExpiry = finiteOrNull(fact.daysUntilLinkExpiry);
    if (daysUntilLinkExpiry !== null && daysUntilLinkExpiry < 0) continue;

    const scoreBreakdown: RecoveryEngineCurrencyScoreBreakdown = {
      overdueAge: Math.min(40, (Math.min(daysOverdue, 120) / 120) * 40),
      amountPriority: amountPriorityRatio === null ? null : Math.min(25, Math.min(1, amountPriorityRatio) * 25),
      reminders: Math.min(15, reminderCopiedCount60d * 5),
      viewedAfterReminder: fact.viewedAfterReminder ? 12 : 0,
      partialPayment: fact.partialPaymentsObserved ? 5 : 0,
      depositSatisfied: fact.depositSatisfied ? -8 : 0,
      repeatClient: fact.isRepeatClient ? -6 : 0,
      slowPayer: avgDaysToPay !== null && avgDaysToPay > 14 ? 8 : 0,
      quickRepeatPayer: avgDaysToPay !== null && avgDaysToPay <= 3 && paidCount >= 2 ? -8 : 0
    };

    const priorityScore = scoreBreakdown.amountPriority === null
      ? null
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              scoreBreakdown.overdueAge +
                scoreBreakdown.amountPriority +
                scoreBreakdown.reminders +
                scoreBreakdown.viewedAfterReminder +
                scoreBreakdown.partialPayment +
                scoreBreakdown.depositSatisfied +
                scoreBreakdown.repeatClient +
                scoreBreakdown.slowPayer +
                scoreBreakdown.quickRepeatPayer
            )
          )
        );

    const candidate: RecoveryEngineCurrencyCandidate = {
      candidateKey: fact.candidateKey,
      currency,
      outstanding,
      daysOverdue,
      bucket: bucketFromDays(daysOverdue),
      priorityScore,
      tier: priorityScore === null ? null : tierFromScore(priorityScore),
      scoreBreakdown,
      amountPriorityAvailable: scoreBreakdown.amountPriority !== null,
      lastReminderAt: dateOrNull(fact.lastReminderAt),
      lastReminderStage: fact.lastReminderStage?.trim() || null,
      lastPaymentAt: dateOrNull(fact.lastPaymentAt),
      reminderCopiedCount60d,
      viewedAfterReminder: fact.viewedAfterReminder,
      partialPaymentsObserved: fact.partialPaymentsObserved,
      depositSatisfied: fact.depositSatisfied,
      isRepeatClient: fact.isRepeatClient,
      nextActions: nextActions({
        pendingProof: fact.pendingProof,
        lastReminderAt: dateOrNull(fact.lastReminderAt),
        reminderCopiedCount60d,
        daysOverdue,
        hasValidity: fact.hasValidity,
        linkExpired: fact.linkExpired,
        daysUntilLinkExpiry,
        nowMs: input.nowMs
      }),
      ...responsiveness({
        partialInvoiceCount,
        isRepeatClient: fact.isRepeatClient,
        paidCount,
        avgDaysToPay,
        reminderCopiedCount60d
      })
    };
    const candidates = grouped.get(currency) || [];
    candidates.push(candidate);
    grouped.set(currency, candidates);
  }

  const currencyGroups = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, candidates]) => ({
      currency,
      candidates: candidates.sort((left, right) => {
        const leftScore = left.priorityScore ?? Number.NEGATIVE_INFINITY;
        const rightScore = right.priorityScore ?? Number.NEGATIVE_INFINITY;
        return rightScore - leftScore || right.daysOverdue - left.daysOverdue || left.candidateKey.localeCompare(right.candidateKey);
      })
    }));

  const candidates = currencyGroups.flatMap((group) => group.candidates);
  const candidateCount = candidates.length;
  return {
    currencyGroups,
    shared: {
      candidateCount,
      averageDaysOverdue: candidateCount ? Math.round((candidates.reduce((sum, candidate) => sum + candidate.daysOverdue, 0) / candidateCount) * 10) / 10 : 0,
      remindersLast60d: candidates.reduce((sum, candidate) => sum + candidate.reminderCopiedCount60d, 0),
      partialCount: candidates.filter((candidate) => candidate.partialPaymentsObserved).length,
      criticalCount: candidates.filter((candidate) => candidate.tier === "critical").length,
      amountPriorityUnavailableCount: candidates.filter((candidate) => !candidate.amountPriorityAvailable).length
    }
  };
}
