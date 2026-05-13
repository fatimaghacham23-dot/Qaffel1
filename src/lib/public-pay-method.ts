/**
 * Public pay page: payment method rows exposed to the browser must not include
 * internal ids (payment_methods.id, user_id, etc.).
 */
export type PublicPaymentMethodOption = {
  type: string | null;
  label: string;
  instructions: string;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  account_reference?: string | null;
  qr_image_path?: string | null;
  external_link?: string | null;
  normalizedType: string;
};

export function toPublicPaymentMethodOption(row: Record<string, unknown>): PublicPaymentMethodOption {
  const type = (row.type as string | null) ?? null;
  const rawType = (type || "").trim();
  const normalizedType = rawType.toLowerCase().replaceAll(" ", "_");
  return {
    type,
    label: String(row.label ?? "").trim() || "Payment method",
    instructions: String(row.instructions ?? ""),
    receiver_name: (row.receiver_name as string | null | undefined) ?? null,
    receiver_phone: (row.receiver_phone as string | null | undefined) ?? null,
    account_reference: (row.account_reference as string | null | undefined) ?? null,
    qr_image_path: (row.qr_image_path as string | null | undefined) ?? null,
    external_link: (row.external_link as string | null | undefined) ?? null,
    normalizedType
  };
}
