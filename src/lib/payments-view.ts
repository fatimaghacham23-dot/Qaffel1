export const paymentViews = ["awaiting", "approved", "rejected", "manual", "receipts", "history"] as const;
export type PaymentView = (typeof paymentViews)[number];
export function resolvePaymentView(value: string | undefined, pendingCount: number): PaymentView {
  if (paymentViews.includes(value as PaymentView)) return value as PaymentView;
  return pendingCount > 0 ? "awaiting" : "history";
}
