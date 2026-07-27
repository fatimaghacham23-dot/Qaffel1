import { hasPermission, type Permission, type WorkspaceRole } from "@/lib/permissions";
import type { PaymentView } from "@/lib/payments-view";

export const PAYMENT_VIEW_ACCESS: Record<PaymentView, readonly Permission[]> = {
  awaiting: ["proofs.review"],
  approved: ["proofs.view"],
  rejected: ["proofs.view"],
  manual: ["payments.void"],
  receipts: ["proofs.view"],
  history: ["reports.view"]
};
export function canAccessPaymentView(role:WorkspaceRole,view:PaymentView){return PAYMENT_VIEW_ACCESS[view].some(p=>hasPermission(role,p));}
export function paymentViewsForRole(role:WorkspaceRole){return (Object.keys(PAYMENT_VIEW_ACCESS) as PaymentView[]).filter(v=>canAccessPaymentView(role,v));}
