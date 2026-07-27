import { isAcceptedNonVoidedPayment } from "@/lib/collection";
export type RecentActivityItem={id:string;occurredAt:string;type:"invoice_created"|"client_created"|"invoice_shared"|"proof_uploaded"|"proof_approved"|"proof_rejected"|"payment_received"|"receipt_issued";title:string;description:string|null;href:string|null};
type Fact={id:string;occurredAt:string;invoiceId?:string|null;clientId?:string|null;invoiceNumber?:string|null;clientName?:string|null;documentType?:string|null;status?:string|null;amountUsd?:number|null;amountLbp?:number|null;voidedAt?:string|null;eventType?:string|null};
const valid=(value:string)=>Number.isFinite(new Date(value).getTime());
const label=(fact:Fact)=>fact.invoiceNumber||fact.clientName||null;
const item=(type:RecentActivityItem["type"],fact:Fact,title:string,href:string|null):RecentActivityItem=>({id:`${type}:${fact.id}`,occurredAt:fact.occurredAt,type,title,description:label(fact),href});
export function deriveRecentActivity(input:{invoiceCreations?:Fact[];clientCreations?:Fact[];invoiceEvents?:Fact[];proofEvents?:Fact[];paymentEvents?:Fact[];receiptEvents?:Fact[];limit?:number}):RecentActivityItem[]{
 const out:RecentActivityItem[]=[];const add=(type:RecentActivityItem["type"],f:Fact,title:string,href:string|null)=>{if(valid(f.occurredAt)&&!out.some(x=>x.id===`${type}:${f.id}`))out.push(item(type,f,title,href));};
 for(const f of input.invoiceCreations||[])if(f.documentType!=="quote"&&f.invoiceId)add("invoice_created",f,"Invoice created",`/invoices/${f.invoiceId}`);
 for(const f of input.clientCreations||[])if(f.clientId)add("client_created",f,"Client created",`/clients/${f.clientId}`);
 for(const f of input.invoiceEvents||[])if(["reminder_copied","payment_link_copied","payment_link_opened"].includes(f.eventType||"")&&f.invoiceId)add("invoice_shared",f,"Payment request shared",`/invoices/${f.invoiceId}`);
 for(const f of input.proofEvents||[]){if(!f.invoiceId)continue;if(f.status==="pending")add("proof_uploaded",f,"Proof uploaded",`/invoices/${f.invoiceId}`);if(f.status==="accepted")add("proof_approved",f,"Proof approved",`/invoices/${f.invoiceId}`);if(f.status==="rejected")add("proof_rejected",f,"Proof rejected",`/invoices/${f.invoiceId}`)}
 for(const f of input.paymentEvents||[])if(f.invoiceId&&isAcceptedNonVoidedPayment({status:f.status,voided_at:f.voidedAt}))add("payment_received",f,"Payment received",`/invoices/${f.invoiceId}`);
 for(const f of input.receiptEvents||[])if(f.invoiceId)add("receipt_issued",f,"Receipt issued",`/invoices/${f.invoiceId}`);
 return out.sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)||a.id.localeCompare(b.id)).slice(0,Math.min(Math.max(input.limit||5,1),5));
}