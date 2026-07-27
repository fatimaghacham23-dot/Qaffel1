export type WhatsAppLocale = "en" | "ar";

export function normalizeWhatsAppPhone(phone: string | null | undefined) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("961")) return digits;
  if (digits.startsWith("0")) return `961${digits.slice(1)}`;
  return `961${digits}`;
}

export function paymentRequestMessage(input: { clientName?: string | null; invoiceNumber?: string | null; amount: string; paymentLink: string; locale?: WhatsAppLocale; reminder?: boolean }) {
  const name = input.clientName ? ` ${input.clientName}` : "";
  if (input.locale === "ar") return `مرحباً${name}، فاتورتك رقم ${input.invoiceNumber || ""} بقيمة ${input.amount} جاهزة. يمكنك الاطلاع على تفاصيل الدفع ورفع إثبات التحويل عبر الرابط التالي: ${input.paymentLink}`;
  return input.reminder
    ? `Hello${name}, a reminder that invoice ${input.invoiceNumber || ""} for ${input.amount} is still awaiting payment. You can view payment details and upload proof here: ${input.paymentLink}`
    : `Hello${name}, invoice ${input.invoiceNumber || ""} for ${input.amount} is ready. You can view payment details and upload proof here: ${input.paymentLink}`;
}

export function whatsAppHref(phone: string | null | undefined, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : null;
}
