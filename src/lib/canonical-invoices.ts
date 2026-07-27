import { isActiveInvoice, type CollectionInvoice } from "@/lib/collection";

/**
 * Invoice facts are authorised only when their workspace is active and, when
 * linked to a client, that client belongs to the same workspace. Legacy null
 * workspace rows and cross-workspace client links are deliberately excluded.
 */
type InvoiceClientWorkspace = { workspace_id?: string | null };
export type WorkspaceInvoiceFact = CollectionInvoice & {
  workspace_id?: string | null;
  client_id?: string | null;
  clients?: InvoiceClientWorkspace | InvoiceClientWorkspace[] | null;
};

function relatedClientWorkspaceId(invoice: WorkspaceInvoiceFact) {
  const relation = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
  return relation?.workspace_id || null;
}

export function isCanonicalWorkspaceInvoice<T extends WorkspaceInvoiceFact>(invoice: T, workspaceId: string) {
  if (!workspaceId || invoice.workspace_id !== workspaceId) return false;
  if (!invoice.client_id) return true;
  return relatedClientWorkspaceId(invoice) === workspaceId;
}

export function filterCanonicalWorkspaceInvoices<T extends WorkspaceInvoiceFact>(invoices: T[], workspaceId: string) {
  return invoices.filter((invoice) => isCanonicalWorkspaceInvoice(invoice, workspaceId));
}

export function filterCanonicalActiveWorkspaceInvoices<T extends WorkspaceInvoiceFact>(invoices: T[], workspaceId: string) {
  return filterCanonicalWorkspaceInvoices(invoices, workspaceId).filter((invoice) => isActiveInvoice(invoice));
}
