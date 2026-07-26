import "server-only";
import type { WorkspaceContext } from "@/lib/get-workspace";
import type { createClient } from "@/lib/supabase/server";
import { deriveRecentActivity, type RecentActivityItem } from "@/lib/recent-activity";
type ServerClient=Awaited<ReturnType<typeof createClient>>;
const LIMIT=30;
export async function getWorkspaceRecentActivity(supabase:ServerClient,workspace:WorkspaceContext,limit=5):Promise<RecentActivityItem[]>{
 const [invoices,clients,events,proofs]=await Promise.all([
  supabase.from("invoices").select("id,created_at,invoice_number,document_type,status").eq("workspace_id",workspace.workspaceId).order("created_at",{ascending:false}).limit(LIMIT),
  supabase.from("clients").select("id,created_at,name").eq("workspace_id",workspace.workspaceId).order("created_at",{ascending:false}).limit(LIMIT),
  supabase.from("invoice_events").select("id,invoice_id,event_type,created_at").eq("workspace_id",workspace.workspaceId).in("event_type",["reminder_copied","payment_link_copied","payment_link_opened","receipt_issued"]).order("created_at",{ascending:false}).limit(LIMIT),
  supabase.from("payment_proofs").select("id,status,uploaded_at,confirmed_at,reviewed_at,voided_at,invoices!inner(id,workspace_id,invoice_number)").eq("invoices.workspace_id",workspace.workspaceId).order("uploaded_at",{ascending:false}).limit(LIMIT)
 ]);
 const invoiceMap=new Map((invoices.data||[]).map(i=>[i.id,i]));
 const facts=(proofs.data||[]).map(p=>{const invoice=Array.isArray(p.invoices)?p.invoices[0]:p.invoices;return {id:p.id,occurredAt:p.status==="pending"?p.uploaded_at:p.reviewed_at||p.confirmed_at,invoiceId:invoice?.id||null,invoiceNumber:invoice?.invoice_number||null,status:p.status,voidedAt:p.voided_at}}).filter((x):x is typeof x & {occurredAt:string}=>Boolean(x.occurredAt));
 return deriveRecentActivity({invoiceCreations:(invoices.data||[]).map(i=>({id:i.id,occurredAt:i.created_at,invoiceId:i.id,invoiceNumber:i.invoice_number,documentType:i.document_type,status:i.status})),clientCreations:(clients.data||[]).map(c=>({id:c.id,occurredAt:c.created_at,clientId:c.id,clientName:c.name})),invoiceEvents:(events.data||[]).map(e=>({id:e.id,occurredAt:e.created_at,invoiceId:e.invoice_id||null,invoiceNumber:invoiceMap.get(e.invoice_id||"")?.invoice_number||null,eventType:e.event_type})),proofEvents:facts,paymentEvents:facts,receiptEvents:(events.data||[]).filter(e=>e.event_type==="receipt_issued").map(e=>({id:e.id,occurredAt:e.created_at,invoiceId:e.invoice_id||null,invoiceNumber:invoiceMap.get(e.invoice_id||"")?.invoice_number||null})),limit});
}