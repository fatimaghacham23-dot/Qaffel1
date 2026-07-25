import { describe, expect, it, vi } from "vitest";
import { claimStripeWebhookEvent, shouldApplyStripeEvent } from "@/lib/stripe-webhook";

describe("Stripe webhook concurrency", () => {
  it("uses the atomic database claim result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ claimed: true, current_status: "processing" }],
      error: null
    });

    await expect(
      claimStripeWebhookEvent(
        { rpc },
        { eventId: "evt_1", eventType: "invoice.paid", objectId: "in_1" }
      )
    ).resolves.toEqual({ claimed: true, status: "processing" });
    expect(rpc).toHaveBeenCalledWith("claim_stripe_webhook_event", {
      p_event_id: "evt_1",
      p_event_type: "invoice.paid",
      p_object_id: "in_1"
    });
  });

  it("returns duplicate state without claiming it", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ claimed: false, current_status: "succeeded" }],
      error: null
    });

    await expect(
      claimStripeWebhookEvent(
        { rpc },
        { eventId: "evt_1", eventType: "invoice.paid", objectId: "in_1" }
      )
    ).resolves.toEqual({ claimed: false, status: "succeeded" });
  });

  it("rejects stale event ordering", () => {
    expect(
      shouldApplyStripeEvent("2026-07-25T10:00:00.000Z", "2026-07-25T11:00:00.000Z")
    ).toBe(false);
    expect(
      shouldApplyStripeEvent("2026-07-25T11:00:00.000Z", "2026-07-25T10:00:00.000Z")
    ).toBe(true);
  });
});
