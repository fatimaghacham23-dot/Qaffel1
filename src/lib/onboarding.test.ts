import { describe, expect, it } from "vitest";
import { collectionOnboarding } from "@/lib/onboarding";
describe("collection onboarding", () => {
  it("guides a new owner from actual configuration", () => expect(collectionOnboarding({ role: "owner", activePaymentMethods: 0, hasInvoiceDefaults: false, clientCount: 0, invoiceCount: 0 })).toHaveLength(4));
  it("bypasses established workspaces", () => expect(collectionOnboarding({ role: "owner", businessName: "Qaffel", phone: "03123456", activePaymentMethods: 1, hasInvoiceDefaults: true, clientCount: 1, invoiceCount: 1 })).toBeNull());
  it("does not expose owner-only setup to limited roles", () => expect(collectionOnboarding({ role: "staff", activePaymentMethods: 0, hasInvoiceDefaults: false, clientCount: 0, invoiceCount: 0 })).toBeNull());
});
