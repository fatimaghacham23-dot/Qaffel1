"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceRole } from "@/lib/permissions";
import { hasPermission, type Permission } from "@/lib/permissions";

export type WorkspaceContextValue = {
  workspaceId: string;
  workspaceName: string;
  userId: string;
  userFullName: string;
  role: WorkspaceRole;
};

const WorkspaceCtx = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: ReactNode;
}) {
  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

/**
 * Access workspace context in client components.
 * Must be used inside a WorkspaceProvider.
 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) {
    throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  }
  return ctx;
}

/**
 * Check a permission against the current user's role.
 */
export function useHasPermission(permission: Permission): boolean {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) return false;
  return hasPermission(ctx.role, permission);
}
