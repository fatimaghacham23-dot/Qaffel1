/** Central workspace filters used by every dashboard query. RLS remains the second boundary. */
export function dashboardScope(workspaceId: string) {
  const value = workspaceId.trim();
  if (!value) throw new Error("A workspace is required to load the dashboard.");
  return {
    workspace: ["workspace_id", value] as const,
    proofWorkspace: ["invoices.workspace_id", value] as const
  };
}
