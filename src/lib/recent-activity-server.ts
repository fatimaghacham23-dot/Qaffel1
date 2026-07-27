import "server-only";

import type { WorkspaceContext } from "@/lib/get-workspace";
import { type PreviewDiagnosticTracker, throwSupabaseQueryFailure } from "@/lib/preview-render-diagnostics";
import { deriveRecentActivity, type RecentActivityItem } from "@/lib/recent-activity";
import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;
const LIMIT = 30;

function requireRecentActivityQuery(result: object, tracker: PreviewDiagnosticTracker | undefined) {
  const queryError = "error" in result ? result.error : null;
  if (!queryError) return result;
  if (tracker) throwSupabaseQueryFailure(tracker, "DASHBOARD_RECENT_ACTIVITY", queryError);
  throw queryError;
}

export async function getWorkspaceRecentActivity(supabase: ServerClient, workspace: WorkspaceContext, limit = 5, tracker?: PreviewDiagnosticTracker): Promise<RecentActivityItem[]> {
  const [invoices, clients, events, proofs] = await Promise.all([
    supabase.from("invoices").select("id,created_at,invoice_number,document_type,status").eq("workspace_id", workspace.workspaceId).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("clients").select("id,created_at,name").eq("workspace_id", workspace.workspaceId).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("invoice_events").select("id,invoice_id,event_type,created_at").eq("workspace_id", workspace.workspaceId).in("event_type", ["reminder_copied", "payment_link_copied", "payment_link_opened", "receipt_issued"]).order("created_at", { ascending: false }).limit(LIMIT),
    supabase.from("payment_proofs").select("id,status,uploaded_at,confirmed_at,reviewed_at,voided_at,invoices!inner(id,workspace_id,invoice_number)").eq("invoices.workspace_id", workspace.workspaceId).order("uploaded_at", { ascending: false }).limit(LIMIT)
  ]);
  requireRecentActivityQuery(invoices, tracker);
  requireRecentActivityQuery(clients, tracker);
  requireRecentActivityQuery(events, tracker);
  requireRecentActivityQuery(proofs, tracker);

  const invoiceRows = invoices.data || [];
  const clientRows = clients.data || [];
  const eventRows = events.data || [];
  const proofRows = proofs.data || [];
  const invoiceMap = new Map(invoiceRows.map((invoice) => [invoice.id, invoice]));
  const facts = proofRows.map((proof) => {
    const invoice = Array.isArray(proof.invoices) ? proof.invoices[0] : proof.invoices;
    return { id: proof.id, occurredAt: proof.status === "pending" ? proof.uploaded_at : proof.reviewed_at || proof.confirmed_at, invoiceId: invoice?.id || null, invoiceNumber: invoice?.invoice_number || null, status: proof.status, voidedAt: proof.voided_at };
  }).filter((item): item is typeof item & { occurredAt: string } => Boolean(item.occurredAt));
  return deriveRecentActivity({
    invoiceCreations: invoiceRows.map((invoice) => ({ id: invoice.id, occurredAt: invoice.created_at, invoiceId: invoice.id, invoiceNumber: invoice.invoice_number, documentType: invoice.document_type, status: invoice.status })),
    clientCreations: clientRows.map((client) => ({ id: client.id, occurredAt: client.created_at, clientId: client.id, clientName: client.name })),
    invoiceEvents: eventRows.map((event) => ({ id: event.id, occurredAt: event.created_at, invoiceId: event.invoice_id || null, invoiceNumber: invoiceMap.get(event.invoice_id || "")?.invoice_number || null, eventType: event.event_type })),
    proofEvents: facts,
    paymentEvents: facts,
    receiptEvents: eventRows.filter((event) => event.event_type === "receipt_issued").map((event) => ({ id: event.id, occurredAt: event.created_at, invoiceId: event.invoice_id || null, invoiceNumber: invoiceMap.get(event.invoice_id || "")?.invoice_number || null })),
    limit
  });
}
