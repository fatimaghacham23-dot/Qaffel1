import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getConfiguredStripePlans,
  mapStripeSubscriptionStatus,
  planKeyFromStripePriceId,
  stripeObjectId,
  stripeUnixToIso
} from "@/lib/billing-stripe";

const PRICE_ENV_KEYS = ["STRIPE_PRICE_SOLO", "STRIPE_PRICE_TEAM", "STRIPE_PRICE_BUSINESS", "STRIPE_PRICE_ENTERPRISE"] as const;
const originalPrices = Object.fromEntries(PRICE_ENV_KEYS.map((key) => [key, process.env[key]]));

describe("Stripe billing provider helpers", () => {
  beforeEach(() => {
    for (const key of PRICE_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of PRICE_ENV_KEYS) {
      const value = originalPrices[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("maps Stripe lifecycle states into Qaffel continuity states", () => {
    expect(mapStripeSubscriptionStatus("trialing")).toBe("trial");
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("grace_period");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapStripeSubscriptionStatus("unknown")).toBe("grace_period");
  });

  it("keeps plan lookup driven by configured Stripe price ids", () => {
    process.env.STRIPE_PRICE_TEAM = "price_team";
    process.env.STRIPE_PRICE_BUSINESS = "price_business";

    expect(getConfiguredStripePlans().map((plan) => plan.key)).toEqual(["team", "business"]);
    expect(planKeyFromStripePriceId("price_business")).toBe("business");
    expect(planKeyFromStripePriceId("price_missing")).toBeNull();
  });

  it("normalizes Stripe object identifiers and timestamps", () => {
    expect(stripeObjectId("cus_123")).toBe("cus_123");
    expect(stripeObjectId({ id: "sub_123" })).toBe("sub_123");
    expect(stripeObjectId({})).toBeNull();
    expect(stripeUnixToIso(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
    expect(stripeUnixToIso(null)).toBeNull();
  });
});
