export type ManualEvent = { id:string; invoice_id:string; created_at:string; actor_name?:string|null; metadata?:Record<string,unknown>|null };
export type PaymentRecord = { id:string; invoice_id:string; receipt_token?:string|null; status?:string|null; voided_at?:string|null; confirmed_at?:string|null; uploaded_at?:string|null };
export function manualPaymentIds(events:ManualEvent[], payments:PaymentRecord[]) {
  const byToken=new Map(payments.filter(p=>p.receipt_token).map(p=>[p.receipt_token!,p]));
  const ids=new Set<string>();
  for(const event of events) { if(event.invoice_id==null)continue; const token=typeof event.metadata?.receipt_token==="string"?event.metadata.receipt_token:null; const payment=token?byToken.get(token):null; if(payment&&payment.invoice_id===event.invoice_id)ids.add(payment.id); }
  return ids;
}
