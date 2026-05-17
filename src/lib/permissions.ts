/**
 * Qaffel Role & Permission System
 *
 * Simple, deterministic permission matrix.
 * No complex RBAC engine — just a lookup table.
 */

export type WorkspaceRole = "owner" | "admin" | "finance" | "operations" | "reviewer" | "staff";

export type Permission =
  | "invoices.create"
  | "invoices.edit"
  | "invoices.view"
  | "invoices.delete"
  | "invoices.send"
  | "proofs.view"
  | "proofs.review"
  | "payments.void"
  | "clients.create"
  | "clients.edit"
  | "clients.view"
  | "clients.delete"
  | "settings.manage"
  | "team.manage"
  | "team.view"
  | "exports.download"
  | "exports.finance"
  | "reports.view"
  | "recoveries.manage"
  | "recoveries.view"
  | "approvals.request"
  | "approvals.resolve"
  | "assignments.view"
  | "assignments.manage"
  | "assignments.work";

/**
 * Permission matrix: role → list of granted permissions.
 * Owner has all permissions implicitly.
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, readonly Permission[]> = {
  owner: [
    "invoices.create", "invoices.edit", "invoices.view", "invoices.delete", "invoices.send",
    "proofs.view", "proofs.review", "payments.void",
    "clients.create", "clients.edit", "clients.view", "clients.delete",
    "settings.manage", "team.manage", "team.view",
    "exports.download", "exports.finance", "reports.view",
    "recoveries.manage", "recoveries.view",
    "approvals.request", "approvals.resolve",
    "assignments.view", "assignments.manage", "assignments.work",
  ],
  admin: [
    "invoices.create", "invoices.edit", "invoices.view", "invoices.delete", "invoices.send",
    "proofs.view", "proofs.review", "payments.void",
    "clients.create", "clients.edit", "clients.view", "clients.delete",
    "settings.manage", "team.manage", "team.view",
    "exports.download", "exports.finance", "reports.view",
    "recoveries.manage", "recoveries.view",
    "approvals.request", "approvals.resolve",
    "assignments.view", "assignments.manage", "assignments.work",
  ],
  finance: [
    "invoices.view",
    "proofs.view", "proofs.review", "payments.void",
    "clients.view",
    "team.view",
    "exports.download", "exports.finance", "reports.view",
    "recoveries.view",
    "approvals.request", "approvals.resolve",
    "assignments.view", "assignments.manage", "assignments.work",
  ],
  operations: [
    "invoices.create", "invoices.edit", "invoices.view", "invoices.send",
    "proofs.view", "proofs.review",
    "clients.create", "clients.edit", "clients.view",
    "team.view",
    "exports.download", "reports.view",
    "recoveries.manage", "recoveries.view",
    "approvals.request",
    "assignments.view", "assignments.manage", "assignments.work",
  ],
  reviewer: [
    "invoices.view",
    "proofs.view", "proofs.review",
    "clients.view",
    "team.view",
    "reports.view",
    "assignments.view", "assignments.work",
  ],
  staff: [
    "invoices.view",
    "proofs.view",
    "clients.view",
    "team.view",
    "assignments.view",
  ],
} as const;

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: WorkspaceRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Get all permissions for a role.
 */
export function getPermissions(role: WorkspaceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Throw if the role does not have the required permission.
 * Use in server actions.
 */
export function requirePermission(
  role: WorkspaceRole | null | undefined,
  permission: Permission,
  message?: string
): asserts role is WorkspaceRole {
  if (!role || !hasPermission(role, permission)) {
    throw new Error(message ?? `Permission denied: ${permission} requires role with appropriate access.`);
  }
}

/**
 * Human-readable role labels for UI display.
 */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  finance: "Finance",
  operations: "Operations",
  reviewer: "Reviewer",
  staff: "Staff",
};

/**
 * Human-readable role descriptions.
 */
export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: "Full control of the workspace. Can transfer ownership.",
  admin: "Full operational access. Can manage team members and settings.",
  finance: "Can review proofs, void payments, and access financial exports.",
  operations: "Can create invoices, manage clients, and handle recoveries.",
  reviewer: "Can review and approve payment proofs.",
  staff: "Read-only access to invoices, clients, and proofs.",
};

/**
 * Roles that can be assigned via invitation (not owner).
 */
export const ASSIGNABLE_ROLES: WorkspaceRole[] = ["admin", "finance", "operations", "reviewer", "staff"];
