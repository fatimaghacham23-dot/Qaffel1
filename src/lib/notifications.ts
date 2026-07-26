import "server-only";

import { isOutstandingInvoice, remainingForInvoice, type CollectionInvoice } from "@/lib/collection";
import { isQuoteDocument } from "@/lib/documents";
import { hasPermission, type Permission, type WorkspaceRole } from "@/lib/permissions";

export type NotificationCategory = "onboarding" | "payments" | "collections" | "team" | "system";
export type NotificationSeverity = "critical" | "warning" | "info";
export type NotificationFilter = "all" | "action" | "onboarding" | "payments" | "team" | "system";
export type DerivedNotification = { id: string; category: NotificationCategory; severity: NotificationSeverity; title: string; description: string; reason: string; destinationUrl: string; permittedRoles: WorkspaceRole[]; actionLabel?: string };
export type NotificationInvoice = CollectionInvoice;
export type NotificationDerivationInput = {
  profile: { business_name?: string | null; phone?: string | null; support_email?: string | null; logo_storage_path?: string | null } | null;
  activePaymentMethodCount: number; clientCount: number; invoiceCount: number; sharedInvoiceCount: number;
  pendingProofCount: number; rejectedProofCount: number; pendingInvitationCount: number; assignmentCount: number;
  invoices: NotificationInvoice[]; now?: Date;
};

const ALL_ROLES: WorkspaceRole[] = ["owner", "admin", "finance", "operations", "reviewer", "staff"];
const severityRank: Record<NotificationSeverity, number> = { critical: 0, warning: 1, info: 2 };
export const NOTIFICATION_LIMIT = 24;
const rolesWith = (permission: Permission) => ALL_ROLES.filter((role) => hasPermission(role, permission));
const notification = (id: string, category: NotificationCategory, severity: NotificationSeverity, title: string, description: string, reason: string, destinationUrl: string, permittedRoles: WorkspaceRole[], actionLabel?: string): DerivedNotification => ({ id, category, severity, title, description, reason, destinationUrl, permittedRoles, actionLabel });
export const notificationSeverityRank = (severity: NotificationSeverity) => severityRank[severity];

export function buildDerivedNotifications(input: NotificationDerivationInput): DerivedNotification[] {
  const now = input.now || new Date(), today = now.toISOString().slice(0, 10);
  const week = new Date(now); week.setDate(week.getDate() + 7);
  const sevenDays = week.toISOString().slice(0, 10), items: DerivedNotification[] = [];
  const settingsRoles = rolesWith("settings.manage"), invoiceRoles = rolesWith("invoices.view"), reviewRoles = rolesWith("proofs.review");
  if (!input.profile?.business_name?.trim()) items.push(notification("onboarding:business-profile", "onboarding", "warning", "Complete your business profile", "Add your business name so invoices and payment pages identify your business.", "Business name is missing.", "/settings/profile", settingsRoles, "Edit profile"));
  if (!input.profile?.phone?.trim() && !input.profile?.support_email?.trim()) items.push(notification("onboarding:contact-details", "onboarding", "info", "Add a support contact", "Give clients a way to reach your business when they need payment help.", "No business phone or support email is configured.", "/settings/profile", settingsRoles, "Add contact"));
  if (!input.profile?.logo_storage_path?.trim()) items.push(notification("onboarding:branding", "onboarding", "info", "Add branding to client pages", "A logo or brand treatment helps clients recognize your invoices and receipts.", "No logo is configured.", "/settings/profile", settingsRoles, "Open branding"));
  if (!input.activePaymentMethodCount) items.push(notification("onboarding:payment-method", "onboarding", "critical", "Add a payment method", "Clients need at least one active payment method before they can complete a payment request.", "No active payment method is configured.", "/settings/payment-methods", settingsRoles, "Add payment method"));
  if (!input.clientCount) items.push(notification("onboarding:first-client", "onboarding", "info", "Add your first client", "Create a client record before issuing a payment request.", "No client records exist.", "/clients/new", rolesWith("clients.create"), "Add client"));
  if (!input.invoiceCount) items.push(notification("onboarding:first-invoice", "onboarding", "info", "Create your first invoice", "Start the collection workflow with a billable invoice.", "No billable invoices exist.", "/invoices/new", rolesWith("invoices.create"), "Create invoice"));
  if (input.invoiceCount > 0 && !input.sharedInvoiceCount) items.push(notification("onboarding:share-invoice", "onboarding", "info", "Share your first payment request", "Open an invoice to prepare a payment link or WhatsApp message for a client.", "No recorded payment-link or reminder sharing activity exists.", "/invoices", rolesWith("invoices.send"), "Open invoices"));
  if (input.pendingProofCount) items.push(notification("payments:proof-review", "payments", "critical", "Payment proofs need review", `${input.pendingProofCount} payment proof${input.pendingProofCount === 1 ? " is" : "s are"} awaiting a decision.`, "Pending payment proofs require a secure review action.", "/payments?view=awaiting", reviewRoles, "Review proofs"));
  if (input.rejectedProofCount) items.push(notification("payments:rejected-proofs", "payments", "warning", "Rejected payment proofs need follow-up", `${input.rejectedProofCount} rejected proof${input.rejectedProofCount === 1 ? " requires" : "s require"} an operational follow-up.`, "Rejected proof submissions are present.", "/payments?view=rejected", reviewRoles, "Open rejected proofs"));

  const invoices = input.invoices.filter((invoice) => !isQuoteDocument(invoice));
  const overdue = invoices.filter((invoice) => isOutstandingInvoice(invoice) && Boolean(invoice.due_date) && invoice.due_date! < today).length;
  const dueSoon = invoices.filter((invoice) => isOutstandingInvoice(invoice) && Boolean(invoice.due_date) && invoice.due_date! >= today && invoice.due_date! <= sevenDays).length;
  const partial = invoices.filter((invoice) => isOutstandingInvoice(invoice) && remainingForInvoice(invoice).primaryBalance > 0 && (invoice.payment_proofs || []).some((proof) => proof.status === "accepted" && !proof.voided_at)).length;
  if (overdue) items.push(notification("collections:overdue", "collections", "critical", "Overdue invoices need follow-up", `${overdue} invoice${overdue === 1 ? " is" : "s are"} overdue with an outstanding balance.`, "Outstanding invoices are past their due date.", "/invoices?status=overdue", invoiceRoles, "View overdue invoices"));
  if (dueSoon) items.push(notification("collections:due-soon", "collections", "warning", "Invoices are due soon", `${dueSoon} outstanding invoice${dueSoon === 1 ? " is" : "s are"} due within seven days.`, "Outstanding invoices have an approaching due date.", "/invoices", invoiceRoles, "Open invoices"));
  if (partial) items.push(notification("collections:partial-balances", "collections", "warning", "Partial payments have remaining balances", `${partial} invoice${partial === 1 ? " has" : "s have"} accepted payment activity and a remaining balance.`, "Accepted non-voided payments do not yet settle the full invoice balance.", "/invoices?status=partial", invoiceRoles, "Review balances"));
  if (input.pendingInvitationCount) items.push(notification("team:pending-invitations", "team", "info", "Team invitations are pending", `${input.pendingInvitationCount} invitation${input.pendingInvitationCount === 1 ? " is" : "s are"} awaiting acceptance.`, "Pending workspace invitations exist.", "/team", rolesWith("team.manage"), "Open team"));
  if (input.assignmentCount) items.push(notification("team:assignments", "team", "warning", "Assigned work needs attention", `${input.assignmentCount} operational assignment${input.assignmentCount === 1 ? " is" : "s are"} open for you.`, "Open assignments are addressed to the current user or role.", "/inbox", rolesWith("assignments.work"), "Open assignments"));
  return items;
}

export function deriveNotifications(items: DerivedNotification[], role: WorkspaceRole, limit = NOTIFICATION_LIMIT) {
  const bounded = Math.min(Math.max(Number.isFinite(limit) ? Math.floor(limit) : NOTIFICATION_LIMIT, 1), NOTIFICATION_LIMIT);
  return [...new Map(items.filter((item) => item.permittedRoles.includes(role)).map((item) => [item.id, item])).values()]
    .sort((a, b) => notificationSeverityRank(a.severity) - notificationSeverityRank(b.severity) || a.category.localeCompare(b.category) || a.id.localeCompare(b.id))
    .slice(0, bounded);
}
export function filterNotifications(items: DerivedNotification[], filter: NotificationFilter) {
  if (filter === "all") return items;
  if (filter === "action") return items.filter((item) => item.severity !== "info");
  if (filter === "payments") return items.filter((item) => item.category === "payments" || item.category === "collections");
  return items.filter((item) => item.category === filter);
}
export function notificationFilter(value: string | undefined): NotificationFilter {
  return value === "action" || value === "onboarding" || value === "payments" || value === "team" || value === "system" ? value : "all";
}
