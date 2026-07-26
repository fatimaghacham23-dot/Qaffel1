import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveRecoveryEngineCurrencyResult,
  type RecoveryEngineCurrencyCandidateFact,
  type RecoveryEngineCurrencyInput
} from "@/lib/recovery-engine-currency-summary";

const nowMs = Date.UTC(2026, 6, 26, 12, 0, 0);

function fact(overrides: Partial<RecoveryEngineCurrencyCandidateFact> = {}): RecoveryEngineCurrencyCandidateFact {
  return {
    candidateKey: "candidate-a",
    currency: "USD",
    outstanding: 8_000,
    daysOverdue: 120,
    workspaceMatched: true,
    eligibleForRecovery: true,
    amountPriorityRatio: 1,
    lastReminderAt: null,
    lastReminderStage: null,
    lastPaymentAt: null,
    reminderCopiedCount60d: 0,
    viewedAfterReminder: false,
    partialPaymentsObserved: false,
    depositSatisfied: false,
    isRepeatClient: false,
    avgDaysToPay: null,
    paidCount: 0,
    partialInvoiceCount: 0,
    pendingProof: false,
    hasValidity: false,
    linkExpired: false,
    daysUntilLinkExpiry: null,
    ...overrides
  };
}

function input(candidates: readonly RecoveryEngineCurrencyCandidateFact[]): RecoveryEngineCurrencyInput {
  return { candidates, nowMs };
}

describe("currency-safe Recovery Engine contract", () => {
  it("preserves the active score weights, tiers, actions, and partial outstanding amount for a USD candidate", () => {
    const result = deriveRecoveryEngineCurrencyResult(input([
      fact({
        outstanding: 6_400,
        reminderCopiedCount60d: 3,
        viewedAfterReminder: true,
        partialPaymentsObserved: true,
        depositSatisfied: true,
        isRepeatClient: true,
        avgDaysToPay: 15,
        paidCount: 2
      })
    ]));
    const candidate = result.currencyGroups[0]?.candidates[0];

    expect(candidate).toEqual(expect.objectContaining({
      currency: "USD",
      outstanding: 6_400,
      daysOverdue: 120,
      bucket: "critical",
      priorityScore: 91,
      tier: "critical",
      amountPriorityAvailable: true,
      nextActions: ["send_gentle_reminder", "follow_up_whatsapp", "offer_split_payment", "extend_validity"]
    }));
    expect(candidate?.scoreBreakdown).toEqual({
      overdueAge: 40,
      amountPriority: 25,
      reminders: 15,
      viewedAfterReminder: 12,
      partialPayment: 5,
      depositSatisfied: -8,
      repeatClient: -6,
      slowPayer: 8,
      quickRepeatPayer: 0
    });
    expect(result.shared).toEqual({
      candidateCount: 1,
      averageDaysOverdue: 120,
      remindersLast60d: 3,
      partialCount: 1,
      criticalCount: 1,
      amountPriorityUnavailableCount: 0
    });
  });

  it("keeps an LBP candidate in its original currency and makes the legacy converted monetary priority explicitly unavailable", () => {
    const result = deriveRecoveryEngineCurrencyResult(input([
      fact({ candidateKey: "lbp", currency: "LBP", outstanding: 9_000_000, amountPriorityRatio: null, daysOverdue: 12 })
    ]));
    const candidate = result.currencyGroups[0]?.candidates[0];

    expect(result.currencyGroups).toHaveLength(1);
    expect(result.currencyGroups[0]?.currency).toBe("LBP");
    expect(candidate).toEqual(expect.objectContaining({
      currency: "LBP",
      outstanding: 9_000_000,
      priorityScore: null,
      tier: null,
      amountPriorityAvailable: false
    }));
    expect(candidate?.scoreBreakdown.amountPriority).toBeNull();
    expect(result.shared.amountPriorityUnavailableCount).toBe(1);
    expect("overdueRecoverableUsd" in result).toBe(false);
    expect("totalUsd" in result).toBe(false);
  });

  it("creates deterministic independent currency groups and ranks candidates only inside their own group", () => {
    const result = deriveRecoveryEngineCurrencyResult(input([
      fact({ candidateKey: "usd-low", currency: "USD", outstanding: 2_000, daysOverdue: 5, amountPriorityRatio: 0.25 }),
      fact({ candidateKey: "usd-high", currency: "USD", outstanding: 8_000, daysOverdue: 60, amountPriorityRatio: 1 }),
      fact({ candidateKey: "lbp-only", currency: "LBP", outstanding: 4_000_000, daysOverdue: 45, amountPriorityRatio: 0.5 })
    ]));

    expect(result.currencyGroups.map((group) => group.currency)).toEqual(["LBP", "USD"]);
    expect(result.currencyGroups.find((group) => group.currency === "USD")?.candidates.map((candidate) => candidate.candidateKey)).toEqual(["usd-high", "usd-low"]);
    expect(result.currencyGroups.find((group) => group.currency === "LBP")?.candidates.map((candidate) => candidate.candidateKey)).toEqual(["lbp-only"]);
    expect(result.currencyGroups.flatMap((group) => group.candidates).every((candidate) => candidate.currency === "USD" || candidate.currency === "LBP")).toBe(true);
  });

  it("excludes ineligible, foreign, malformed, zero, and unavailable facts without producing NaN or Infinity", () => {
    const result = deriveRecoveryEngineCurrencyResult(input([
      fact({ candidateKey: "paid", eligibleForRecovery: false }),
      fact({ candidateKey: "quote", eligibleForRecovery: false }),
      fact({ candidateKey: "cancelled", eligibleForRecovery: false }),
      fact({ candidateKey: "voided", eligibleForRecovery: false }),
      fact({ candidateKey: "foreign", workspaceMatched: false }),
      fact({ candidateKey: "zero", outstanding: 0 }),
      fact({ candidateKey: "missing-days", daysOverdue: 0 }),
      fact({ candidateKey: "bad-currency", currency: "US" }),
      fact({ candidateKey: "bad-amount", outstanding: Number.POSITIVE_INFINITY }),
      fact({ candidateKey: "bad-ratio", amountPriorityRatio: Number.NaN })
    ]));

    expect(result.currencyGroups).toEqual([]);
    expect(result.shared).toEqual({
      candidateCount: 0,
      averageDaysOverdue: 0,
      remindersLast60d: 0,
      partialCount: 0,
      criticalCount: 0,
      amountPriorityUnavailableCount: 0
    });
    expect(deriveRecoveryEngineCurrencyResult({ candidates: [fact()], nowMs: Number.NaN }).currencyGroups).toEqual([]);
  });

  it("uses deterministic tie-breaking and safe presentation fields only", () => {
    const factualInput = input([
      fact({ candidateKey: "b", currency: "USD", outstanding: 1_000, daysOverdue: 30, amountPriorityRatio: 0.5 }),
      fact({ candidateKey: "a", currency: "USD", outstanding: 1_000, daysOverdue: 30, amountPriorityRatio: 0.5 })
    ]);
    const first = deriveRecoveryEngineCurrencyResult(factualInput);
    const second = deriveRecoveryEngineCurrencyResult({ ...factualInput, candidates: [...factualInput.candidates].reverse() });
    const candidate = first.currencyGroups[0]?.candidates[0];

    expect(first).toEqual(second);
    expect(first.currencyGroups[0]?.candidates.map((item) => item.candidateKey)).toEqual(["a", "b"]);
    expect(candidate).not.toHaveProperty("phone");
    expect(candidate).not.toHaveProperty("email");
    expect(candidate).not.toHaveProperty("publicToken");
    expect(candidate).not.toHaveProperty("proofPath");
    expect(candidate).not.toHaveProperty("signedUrl");
  });

  it("contains no conversion helper, exchange-rate constant, combined total, or active runtime import", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/recovery-engine-currency-summary.ts"), "utf8");

    expect(source).not.toContain("toApproxUsd");
    expect(source).not.toContain("exchange_rate");
    expect(source).not.toContain("90000");
    expect(source).not.toContain("totalUsd");
    expect(source).not.toContain("convertedAmount");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("@/lib/recovery-engine");
  });
});
