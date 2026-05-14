import { describe, expect, it } from "vitest";
import { buildBusinessLaunchModel, type BusinessLaunchEvent, type BusinessLaunchInvoice } from "@/lib/business-launch";
import type { PaymentMethodRow } from "@/lib/operations";

const completeMethod: PaymentMethodRow = {
  type: "whish",
  label: "Whish Money",
  instructions: "Send via Whish Money to:\nName: Qaffel Studio\nPhone: +961 03 123 456\nUpload proof after payment.",
  is_active: true,
  receiver_name: "Qaffel Studio",
  receiver_phone: "+96103123456"
};

const baseInvoice: BusinessLaunchInvoice = {
  id: "inv-1",
  status: "sent",
  document_type: "invoice",
  amount_usd: 100,
  amount_lbp: null,
  currency: "USD",
  created_at: "2026-05-10T09:00:00.000Z",
  due_date: "2026-05-20",
  public_token: "pay-token",
  client_id: "client-1",
  payment_proofs: []
};

function event(event_type: string): BusinessLaunchEvent {
  return {
    invoice_id: "inv-1",
    event_type,
    created_at: "2026-05-14T09:00:00.000Z"
  };
}

describe("business launch onboarding", () => {
  it("starts a new workspace with deterministic missing steps", () => {
    const model = buildBusinessLaunchModel({
      profile: null,
      userEmail: "owner@example.com",
      paymentMethods: [],
      clients: [],
      invoices: [],
      events: []
    });

    expect(model.isNewWorkspace).toBe(true);
    expect(model.percent).toBe(0);
    expect(model.nextStep?.key).toBe("business_profile");
    expect(model.readiness.missingSetup).toContain("Complete business name, phone, and account email.");
  });

  it("marks core launch complete from real workspace workflow data", () => {
    const model = buildBusinessLaunchModel({
      profile: {
        business_name: "Qaffel Studio",
        phone: "+96103123456",
        logo_storage_path: "owner/logo.png"
      },
      userEmail: "owner@example.com",
      paymentMethods: [completeMethod],
      clients: [{ id: "client-1", name: "Maya" }],
      invoices: [
        {
          ...baseInvoice,
          status: "paid",
          payment_proofs: [
            {
              id: "proof-1",
              status: "accepted",
              amount_usd: 100,
              amount_lbp: null,
              uploaded_at: "2026-05-11T09:00:00.000Z"
            }
          ]
        }
      ],
      events: [event("proof_accepted")]
    });

    expect(model.isComplete).toBe(true);
    expect(model.percent).toBe(100);
    expect(model.readiness.score).toBeGreaterThanOrEqual(90);
  });

  it("keeps follow-up controls optional while still reflecting them in readiness", () => {
    const withoutFollowUp = buildBusinessLaunchModel({
      profile: {
        business_name: "Qaffel Studio",
        phone: "+96103123456",
        logo_storage_path: "owner/logo.png"
      },
      userEmail: "owner@example.com",
      paymentMethods: [completeMethod],
      clients: [{ id: "client-1", name: "Maya" }],
      invoices: [
        {
          ...baseInvoice,
          status: "paid",
          payment_proofs: [{ status: "accepted", amount_usd: 100, amount_lbp: null }]
        }
      ],
      events: [event("proof_accepted")]
    });
    const withFollowUp = buildBusinessLaunchModel({
      profile: {
        business_name: "Qaffel Studio",
        phone: "+96103123456",
        logo_storage_path: "owner/logo.png"
      },
      userEmail: "owner@example.com",
      paymentMethods: [completeMethod],
      clients: [{ id: "client-1", name: "Maya" }],
      invoices: [
        {
          ...baseInvoice,
          status: "paid",
          payment_proofs: [{ status: "accepted", amount_usd: 100, amount_lbp: null }]
        }
      ],
      events: [event("proof_accepted"), event("reminder_copied")]
    });

    expect(withoutFollowUp.isComplete).toBe(true);
    expect(withFollowUp.readiness.score).toBeGreaterThan(withoutFollowUp.readiness.score);
    expect(withFollowUp.steps.find((step) => step.key === "follow_up_habit")?.completed).toBe(true);
  });
});
