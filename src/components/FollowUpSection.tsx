"use client";

import { useState, useMemo, useEffect } from "react";
import { Copy, MessageCircle, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { money, shortDate } from "@/lib/format";
import { getDepositRequest, roundCurrencyAmount } from "@/lib/deposit";
import { getDisplayInvoiceStatus } from "@/lib/status";
import { recordReminderEventAction } from "@/app/actions";

interface FollowUpSectionProps {
  invoice: any;
  client?: any;
  remainingBalance: {
    usd: number;
    lbp: number;
    primaryCurrency: string;
    primaryBalance: number;
    primaryTotalPaid: number;
  };
  lastReminder?: {
    created_at: string;
    metadata: any;
  } | null;
}

export function FollowUpSection({ 
  invoice, 
  client, 
  remainingBalance,
  lastReminder 
}: FollowUpSectionProps) {
  const [isRecording, setIsRecording] = useState(false);

  const publicUrl = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${baseUrl}/pay/${invoice.public_token}`;
  }, [invoice.public_token]);

  const displayStatus = getDisplayInvoiceStatus(invoice);
  const depositRequest = useMemo(() => getDepositRequest(invoice), [invoice]);
  
  const stage = useMemo(() => {
    if (invoice.status === "paid") return "paid";
    if (
      depositRequest &&
      displayStatus !== "paid" &&
      remainingBalance.primaryTotalPaid < depositRequest.amount
    ) {
      return "deposit";
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (invoice.valid_until && new Date(invoice.valid_until) < new Date()) {
      return "expired";
    }

    if (displayStatus === "partial") return "partial";

    if (!invoice.due_date) return "gentle";
    
    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "before_due";
    if (diffDays === 0) return "due_today";
    if (diffDays <= 6) return "overdue_recent";
    return "overdue_late";
  }, [invoice, displayStatus, depositRequest, remainingBalance.primaryTotalPaid]);

  const message = useMemo(() => {
    const greeting = client?.name ? `Hi ${client.name},` : "Hi,";
    const amountStr = money(remainingBalance.primaryBalance, remainingBalance.primaryCurrency as "USD" | "LBP");
    const invRef = invoice.invoice_number ? `invoice #${invoice.invoice_number}` : `your invoice (${invoice.title})`;
    const depositDue = depositRequest
      ? roundCurrencyAmount(depositRequest.amount - remainingBalance.primaryTotalPaid, depositRequest.currency)
      : 0;

    switch (stage) {
      case "deposit":
        return `${greeting} For ${invRef}, a deposit of ${money(depositDue, depositRequest?.currency || "USD")} is requested to get started. The remaining balance of ${money(depositRequest?.remainingAfterDeposit || 0, depositRequest?.currency || "USD")} will be due later. You can pay or upload proof here: ${publicUrl}. Thanks!`;

      case "before_due":
        return `${greeting} Hope you're having a good week. Just a friendly note that ${invRef} for ${amountStr} is due on ${shortDate(invoice.due_date)}. You can view/pay it here: ${publicUrl}. Thanks!`;
      
      case "due_today":
        return `${greeting} Just a quick reminder that ${invRef} (${amountStr}) is due today. You can settle it here whenever you're ready: ${publicUrl}. Best regards.`;
      
      case "overdue_recent":
        return `${greeting} I hope all is well. It looks like ${invRef} for ${amountStr} is now slightly overdue. Whenever you have a moment, could you please take a look? Here's the link: ${publicUrl}. Thanks!`;
      
      case "overdue_late":
        return `${greeting} Following up again on ${invRef} which is now overdue. Please let me know if you have any questions regarding the ${amountStr} balance. You can pay or upload proof here: ${publicUrl}. Thank you.`;
      
      case "partial":
        return `${greeting} Thank you for the payment received so far. Just a reminder that there is a remaining balance of ${amountStr} on ${invRef}. You can find the updated link here: ${publicUrl}. Thanks!`;
      
      case "expired":
        return `${greeting} It looks like the payment link for ${invRef} has expired. I can refresh the validity date for you if you're ready to settle the ${amountStr} balance. Let me know! Link: ${publicUrl}`;
      
      case "gentle":
      default:
        return `${greeting} Hope you're well. Just sending over the link for ${invRef} (${amountStr}) in case you need it: ${publicUrl}. Best regards.`;
    }
  }, [stage, client, invoice, remainingBalance, publicUrl, depositRequest]);

  const handleAction = async (type: "copy" | "whatsapp") => {
    setIsRecording(true);
    try {
      if (type === "copy") {
        await navigator.clipboard.writeText(message);
        toast.success("Reminder copied to clipboard");
      }
      
      // Record the activity in the timeline
      await recordReminderEventAction(invoice.id, stage, type);

      if (type === "whatsapp" && client?.phone) {
        const cleanPhone = client.phone.replace(/\D/g, '');
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
      }
    } catch (err) {
      toast.error("Failed to record activity");
    } finally {
      setIsRecording(false);
    }
  };

  if (invoice.status === "paid") return null;

  return (
    <section className="panel mt-6" id="follow-up">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Smart Follow-up</h2>
          <p className="text-xs text-slate-500 mt-0.5">Generate and send professional reminders.</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="inline-flex items-center rounded-full bg-cedar/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cedar">
            Stage: {stage.replace('_', ' ')}
          </span>
          {lastReminder && (
            <p className="mt-1 text-[10px] text-slate-400 italic">
              Last reminder: {shortDate(lastReminder.created_at)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{message}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleAction("copy")}
              disabled={isRecording}
              className="btn btn-secondary flex items-center gap-2 text-xs"
            >
              <Copy size={14} />
              Copy message
            </button>
            {client?.phone ? (
              <button
                onClick={() => handleAction("whatsapp")}
                disabled={isRecording}
                className="btn btn-primary bg-[#25D366] hover:bg-[#128C7E] border-none flex items-center gap-2 text-xs text-white"
              >
                <MessageCircle size={14} />
                Open WhatsApp
              </button>
            ) : (
              <p className="text-[10px] text-slate-400 italic">Add client phone to use WhatsApp.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3">
          <Clock className="mt-0.5 text-slate-400" size={16} />
          <div>
            <p className="text-xs font-semibold text-ink">Tone of voice</p>
            <p className="text-[10px] text-slate-500">Professional and non-intrusive based on {stage.replace('_', ' ')} status.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3">
          <AlertCircle className="mt-0.5 text-slate-400" size={16} />
          <div>
            <p className="text-xs font-semibold text-ink">No automation</p>
            <p className="text-[10px] text-slate-500">Qaffel never sends messages automatically. You remain in control.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
