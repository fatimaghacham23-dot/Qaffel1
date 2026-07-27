import type { WorkspaceRole } from "@/lib/permissions";

export type OnboardingStep = "business" | "payment_methods" | "invoice_defaults" | "first_invoice";
export type OnboardingState = { step: OnboardingStep; complete: boolean; href: string }[];

/** Derived solely from existing meaningful workspace configuration; no checklist flags are persisted. */
export function collectionOnboarding(input: { role: WorkspaceRole; businessName?: string | null; phone?: string | null; activePaymentMethods: number; hasInvoiceDefaults: boolean; clientCount: number; invoiceCount: number }): OnboardingState | null {
  if (input.role !== "owner" && input.role !== "admin") return null;
  const state: OnboardingState = [
    { step: "business", complete: Boolean(input.businessName && input.phone), href: "/settings/profile" },
    { step: "payment_methods", complete: input.activePaymentMethods > 0, href: "/settings/payment-methods" },
    { step: "invoice_defaults", complete: input.hasInvoiceDefaults, href: "/settings/service-presets" },
    { step: "first_invoice", complete: input.invoiceCount > 0, href: "/invoices/new" }
  ];
  return input.invoiceCount > 0 && input.clientCount > 0 && state.slice(0, 2).every((item) => item.complete) ? null : state;
}
