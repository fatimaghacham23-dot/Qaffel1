import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "src/app/api/stripe/webhook/route.ts"),
  "utf8"
);
const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260725093000_stripe_webhook_concurrency.sql"),
  "utf8"
);

describe("Stripe webhook route boundary", () => {
  it("verifies the raw body signature before creating the privileged client", () => {
    expect(route.indexOf("constructEvent(rawBody")).toBeGreaterThan(-1);
    expect(route.indexOf("createAdminClient()")).toBeGreaterThan(
      route.indexOf("constructEvent(rawBody")
    );
  });

  it("uses one atomic claim instead of a read-then-update retry race", () => {
    expect(route).toContain("claimStripeWebhookEvent");
    expect(route).not.toContain('.from("stripe_webhook_events").insert');
    expect(migration).toContain("on conflict (stripe_event_id) do nothing");
    expect(migration).toContain("status = 'failed'");
    expect(migration).toContain("interval '15 minutes'");
  });

  it("deduplicates billing audit entries by Stripe event", () => {
    expect(migration).toContain("workspace_billing_audit_stripe_event_uidx");
    expect(migration).toContain("next_state ->> 'stripe_event_id'");
  });
});
