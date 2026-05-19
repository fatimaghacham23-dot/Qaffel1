import { describe, expect, it } from "vitest";
import {
  buildBillingSummary,
  buildDefaultSubscription,
  canAddWorkspaceMember,
  canManageBilling,
  canRoleManageBilling,
  canRoleViewBilling,
  canTransitionSubscriptionStatus,
  evaluateDowngradeSafety,
  getFeatureAccess,
  getPlanDefinition,
  normalizePlanKey,
  normalizeSubscriptionStatus,
  planIncludesFeature
} from "@/lib/billing";

describe("workspace billing foundation", () => {
  it("normalizes unknown plans and statuses to safe defaults", () => {
    expect(normalizePlanKey("enterprise")).toBe("enterprise");
    expect(normalizePlanKey("unknown")).toBe("solo");
    expect(normalizeSubscriptionStatus("past_due")).toBe("past_due");
    expect(normalizeSubscriptionStatus("expired")).toBe("trial");
  });

  it("keeps subscription transitions deterministic", () => {
    expect(canTransitionSubscriptionStatus("trial", "active")).toBe(true);
    expect(canTransitionSubscriptionStatus("active", "past_due")).toBe(true);
    expect(canTransitionSubscriptionStatus("archived", "active")).toBe(false);
    expect(canTransitionSubscriptionStatus("canceled", "past_due")).toBe(false);
  });

  it("separates billing visibility from billing management", () => {
    expect(canRoleViewBilling("owner")).toBe(true);
    expect(canRoleViewBilling("finance")).toBe(true);
    expect(canRoleViewBilling("operations")).toBe(false);
    expect(canRoleManageBilling("owner")).toBe(true);
    expect(canRoleManageBilling("admin")).toBe(false);
  });

  it("allows explicit billing admins to manage without making every admin a billing operator", () => {
    expect(
      canManageBilling({
        role: "finance",
        userId: "u2",
        billingOwnerId: "u1",
        billingAdminUserIds: ["u2"]
      })
    ).toBe(true);

    expect(
      canManageBilling({
        role: "admin",
        userId: "u3",
        billingOwnerId: "u1",
        billingAdminUserIds: []
      })
    ).toBe(false);
  });

  it("returns continuity-preserving feature access for billing-sensitive states", () => {
    const subscription = buildDefaultSubscription("w1", "u1");

    expect(getFeatureAccess({ ...subscription, status: "active", plan_key: "business" }, "finance").state).toBe("available");
    expect(getFeatureAccess({ ...subscription, status: "active", plan_key: "solo" }, "finance").state).toBe("limited");
    expect(getFeatureAccess({ ...subscription, status: "past_due", plan_key: "solo" }, "finance").state).toBe("grace");
    expect(getFeatureAccess({ ...subscription, status: "archived", plan_key: "enterprise" }, "exports").state).toBe("read_only");
  });

  it("evaluates downgrade risk without data-loss behavior", () => {
    const downgrade = evaluateDowngradeSafety({
      currentPlanKey: "business",
      targetPlanKey: "solo",
      usage: { activeMembers: 3, monthlyExports: 8 }
    });

    expect(downgrade.safe).toBe(false);
    expect(downgrade.warnings.length).toBe(2);
    expect(downgrade.retentionGuarantees.join(" ")).toContain("retained");
  });

  it("builds seat-aware billing summaries", () => {
    const subscription = { ...buildDefaultSubscription("w1", "u1"), plan_key: "team", status: "trial" };
    const summary = buildBillingSummary(subscription, { activeMembers: 6 });

    expect(summary.plan.key).toBe("team");
    expect(summary.seatLimit).toBe(5);
    expect(summary.seatsOverLimit).toBe(true);
    expect(summary.billingHealth).toBe("healthy");
  });

  it("blocks only future seat additions when a workspace is over limit", () => {
    const subscription = { ...buildDefaultSubscription("w1", "u1"), plan_key: "solo", status: "active" };

    expect(canAddWorkspaceMember({ subscription, activeMembers: 0 }).allowed).toBe(true);
    expect(canAddWorkspaceMember({ subscription, activeMembers: 1 }).allowed).toBe(false);
    expect(canAddWorkspaceMember({ subscription, activeMembers: 1 }).reason).toContain("Existing members keep access");
  });

  it("keeps plan features explicit and pricing-free", () => {
    expect(getPlanDefinition("business").label).toBe("Business");
    expect(planIncludesFeature("team", "collaboration")).toBe(true);
    expect(planIncludesFeature("team", "finance")).toBe(false);
  });
});
