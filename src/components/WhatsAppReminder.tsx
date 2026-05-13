"use client";

import { useState } from "react";
import { toast } from "sonner";

interface WhatsAppReminderProps {
  clientName: string | null;
  clientPhone: string | null;
  invoiceNumber: string | null;
  amountUsd: number | null;
  amountLbp: number | null;
  publicToken: string;
  invoiceStatus: string;
}

export function WhatsAppReminder({
  clientName,
  clientPhone,
  invoiceNumber,
  amountUsd,
  amountLbp,
  publicToken,
  invoiceStatus,
}: WhatsAppReminderProps) {
  const [isCopied, setIsCopied] = useState(false);

  const allowedStatuses = ["unpaid", "overdue", "partial", "sent"];
  if (!allowedStatuses.includes(invoiceStatus)) {
    return null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const paymentLink = `${appUrl}/pay/${publicToken}`;
  
  const formattedAmount = amountUsd 
    ? `$${amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : amountLbp 
      ? `LBP ${amountLbp.toLocaleString()}`
      : "pending amount";

  const message = clientName
    ? `Hi ${clientName}, small reminder that invoice ${invoiceNumber || ""} for ${formattedAmount} is still pending. You can pay here: ${paymentLink}`
    : `Hi, small reminder that invoice ${invoiceNumber || ""} for ${formattedAmount} is still pending. You can pay here: ${paymentLink}`;

  const normalizePhone = (phone: string) => {
    let clean = phone.replace(/[\s\-\+\(\)]/g, "");
    
    // Lebanese number formats: 03, 70, 71, 76, 78, 79, 81, etc.
    if (/^(03|70|71|76|78|79|81|82)\d{6}$/.test(clean)) {
      return `961${clean.substring(clean.startsWith('0') ? 1 : 0)}`;
    }
    // Handle 03 case specifically if not covered above
    if (clean.startsWith("03") && clean.length === 8) {
      return `9613${clean.substring(2)}`;
    }
    
    return clean;
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    toast.success("Reminder message copied to clipboard");
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(paymentLink);
    toast.success("Payment link copied to clipboard");
  };

  const whatsappUrl = clientPhone 
    ? `https://wa.me/${normalizePhone(clientPhone)}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <div className="panel mt-4">
      <h2 className="text-lg font-bold text-ink">WhatsApp Reminder</h2>
      
      {clientPhone ? (
        <div className="mt-4">
          <a
            href={whatsappUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary inline-flex items-center gap-2"
          >
            Open WhatsApp reminder
          </a>
          <p className="mt-2 text-xs text-slate-500">
            This will open WhatsApp with a prefilled message for {clientPhone}.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-amber-600 font-medium">No client phone number saved.</p>
          <p className="text-sm text-slate-600 mt-1">Copy this message and send it manually:</p>
          <div className="mt-2 p-3 bg-slate-50 rounded-md text-sm text-slate-700 border border-slate-100">
            {message}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleCopyMessage}
          className="btn btn-secondary text-xs"
        >
          {isCopied ? "Copied!" : "Copy reminder message"}
        </button>
        <button
          onClick={handleCopyLink}
          className="btn btn-secondary text-xs"
        >
          Copy payment link
        </button>
      </div>
    </div>
  );
}
