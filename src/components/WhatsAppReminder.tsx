"use client";

import { useState } from "react";
import { toast } from "sonner";
import { paymentRequestMessage, whatsAppHref } from "@/lib/whatsapp";

interface WhatsAppReminderProps { clientName: string | null; clientPhone: string | null; invoiceNumber: string | null; amountUsd: number | null; amountLbp: number | null; publicToken: string; invoiceStatus: string; }

export function WhatsAppReminder(props: WhatsAppReminderProps) {
  const [copied, setCopied] = useState(false);
  if (!["unpaid", "overdue", "partial", "sent"].includes(props.invoiceStatus)) return null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const paymentLink = `${appUrl}/pay/${props.publicToken}`;
  const amount = props.amountUsd ? `$${props.amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : props.amountLbp ? `LBP ${props.amountLbp.toLocaleString()}` : "the invoice amount";
  const message = paymentRequestMessage({ clientName: props.clientName, invoiceNumber: props.invoiceNumber, amount, paymentLink, reminder: true });
  const href = whatsAppHref(props.clientPhone, message);
  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); setCopied(true); toast.success(label); window.setTimeout(() => setCopied(false), 1800); };
  return <div className="panel mt-4"><h2 className="text-lg font-bold text-ink">WhatsApp reminder</h2><p className="mt-2 text-sm text-slate-600">Prepare the message, then send it yourself in WhatsApp. Qaffel does not mark it as delivered.</p>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-4">Open WhatsApp</a> : <p className="mt-4 text-sm font-medium text-amber-700">No client phone number is saved. Copy the message and choose a recipient manually.</p>}<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => copy(message, "Reminder message copied")} className="btn btn-secondary text-xs">{copied ? "Copied" : "Copy reminder message"}</button><button type="button" onClick={() => copy(paymentLink, "Payment link copied")} className="btn btn-secondary text-xs">Copy payment link</button></div></div>;
}
