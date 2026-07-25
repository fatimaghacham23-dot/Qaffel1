import type { InvoiceStatus } from "@/lib/types";

type JsonObject = Record<string, unknown>;

export type PublicPaymentProofSummary = {
  status: string;
  amount_usd?: number | null;
  amount_lbp?: number | null;
};

export type PublicPaymentInvoice = {
  id: string;
  user_id: string;
  public_token: string;
  invoice_number: string;
  title: string;
  description?: string | null;
  amount_usd?: number | null;
  amount_lbp?: number | null;
  currency: string;
  due_date?: string | null;
  status: InvoiceStatus;
  document_type?: string | null;
  approval_status?: string | null;
  valid_until?: string | null;
  exchange_rate_lbp_per_usd?: number | null;
  rate_note?: string | null;
  approved_at?: string | null;
  approved_by_name?: string | null;
  approved_note?: string | null;
  deposit_enabled?: boolean | null;
  deposit_type?: string | null;
  deposit_percent?: number | null;
  deposit_amount_usd?: number | null;
  deposit_amount_lbp?: number | null;
  deposit_note?: string | null;
  created_at: string;
  payment_plan?: unknown;
  clients?: { name?: string | null } | null;
};

export type PublicPaymentProfile = {
  business_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  logo_storage_path?: string | null;
  brand_color?: string | null;
  brand_accent?: string | null;
  business_tagline?: string | null;
  business_website?: string | null;
  instagram_handle?: string | null;
  whatsapp_phone?: string | null;
  support_email?: string | null;
  invoice_footer_note?: string | null;
  document_theme?: string | null;
  business_hours?: string | null;
  business_city?: string | null;
};

export type PublicPaymentPageData = {
  invoice: PublicPaymentInvoice;
  profile: PublicPaymentProfile | null;
  proofs: PublicPaymentProofSummary[];
  methods: JsonObject[];
};

function object(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

/**
 * Validate the narrow JSON projection returned by get_public_payment_page.
 * The token itself is checked again to prevent rendering a malformed or
 * accidentally mismatched RPC result.
 */
export function parsePublicPaymentPageData(
  value: unknown,
  expectedToken: string
): PublicPaymentPageData | null {
  const root = object(value);
  const invoice = object(root?.invoice);
  if (
    !invoice ||
    typeof invoice.id !== "string" ||
    typeof invoice.user_id !== "string" ||
    invoice.public_token !== expectedToken
  ) {
    return null;
  }

  const profile = object(root?.profile);
  const proofs = Array.isArray(root?.proofs)
    ? root.proofs.map(object).filter((row): row is JsonObject => Boolean(row))
    : [];
  const methods = Array.isArray(root?.methods)
    ? root.methods.map(object).filter((row): row is JsonObject => Boolean(row))
    : [];

  return {
    invoice: invoice as PublicPaymentInvoice,
    profile: profile as PublicPaymentProfile | null,
    proofs: proofs as PublicPaymentProofSummary[],
    methods
  };
}
