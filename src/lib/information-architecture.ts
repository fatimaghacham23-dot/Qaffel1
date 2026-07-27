import type { Permission, WorkspaceRole } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

export type NavigationDestination = {
  id: "home" | "invoices" | "payments" | "clients" | "reports" | "team" | "settings" | "notifications";
  href: string;
  label: string;
  permission?: Permission;
  mobile?: boolean;
};

/** One source of truth for authenticated navigation and consolidation. */
export const primaryNavigation: readonly NavigationDestination[] = [
  { id: "home", href: "/dashboard", label: "Home", mobile: true },
  { id: "invoices", href: "/invoices", label: "Invoices", permission: "invoices.view", mobile: true },
  { id: "payments", href: "/payments", label: "Payments", permission: "proofs.view", mobile: true },
  { id: "clients", href: "/clients", label: "Clients", permission: "clients.view", mobile: true },
  { id: "reports", href: "/reports", label: "Reports", permission: "reports.view" },
  { id: "team", href: "/team", label: "Team", permission: "team.view" },
  { id: "notifications", href: "/notifications", label: "Notifications" },
  { id: "settings", href: "/settings/profile", label: "Settings", permission: "settings.manage" }
] as const;

export const settingsDestinations = [
  { href: "/settings/profile", label: "Business profile" },
  { href: "/settings/payment-methods", label: "Payment methods" },
  { href: "/settings/service-presets", label: "Invoice presets" },
  { href: "/connectivity", label: "Integrations" },
  { href: "/settings/billing", label: "Subscription" }
] as const;

export const reportDestinations = [
  { href: "/reports", label: "Financial reports" },
  { href: "/finance", label: "Finance close" },
  { href: "/export", label: "Exports" },
  { href: "/intelligence/deep", label: "Collection analysis" }
] as const;

/** Documentation only until each feature-complete target is verified. */
export const legacyRouteDestinations = {
  "/proofs": "/payments?tab=review",
  "/recoveries": "/payments?tab=recovery",
  "/connectivity": "/settings",
  "/finance": "/reports?tab=close",
  "/export": "/reports?tab=exports",
  "/intelligence/deep": "/reports?tab=analysis"
} as const;

export function navigationForRole(role: WorkspaceRole | null | undefined) {
  return primaryNavigation.filter((item) => !item.permission || hasPermission(role, item.permission));
}

export function mobileNavigationForRole(role: WorkspaceRole | null | undefined) {
  return navigationForRole(role).filter((item) => item.mobile);
}
