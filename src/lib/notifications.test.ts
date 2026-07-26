import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_LIMIT,
  buildDerivedNotifications,
  deriveNotifications,
  filterNotifications,
  notificationFilter
} from "@/lib/notifications";

const now = new Date("2026-07-26T12:00:00.000Z");
const invoice = (overrides = {}) => ({ id: "invoice-1", status: "sent" as const, document_type: "invoice", currency: "USD", amount_usd: 100, amount_lbp: null, due_date: "2026-07-20", payment_proofs: [], ...overrides });
const base = () => ({ profile: { business_name: "Qaffel", phone: "+961", support_email: "support@example.com", logo_storage_path: "private/logo.png" }, activePaymentMethodCount: 1, clientCount: 1, invoiceCount: 1, sharedInvoiceCount: 1, pendingProofCount: 0, rejectedProofCount: 0, pendingInvitationCount: 0, assignmentCount: 0, invoices: [], now });

describe("derived notifications", () => {
  it("uses stable deterministic IDs, deduplicates, orders severity, and bounds output", () => {
    const items = buildDerivedNotifications({ ...base(), pendingProofCount: 2, rejectedProofCount: 1, invoices: [invoice()] });
    expect(buildDerivedNotifications({ ...base(), pendingProofCount: 2, rejectedProofCount: 1, invoices: [invoice()] })).toEqual(items);
    const ownerItems = deriveNotifications([...items, items[0]], "owner", 100);
    expect(new Set(ownerItems.map((item) => item.id)).size).toBe(ownerItems.length);
    expect(ownerItems[0].severity).toBe("critical");
    expect(deriveNotifications(Array.from({ length: 30 }, (_, index) => ({ ...items[0], id: `x:${index}` })), "owner").length).toBe(NOTIFICATION_LIMIT);
  });

  it("filters categories and keeps only the roles that have the required permission", () => {
    const items = buildDerivedNotifications({ ...base(), pendingProofCount: 1, activePaymentMethodCount: 0 });
    expect(deriveNotifications(items, "staff").some((item) => item.id === "payments:proof-review")).toBe(false);
    expect(deriveNotifications(items, "reviewer").some((item) => item.id === "payments:proof-review")).toBe(true);
    expect(filterNotifications(items, "payments").every((item) => ["payments", "collections"].includes(item.category))).toBe(true);
    expect(notificationFilter("unknown")).toBe("all");
  });

  it("removes onboarding items as real setup becomes complete", () => {
    const incomplete = buildDerivedNotifications({ ...base(), profile: null, activePaymentMethodCount: 0, clientCount: 0, invoiceCount: 0, sharedInvoiceCount: 0 });
    const complete = buildDerivedNotifications(base());
    expect(incomplete.some((item) => item.id === "onboarding:business-profile")).toBe(true);
    expect(incomplete.some((item) => item.id === "onboarding:payment-method")).toBe(true);
    expect(complete.some((item) => item.category === "onboarding")).toBe(false);
  });

  it("uses collection semantics for overdue and partial balances without exposing private values", () => {
    const items = buildDerivedNotifications({ ...base(), invoices: [
      invoice(),
      invoice({ id: "paid", status: "paid", due_date: "2026-07-01", payment_proofs: [{ status: "accepted", amount_usd: 100 }] }),
      invoice({ id: "void", status: "sent", due_date: "2026-07-01", payment_proofs: [{ status: "accepted", amount_usd: 100, voided_at: "2026-07-02" }] }),
      invoice({ id: "partial", status: "partial", due_date: "2026-07-28", payment_proofs: [{ status: "accepted", amount_usd: 25 }] })
    ] });
    expect(items.some((item) => item.id === "collections:overdue")).toBe(true);
    expect(items.some((item) => item.id === "collections:partial-balances")).toBe(true);
    expect(JSON.stringify(items)).not.toContain("private/logo"); expect(JSON.stringify(items)).not.toContain("support@example.com");
    expect(items.every((item) => item.destinationUrl.startsWith("/") && !item.destinationUrl.includes("token"))).toBe(true);
  });
});
