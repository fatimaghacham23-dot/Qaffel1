"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { getAcceptedProofTotals, reconcileInvoiceStatus, getRemainingBalance } from "@/lib/status";
import { didSatisfyDeposit, getDepositRequest, roundCurrencyAmount } from "@/lib/deposit";
import { normalizeDocumentType } from "@/lib/documents";
import { shortDate } from "@/lib/format";
import type { DocumentType, InvoiceStatus } from "@/lib/types";
import { parsePaymentPlan } from "@/lib/payment-plan";
import { sanitizeHexColor, normalizeDocumentTheme } from "@/lib/brand";
import { assertAllowedRasterImageBytes } from "@/lib/image-bytes";
import {
  buildAiSummary,
  callGithubGpt4oVision,
  computeWarningsAndQueueTag,
  isAiVerificationEnabled,
  isProofImageForAi,
  MAX_IMAGE_BYTES,
  proofImageFingerprint,
  type AiProofReviewStored
} from "@/lib/ai-proof-verification";

async function createInvoiceEvent({
  invoiceId,
  userId,
  eventType,
  message,
  metadata = {}
}: {
  invoiceId: string;
  userId: string;
  eventType: string;
  message: string;
  metadata?: any;
}) {
  const supabase = await createClient();
  await supabase.from("invoice_events").insert({
    invoice_id: invoiceId,
    user_id: userId,
    event_type: eventType,
    message,
    metadata
  });
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") return "";
  return value.trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function nullableNumber(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formDataBoolean(formData: FormData, key: string) {
  return formData.getAll(key).some((value) => value === "on" || value === "true");
}

type DepositFields = {
  deposit_enabled: boolean;
  deposit_type: "percent" | "fixed" | null;
  deposit_percent: number | null;
  deposit_amount_usd: number | null;
  deposit_amount_lbp: number | null;
  deposit_note: string | null;
};

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameNullableNumber(a: unknown, b: unknown) {
  const left = numberOrNull(a);
  const right = numberOrNull(b);
  return left === right;
}

function buildDepositFields(formData: FormData, invoice: {
  amount_usd: number | null;
  amount_lbp: number | null;
  currency: string;
}): DepositFields {
  const depositEnabled = formDataBoolean(formData, "deposit_enabled");

  if (!depositEnabled) {
    return {
      deposit_enabled: false,
      deposit_type: null,
      deposit_percent: null,
      deposit_amount_usd: null,
      deposit_amount_lbp: null,
      deposit_note: null
    };
  }

  const note = nullableText(formData, "deposit_note");
  const currency = invoice.currency.toUpperCase() === "LBP" ? "LBP" : "USD";
  const invoiceTotal = currency === "USD" ? Number(invoice.amount_usd || 0) : Number(invoice.amount_lbp || 0);

  if (invoiceTotal <= 0) {
    throw new Error(`Enter an invoice total in ${currency} before requesting a deposit.`);
  }

  const rawType = text(formData, "deposit_type") || "percent";
  if (rawType !== "percent" && rawType !== "fixed") {
    throw new Error("Deposit type must be percent or fixed.");
  }

  if (rawType === "percent") {
    const percent = nullableNumber(formData, "deposit_percent");
    if (percent === null || percent <= 0 || percent > 100) {
      throw new Error("Deposit percent must be greater than 0 and no more than 100.");
    }

    return {
      deposit_enabled: true,
      deposit_type: "percent",
      deposit_percent: percent,
      deposit_amount_usd: invoice.amount_usd && invoice.amount_usd > 0
        ? roundCurrencyAmount((Number(invoice.amount_usd) * percent) / 100, "USD")
        : null,
      deposit_amount_lbp: invoice.amount_lbp && invoice.amount_lbp > 0
        ? roundCurrencyAmount((Number(invoice.amount_lbp) * percent) / 100, "LBP")
        : null,
      deposit_note: note
    };
  }

  const depositAmountUsd = nullableNumber(formData, "deposit_amount_usd");
  const depositAmountLbp = nullableNumber(formData, "deposit_amount_lbp");
  const primaryDepositAmount = currency === "USD" ? depositAmountUsd : depositAmountLbp;

  if (primaryDepositAmount === null || primaryDepositAmount <= 0) {
    throw new Error(`Fixed deposit amount must be greater than 0 in ${currency}.`);
  }

  if (primaryDepositAmount > invoiceTotal) {
    throw new Error(`Fixed deposit amount cannot exceed the invoice total in ${currency}.`);
  }

  if (depositAmountUsd !== null) {
    if (depositAmountUsd <= 0) throw new Error("Fixed deposit amount USD must be greater than 0.");
    if (invoice.amount_usd && depositAmountUsd > invoice.amount_usd) {
      throw new Error("Fixed deposit amount USD cannot exceed the invoice total in USD.");
    }
  }

  if (depositAmountLbp !== null) {
    if (depositAmountLbp <= 0) throw new Error("Fixed deposit amount LBP must be greater than 0.");
    if (invoice.amount_lbp && depositAmountLbp > invoice.amount_lbp) {
      throw new Error("Fixed deposit amount LBP cannot exceed the invoice total in LBP.");
    }
  }

  return {
    deposit_enabled: true,
    deposit_type: "fixed",
    deposit_percent: null,
    deposit_amount_usd: depositAmountUsd,
    deposit_amount_lbp: depositAmountLbp,
    deposit_note: note
  };
}

function disabledDepositFields(): DepositFields {
  return {
    deposit_enabled: false,
    deposit_type: null,
    deposit_percent: null,
    deposit_amount_usd: null,
    deposit_amount_lbp: null,
    deposit_note: null
  };
}

function depositEventMetadata(fields: DepositFields) {
  return {
    deposit_enabled: fields.deposit_enabled,
    deposit_type: fields.deposit_type,
    deposit_percent: fields.deposit_percent,
    deposit_amount_usd: fields.deposit_amount_usd,
    deposit_amount_lbp: fields.deposit_amount_lbp
  };
}

function depositConfigChanged(before: Record<string, unknown> | null | undefined, next: DepositFields) {
  return (
    Boolean(before?.deposit_enabled) !== next.deposit_enabled ||
    (before?.deposit_type || null) !== next.deposit_type ||
    !sameNullableNumber(before?.deposit_percent, next.deposit_percent) ||
    !sameNullableNumber(before?.deposit_amount_usd, next.deposit_amount_usd) ||
    !sameNullableNumber(before?.deposit_amount_lbp, next.deposit_amount_lbp) ||
    (before?.deposit_note || null) !== next.deposit_note
  );
}

function token() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().slice(0, 8);
}

function portalToken() {
  return token();
}

function invoiceNumber(documentType: DocumentType = "invoice") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const prefix = documentType === "quote" ? "QUO" : "INV";
  return `${prefix}-${date}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function generateUniqueInvoiceNumber({
  supabase,
  userId,
  preferred,
  excludeInvoiceId,
  documentType = "invoice"
}: {
  supabase: any;
  userId: string;
  preferred?: string | null;
  excludeInvoiceId?: string;
  documentType?: DocumentType;
}) {
  const candidateFromPreferred = preferred?.trim() || null;
  const start = candidateFromPreferred || invoiceNumber(documentType);

  const exists = async (candidate: string) => {
    let query = supabase.from("invoices").select("id").eq("user_id", userId).eq("invoice_number", candidate);
    if (excludeInvoiceId) query = query.neq("id", excludeInvoiceId);
    const { data } = await query.maybeSingle();
    return Boolean(data);
  };

  if (!(await exists(start))) {
    return { invoiceNumber: start, changed: false };
  }

  for (let i = 0; i < 15; i += 1) {
    const next = invoiceNumber(documentType);
    if (!(await exists(next))) {
      return { invoiceNumber: next, changed: true };
    }
  }

  return { invoiceNumber: `${invoiceNumber(documentType)}-${Math.floor(10 + Math.random() * 89)}`, changed: true };
}

function isoDateOnly(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

function normalizeMethod(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.toLowerCase() : null;
}

async function assertOk(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function updateProfileAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: nullableText(formData, "full_name"),
    business_name: nullableText(formData, "business_name"),
    phone: nullableText(formData, "phone"),
    business_address: nullableText(formData, "business_address"),
    default_currency: text(formData, "default_currency") || "USD",
    business_tagline: nullableText(formData, "business_tagline"),
    business_website: nullableText(formData, "business_website"),
    instagram_handle: nullableText(formData, "instagram_handle"),
    whatsapp_phone: nullableText(formData, "whatsapp_phone"),
    support_email: nullableText(formData, "support_email"),
    invoice_footer_note: nullableText(formData, "invoice_footer_note"),
    business_hours: nullableText(formData, "business_hours"),
    business_city: nullableText(formData, "business_city"),
    brand_color: sanitizeHexColor(nullableText(formData, "brand_color"), "#116466"),
    brand_accent: (() => {
      const raw = nullableText(formData, "brand_accent");
      return raw ? sanitizeHexColor(raw, "#116466") : null;
    })(),
    document_theme: normalizeDocumentTheme(text(formData, "document_theme"))
  });

  await assertOk(error);
  revalidatePath("/dashboard");
  revalidatePath("/settings/profile");
}

export async function uploadBusinessLogoAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("logo");
  if (!(file instanceof File)) throw new Error("Choose an image file.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Logo must be 2MB or smaller.");
  const ab = await file.arrayBuffer();
  const buf = new Uint8Array(ab);
  const kind = assertAllowedRasterImageBytes(buf);
  const ext = kind === "png" ? "png" : kind === "webp" ? "webp" : "jpg";
  const mime = kind === "png" ? "image/png" : kind === "webp" ? "image/webp" : "image/jpeg";
  const path = `${user.id}/logo-${Date.now()}.${ext}`;

  const { data: prev } = await supabase.from("profiles").select("logo_storage_path").eq("id", user.id).maybeSingle();
  const oldPath = prev?.logo_storage_path as string | null | undefined;

  const { error: upErr } = await supabase.storage.from("business-brand").upload(path, buf, {
    contentType: mime,
    upsert: false
  });
  await assertOk(upErr);

  const { error: dbErr } = await supabase.from("profiles").update({ logo_storage_path: path }).eq("id", user.id);
  await assertOk(dbErr);

  if (oldPath && oldPath !== path) {
    await supabase.storage.from("business-brand").remove([oldPath]);
  }
  revalidatePath("/settings/profile");
}

export async function removeBusinessLogoAction() {
  const { supabase, user } = await requireUser();
  const { data: prev } = await supabase.from("profiles").select("logo_storage_path").eq("id", user.id).maybeSingle();
  const oldPath = prev?.logo_storage_path as string | null | undefined;
  if (oldPath) {
    await supabase.storage.from("business-brand").remove([oldPath]);
  }
  const { error } = await supabase.from("profiles").update({ logo_storage_path: null }).eq("id", user.id);
  await assertOk(error);
  revalidatePath("/settings/profile");
}

export async function createClientAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const invoiceId = nullableText(formData, "invoice_id");

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      name: text(formData, "name"),
      phone: nullableText(formData, "phone"),
      email: nullableText(formData, "email"),
      notes: nullableText(formData, "notes"),
      client_portal_token: portalToken()
    })
    .select("id")
    .single();

  await assertOk(error);

  if (invoiceId && client) {
    // Verify ownership of the invoice before updating
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id")
      .eq("id", invoiceId)
      .eq("user_id", user.id)
      .single();

    if (invoice) {
      const { error: linkError } = await supabase
        .from("invoices")
        .update({ client_id: client.id })
        .eq("id", invoiceId)
        .eq("user_id", user.id);

      await assertOk(linkError);
      revalidatePath(`/invoices/${invoiceId}`);
      revalidatePath("/invoices");
      redirect(`/invoices/${invoiceId}`);
    }
  }

  revalidatePath("/clients");
  redirect("/clients");
}

export async function regenerateClientPortalTokenAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const clientId = text(formData, "client_id");

  const nextToken = portalToken();

  const { error } = await supabase
    .from("clients")
    .update({ client_portal_token: nextToken })
    .eq("id", clientId)
    .eq("user_id", user.id);

  await assertOk(error);

  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function updateClientAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  const { error } = await supabase
    .from("clients")
    .update({
      name: text(formData, "name"),
      phone: nullableText(formData, "phone"),
      email: nullableText(formData, "email"),
      notes: nullableText(formData, "notes")
    })
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(error);
  revalidatePath("/clients");
}

export async function deleteClientAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("clients").delete().eq("id", text(formData, "id")).eq("user_id", user.id);
  await assertOk(error);
  revalidatePath("/clients");
}

export async function createPaymentMethodAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("payment_methods").insert({
    user_id: user.id,
    type: text(formData, "type"),
    label: text(formData, "label"),
    instructions: text(formData, "instructions"),
    receiver_name: nullableText(formData, "receiver_name"),
    receiver_phone: nullableText(formData, "receiver_phone"),
    account_reference: nullableText(formData, "account_reference"),
    qr_image_path: nullableText(formData, "qr_image_path"),
    external_link: nullableText(formData, "external_link"),
    is_active: formData.get("is_active") === "on"
  });

  await assertOk(error);
  revalidatePath("/settings/payment-methods");
}

export async function updatePaymentMethodAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("payment_methods")
    .update({
      type: text(formData, "type"),
      label: text(formData, "label"),
      instructions: text(formData, "instructions"),
      receiver_name: nullableText(formData, "receiver_name"),
      receiver_phone: nullableText(formData, "receiver_phone"),
      account_reference: nullableText(formData, "account_reference"),
      qr_image_path: nullableText(formData, "qr_image_path"),
      external_link: nullableText(formData, "external_link"),
      is_active: formData.get("is_active") === "on"
    })
    .eq("id", text(formData, "id"))
    .eq("user_id", user.id);

  await assertOk(error);
  revalidatePath("/settings/payment-methods");
}

export async function setDefaultPaymentMethodAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");

  const { data: oldestMethod, error: oldestError } = await supabase
    .from("payment_methods")
    .select("created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  await assertOk(oldestError);

  const createdAt = oldestMethod?.created_at
    ? new Date(new Date(oldestMethod.created_at).getTime() - 1000).toISOString()
    : new Date().toISOString();

  const { error } = await supabase
    .from("payment_methods")
    .update({
      is_active: true,
      created_at: createdAt
    })
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(error);
  revalidatePath("/settings/payment-methods");
}

export async function deletePaymentMethodAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("payment_methods")
    .delete()
    .eq("id", text(formData, "id"))
    .eq("user_id", user.id);

  await assertOk(error);
  revalidatePath("/settings/payment-methods");
}

export async function createInvoiceAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const clientId = nullableText(formData, "client_id");

  if (clientId) {
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (clientError) {
      console.error("createInvoiceAction client lookup error", clientError);
      throw new Error(clientError.message);
    }

    if (!client) {
      throw new Error("Selected client was not found for your account.");
    }
  }

  const requestedInvoiceNumber = nullableText(formData, "invoice_number");
  const documentType = normalizeDocumentType(text(formData, "document_type"));
  const uniqueInvoiceNumber = await generateUniqueInvoiceNumber({
    supabase,
    userId: user.id,
    preferred: requestedInvoiceNumber,
    documentType
  });
  const amountUsd = nullableNumber(formData, "amount_usd");
  const amountLbp = nullableNumber(formData, "amount_lbp");
  const currency = text(formData, "currency") || "USD";
  const depositFields = documentType === "quote"
    ? disabledDepositFields()
    : buildDepositFields(formData, {
        amount_usd: amountUsd,
        amount_lbp: amountLbp,
        currency
      });

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: clientId,
      document_type: documentType,
      invoice_number: uniqueInvoiceNumber.invoiceNumber,
      title: text(formData, "title"),
      description: nullableText(formData, "description"),
      amount_usd: amountUsd,
      amount_lbp: amountLbp,
      currency,
      due_date: nullableText(formData, "due_date"),
      status: (text(formData, "status") || "draft") as InvoiceStatus,
      public_token: token(),
      approval_status: formData.get("require_approval") === "yes" ? "pending" : "not_required",
      valid_until: nullableText(formData, "valid_until"),
      exchange_rate_lbp_per_usd: nullableNumber(formData, "exchange_rate_lbp_per_usd"),
      rate_note: nullableText(formData, "rate_note"),
      ...depositFields
    })
    .select("id, user_id, public_token")
    .single();

  if (error) {
    console.error("createInvoiceAction invoice insert error", error);
    throw new Error(error.message);
  }

  await createInvoiceEvent({
    invoiceId: data.id,
    userId: user.id,
    eventType: documentType === "quote" ? "quote_created" : "invoice_created",
    message: documentType === "quote" ? "Quote created" : "Invoice created",
    metadata: uniqueInvoiceNumber.changed
      ? { invoice_number_adjusted: true, invoice_number: uniqueInvoiceNumber.invoiceNumber }
      : { invoice_number: uniqueInvoiceNumber.invoiceNumber }
  });

  if (depositFields.deposit_enabled) {
    await createInvoiceEvent({
      invoiceId: data.id,
      userId: user.id,
      eventType: "deposit_requested",
      message: "Deposit requested",
      metadata: depositEventMetadata(depositFields)
    });
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${data.id}`);
}

export async function updateInvoiceAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  const { data: beforeInvoice, error: beforeError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  await assertOk(beforeError);
  if (!beforeInvoice) {
    throw new Error("Invoice not found.");
  }

  const requestedInvoiceNumber = formData.has("invoice_number")
    ? nullableText(formData, "invoice_number")
    : beforeInvoice.invoice_number;
  const documentType = normalizeDocumentType(beforeInvoice.document_type);
  const uniqueInvoiceNumber = await generateUniqueInvoiceNumber({
    supabase,
    userId: user.id,
    preferred: requestedInvoiceNumber,
    excludeInvoiceId: id,
    documentType
  });

  const nextClientId = formData.has("client_id") ? nullableText(formData, "client_id") : beforeInvoice.client_id;
  const nextAmountUsd = formData.has("amount_usd") ? nullableNumber(formData, "amount_usd") : numberOrNull(beforeInvoice.amount_usd);
  const nextAmountLbp = formData.has("amount_lbp") ? nullableNumber(formData, "amount_lbp") : numberOrNull(beforeInvoice.amount_lbp);
  const nextCurrency = formData.has("currency") ? text(formData, "currency") || "USD" : beforeInvoice.currency || "USD";
  const shouldReadDeposit = [
    "deposit_enabled",
    "deposit_type",
    "deposit_percent",
    "deposit_amount_usd",
    "deposit_amount_lbp",
    "deposit_note"
  ].some((key) => formData.has(key));
  const depositFields = documentType === "quote"
    ? disabledDepositFields()
    : shouldReadDeposit
      ? buildDepositFields(formData, {
          amount_usd: nextAmountUsd,
          amount_lbp: nextAmountLbp,
          currency: nextCurrency
        })
    : {
        deposit_enabled: Boolean(beforeInvoice.deposit_enabled),
        deposit_type: beforeInvoice.deposit_type || null,
        deposit_percent: numberOrNull(beforeInvoice.deposit_percent),
        deposit_amount_usd: numberOrNull(beforeInvoice.deposit_amount_usd),
        deposit_amount_lbp: numberOrNull(beforeInvoice.deposit_amount_lbp),
        deposit_note: beforeInvoice.deposit_note || null
      };

  const { error } = await supabase
    .from("invoices")
    .update({
      client_id: nextClientId,
      invoice_number: uniqueInvoiceNumber.invoiceNumber,
      title: formData.has("title") ? text(formData, "title") : beforeInvoice.title,
      description: formData.has("description") ? nullableText(formData, "description") : beforeInvoice.description,
      amount_usd: nextAmountUsd,
      amount_lbp: nextAmountLbp,
      currency: nextCurrency,
      due_date: formData.has("due_date") ? nullableText(formData, "due_date") : beforeInvoice.due_date,
      status: (formData.has("status") ? text(formData, "status") : beforeInvoice.status) as InvoiceStatus,
      approval_status: formData.has("approval_status")
        ? text(formData, "approval_status") || "not_required"
        : beforeInvoice.approval_status || "not_required",
      valid_until: formData.has("valid_until") ? nullableText(formData, "valid_until") : beforeInvoice.valid_until,
      exchange_rate_lbp_per_usd: formData.has("exchange_rate_lbp_per_usd")
        ? nullableNumber(formData, "exchange_rate_lbp_per_usd")
        : numberOrNull(beforeInvoice.exchange_rate_lbp_per_usd),
      rate_note: formData.has("rate_note") ? nullableText(formData, "rate_note") : beforeInvoice.rate_note,
      ...depositFields
    })
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(error);

  await createInvoiceEvent({
    invoiceId: id,
    userId: user.id,
    eventType: "invoice_updated",
    message: "Invoice details updated",
    metadata: {
      client_link_changed: beforeInvoice?.client_id !== nextClientId,
      client_id_before: beforeInvoice?.client_id || null,
      client_id_after: nextClientId,
      invoice_number_before: beforeInvoice?.invoice_number || null,
      invoice_number_after: uniqueInvoiceNumber.invoiceNumber,
      invoice_number_adjusted: uniqueInvoiceNumber.changed
    }
  });

  if (beforeInvoice?.client_id !== nextClientId) {
    await createInvoiceEvent({
      invoiceId: id,
      userId: user.id,
      eventType: nextClientId ? "client_linked" : "client_unlinked",
      message: nextClientId ? "Client linked to invoice" : "Client unlinked from invoice",
      metadata: { client_id: nextClientId }
    });
  }

  if (depositConfigChanged(beforeInvoice, depositFields)) {
    const wasEnabled = Boolean(beforeInvoice.deposit_enabled);
    await createInvoiceEvent({
      invoiceId: id,
      userId: user.id,
      eventType: !wasEnabled && depositFields.deposit_enabled ? "deposit_requested" : "deposit_updated",
      message: !wasEnabled && depositFields.deposit_enabled ? "Deposit requested" : "Deposit updated",
      metadata: depositEventMetadata(depositFields)
    });

    if (depositFields.deposit_enabled) {
      const { data: depositProofs } = await supabase
        .from("payment_proofs")
        .select("status, amount_usd, amount_lbp")
        .eq("invoice_id", id);
      const nextInvoice = {
        ...beforeInvoice,
        amount_usd: nextAmountUsd,
        amount_lbp: nextAmountLbp,
        currency: nextCurrency,
        ...depositFields
      };

      if (getDepositRequest(nextInvoice) && didSatisfyDeposit(nextInvoice, [], depositProofs || [])) {
        await createInvoiceEvent({
          invoiceId: id,
          userId: user.id,
          eventType: "deposit_satisfied",
          message: "Deposit satisfied",
          metadata: depositEventMetadata(depositFields)
        });
      }
    }
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
}

export async function deleteInvoiceAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("invoices").delete().eq("id", text(formData, "id")).eq("user_id", user.id);
  await assertOk(error);
  revalidatePath("/invoices");
  redirect("/invoices");
}

export async function convertQuoteToInvoiceAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");

  const { data: quote, error: fetchError } = await supabase
    .from("invoices")
    .select("id, user_id, public_token, invoice_number, document_type")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  await assertOk(fetchError);
  if (!quote) {
    throw new Error("Quote not found.");
  }

  if (normalizeDocumentType(quote.document_type) !== "quote") {
    throw new Error("This document is already an invoice.");
  }

  const currentNumber = typeof quote.invoice_number === "string" ? quote.invoice_number : "";
  const shouldGenerateInvoiceNumber = currentNumber.toUpperCase().startsWith("QUO");
  const uniqueInvoiceNumber = shouldGenerateInvoiceNumber || !currentNumber
    ? await generateUniqueInvoiceNumber({
        supabase,
        userId: user.id,
        preferred: null,
        excludeInvoiceId: id,
        documentType: "invoice"
      })
    : { invoiceNumber: currentNumber, changed: false };

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      document_type: "invoice",
      invoice_number: uniqueInvoiceNumber.invoiceNumber
    })
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(updateError);

  await createInvoiceEvent({
    invoiceId: id,
    userId: user.id,
    eventType: "quote_converted",
    message: "Quote converted to invoice",
    metadata: {
      invoice_number: uniqueInvoiceNumber.invoiceNumber,
      public_token_preserved: Boolean(quote.public_token)
    }
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/pay/${quote.public_token}`);
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
}

export async function setInvoiceStatusAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  const { error } = await supabase
    .from("invoices")
    .update({ status: text(formData, "status") as InvoiceStatus })
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(error);
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/dashboard");
}

export async function reviewProofAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const proofId = text(formData, "proof_id");
  const invoiceId = text(formData, "invoice_id");
  const proofStatus = (text(formData, "status") || text(formData, "proof_status")) as "accepted" | "rejected";
  const requestedInvoiceStatus = (text(formData, "requested_invoice_status") || text(formData, "invoice_status")) as InvoiceStatus;

  const receiptToken = proofStatus === "accepted" ? crypto.randomUUID().replaceAll("-", "") : null;

  // Verify ownership of the invoice before updating anything
  const { data: invoice, error: invoiceCheckError } = await supabase
    .from("invoices")
    .select("id, amount_usd, amount_lbp, currency, status, document_type, deposit_enabled, deposit_type, deposit_percent, deposit_amount_usd, deposit_amount_lbp, deposit_note")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (invoiceCheckError || !invoice) {
    throw new Error("Invoice not found or you do not have permission to review this proof.");
  }

  if (normalizeDocumentType(invoice.document_type) === "quote") {
    throw new Error("Convert this quote to an invoice before reviewing payments.");
  }

  if (proofStatus !== "accepted" && proofStatus !== "rejected") {
    throw new Error("Choose whether to accept or reject this proof.");
  }

  // 1. Update the proof status
  const { data: proof, error: proofFetchError } = await supabase
    .from("payment_proofs")
    .select("*")
    .eq("id", proofId)
    .single();

  await assertOk(proofFetchError);
  if (!proof) throw new Error("Proof not found.");

  const { data: allProofs } = await supabase
    .from("payment_proofs")
    .select("id, status, amount_usd, amount_lbp")
    .eq("invoice_id", invoiceId);

  // Filter out the current proof from the calculation
  const otherProofs = (allProofs || []).filter(p => p.id !== proofId);
  const otherAcceptedProofs = otherProofs.filter(p => p.status === "accepted");
  const otherTotals = getAcceptedProofTotals(otherAcceptedProofs);

  const proofAmountUsd = Number(proof.amount_usd || 0);
  const proofAmountLbp = Number(proof.amount_lbp || 0);

  const estimatedTotalUsd = otherTotals.totalUsd + (proofStatus === "accepted" ? proofAmountUsd : 0);
  const estimatedTotalLbp = otherTotals.totalLbp + (proofStatus === "accepted" ? proofAmountLbp : 0);

  const currency = (invoice.currency || "USD").toUpperCase();

  // Safety check for Accept Full
  if (proofStatus === "accepted" && requestedInvoiceStatus === "paid") {
    // Only enforce if proof has some amount defined in the primary currency
    const hasPrimaryAmount = currency === "USD" ? (proof.amount_usd !== null) : (proof.amount_lbp !== null);
    const primaryInvoiceTotal = currency === "USD" ? Number(invoice.amount_usd || 0) : Number(invoice.amount_lbp || 0);

    if (!hasPrimaryAmount) {
      throw new Error("Add the paid amount before accepting this proof as full payment.");
    }

    if (primaryInvoiceTotal <= 0) {
      throw new Error(`Invoice total in ${currency} is required before accepting full payment.`);
    }

    const isActuallyPaid = currency === "USD" 
      ? (estimatedTotalUsd >= primaryInvoiceTotal)
      : (estimatedTotalLbp >= primaryInvoiceTotal);

    if (!isActuallyPaid) {
      throw new Error("This proof amount does not cover the remaining balance. Accept it as partial instead.");
    }
  }

  const { error: proofUpdateError } = await supabase
    .from("payment_proofs")
    .update({
      status: proofStatus,
      confirmed_at: proofStatus === "accepted" ? new Date().toISOString() : null,
      receipt_token: receiptToken
    })
    .eq("id", proofId)
    .eq("invoice_id", invoiceId);

  await assertOk(proofUpdateError);

  const oldStatus = invoice.status;

  // 2. Decide the final invoice status
  let finalInvoiceStatus = requestedInvoiceStatus || (invoice.status as InvoiceStatus);

  // If rejecting, we don't automatically change the invoice status to paid/partial
  // We keep the requested status (which is usually the current status)
  if (proofStatus === "accepted") {
    // Re-calculate totals for reconciliation regardless of requested status
    const { data: refreshedProofs } = await supabase
      .from("payment_proofs")
      .select("status, amount_usd, amount_lbp")
      .eq("invoice_id", invoiceId);

    finalInvoiceStatus = reconcileInvoiceStatus(invoice, refreshedProofs || []);

    if (requestedInvoiceStatus === "paid" && finalInvoiceStatus !== "paid") {
      throw new Error("Accepted payments do not cover the full invoice total yet. Accept this proof as partial instead.");
    }
  }

  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update({ status: finalInvoiceStatus })
    .eq("id", invoiceId)
    .eq("user_id", user.id);

  await assertOk(invoiceUpdateError);
  
  const isFullAccept = requestedInvoiceStatus === "paid" && proofStatus === "accepted";
  const hasPrimaryAmount = currency === "USD" ? (proof.amount_usd !== null) : (proof.amount_lbp !== null);

  await createInvoiceEvent({
    invoiceId,
    userId: user.id,
    eventType: proofStatus === "accepted" ? "proof_accepted" : "proof_rejected",
    message: proofStatus === "accepted" 
      ? `Payment proof accepted${isFullAccept ? " (Full)" : " (Partial)"}${isFullAccept && !hasPrimaryAmount ? " without submitted amount" : ""}`
      : `Payment proof rejected`,
    metadata: { proof_id: proofId, final_status: finalInvoiceStatus, receipt_token: receiptToken }
  });

  if (finalInvoiceStatus !== oldStatus) {
    await createInvoiceEvent({
      invoiceId,
      userId: user.id,
      eventType: `invoice_${finalInvoiceStatus}`,
      message: `Invoice marked ${finalInvoiceStatus}`
    });
  }

  if (proofStatus === "accepted") {
    const { data: refreshedProofs } = await supabase
      .from("payment_proofs")
      .select("status, amount_usd, amount_lbp")
      .eq("invoice_id", invoiceId);

    if (didSatisfyDeposit(invoice, otherAcceptedProofs, refreshedProofs || [])) {
      await createInvoiceEvent({
        invoiceId,
        userId: user.id,
        eventType: "deposit_satisfied",
        message: "Deposit satisfied",
        metadata: { proof_id: proofId, final_status: finalInvoiceStatus }
      });
    }
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/proofs");
}

export async function runAiProofVerificationAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  if (!isAiVerificationEnabled()) {
    throw new Error("AI verification is disabled. Set AI_VERIFICATION_ENABLED=true and GITHUB_MODELS_API_KEY.");
  }

  const proofId = text(formData, "proof_id");
  const invoiceId = text(formData, "invoice_id");

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (invErr || !invoice) {
    throw new Error("Invoice not found or you do not have permission.");
  }

  const { data: proof, error: pErr } = await supabase
    .from("payment_proofs")
    .select("*")
    .eq("id", proofId)
    .eq("invoice_id", invoiceId)
    .single();

  if (pErr || !proof) {
    throw new Error("Proof not found.");
  }

  if (proof.status !== "pending") {
    throw new Error("AI assist only runs on pending proofs.");
  }

  if (!proof.image_url) {
    throw new Error("This proof has no file attached.");
  }

  if (!isProofImageForAi(proof.image_url)) {
    throw new Error("AI screenshot assist only supports JPG, PNG, or WebP (not PDF).");
  }

  const fingerprint = proofImageFingerprint(proof.image_url, proof.uploaded_at);
  if (fingerprint === proof.ai_image_fingerprint && proof.ai_review_json) {
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/proofs");
    return { ok: true as const, cached: true as const };
  }

  let fetchUrl: string;
  if (proof.image_url.startsWith("http")) {
    fetchUrl = proof.image_url;
  } else {
    const { data: signed, error: signErr } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(proof.image_url, 300);
    if (signErr || !signed?.signedUrl) {
      throw new Error("Could not access proof image for analysis.");
    }
    fetchUrl = signed.signedUrl;
  }

  const imgRes = await fetch(fetchUrl);
  if (!imgRes.ok) {
    throw new Error("Could not download proof image.");
  }

  const arrayBuf = await imgRes.arrayBuffer();
  if (arrayBuf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds 5MB — AI assist is not run.");
  }

  const lowerPath = proof.image_url.toLowerCase();
  const mime = lowerPath.endsWith(".png")
    ? "image/png"
    : lowerPath.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  const base64DataUrl = `data:${mime};base64,${Buffer.from(arrayBuf).toString("base64")}`;

  const { extracted, model_notes, image_quality } = await callGithubGpt4oVision({ base64DataUrl });

  const { data: allProofs } = await supabase
    .from("payment_proofs")
    .select("status, amount_usd, amount_lbp")
    .eq("invoice_id", invoiceId);

  const balance = getRemainingBalance(invoice, allProofs || []);
  const primary = (invoice.currency || "USD").toUpperCase();

  const { warnings, queue_tag } = computeWarningsAndQueueTag({
    extracted,
    image_quality,
    model_notes,
    invoicePrimaryCurrency: primary,
    invoiceAmountUsd: Number(invoice.amount_usd || 0),
    invoiceAmountLbp: Number(invoice.amount_lbp || 0),
    remainingPrimary: balance.primaryBalance,
    proofAmountUsd: proof.amount_usd !== null && proof.amount_usd !== undefined ? Number(proof.amount_usd) : null,
    proofAmountLbp: proof.amount_lbp !== null && proof.amount_lbp !== undefined ? Number(proof.amount_lbp) : null
  });

  const stored: AiProofReviewStored = {
    version: 1,
    extracted,
    model_notes,
    image_quality,
    warnings,
    queue_tag
  };

  const summary = buildAiSummary(stored);

  const { error: upErr } = await supabase
    .from("payment_proofs")
    .update({
      ai_review_json: stored,
      ai_review_summary: summary,
      ai_analyzed_at: new Date().toISOString(),
      ai_image_fingerprint: fingerprint
    })
    .eq("id", proofId)
    .eq("invoice_id", invoiceId);

  await assertOk(upErr);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/proofs");
  return { ok: true as const, cached: false as const };
}

export async function saveReviewerDecisionNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const proofId = text(formData, "proof_id");
  const invoiceId = text(formData, "invoice_id");
  const note = nullableText(formData, "reviewer_decision_note");

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!invoice) {
    throw new Error("Invoice not found or you do not have permission.");
  }

  const { error } = await supabase
    .from("payment_proofs")
    .update({ reviewer_decision_note: note })
    .eq("id", proofId)
    .eq("invoice_id", invoiceId);

  await assertOk(error);
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/proofs");
}

export async function createManualPaymentAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const invoiceId = text(formData, "invoice_id");
  const amountUsd = nullableNumber(formData, "amount_usd");
  const amountLbp = nullableNumber(formData, "amount_lbp");
  const paymentDate = text(formData, "payment_date");
  const method = nullableText(formData, "method");
  const note = nullableText(formData, "note");
  const allowDuplicate = text(formData, "allow_duplicate") === "1";

  // Verify ownership and get invoice data
  const { data: invoice, error: invoiceCheckError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (invoiceCheckError || !invoice) {
    throw new Error("Invoice not found or you do not have permission to record a payment.");
  }

  if (normalizeDocumentType(invoice.document_type) === "quote") {
    throw new Error("Convert this quote to an invoice before recording payments.");
  }

  const { data: beforePaymentProofs } = await supabase
    .from("payment_proofs")
    .select("status, amount_usd, amount_lbp")
    .eq("invoice_id", invoiceId);

  const normalizedPaymentDate = isoDateOnly(paymentDate) || new Date().toISOString().slice(0, 10);
  const normalizedMethod = normalizeMethod(method);

  if (!allowDuplicate) {
    const { data: possibleDuplicates } = await supabase
      .from("payment_proofs")
      .select("id, status, amount_usd, amount_lbp, payment_date, method")
      .eq("invoice_id", invoiceId)
      .in("status", ["accepted", "pending"]);

    const isDuplicate = (possibleDuplicates || []).some((p: any) => {
      const sameDate = isoDateOnly(p.payment_date) && isoDateOnly(p.payment_date) === normalizedPaymentDate;
      const sameMethod = normalizeMethod(p.method) && normalizeMethod(p.method) === normalizedMethod;
      const sameUsd = amountUsd !== null && p.amount_usd !== null && Number(p.amount_usd) === Number(amountUsd);
      const sameLbp = amountLbp !== null && p.amount_lbp !== null && Number(p.amount_lbp) === Number(amountLbp);
      const hasAmountMatch = sameUsd || sameLbp;
      return Boolean(sameDate && sameMethod && hasAmountMatch);
    });

    if (isDuplicate) {
      throw new Error("This looks like a duplicate payment (same amount/date/method). Confirm to record it anyway.");
    }
  }

  // 2. Create the accepted payment record
  const receiptToken = crypto.randomUUID().replaceAll("-", "");
  const { error: proofError } = await supabase.from("payment_proofs").insert({
    invoice_id: invoiceId,
    user_id: user.id,
    amount_usd: amountUsd,
    amount_lbp: amountLbp,
    payment_date: normalizedPaymentDate,
    method,
    note,
    status: "accepted",
    confirmed_at: new Date().toISOString(),
    image_url: null, // Manual payment has no image unless we add it later
    receipt_token: receiptToken
  });

  await assertOk(proofError);

  const oldStatus = invoice.status;

  // 3. Recalculate invoice status
  const { data: allProofs } = await supabase
    .from("payment_proofs")
    .select("status, amount_usd, amount_lbp")
    .eq("invoice_id", invoiceId);

  const finalStatus = reconcileInvoiceStatus(invoice, allProofs || []);

  const { error: invoiceUpdateError } = await supabase
    .from("invoices")
    .update({ status: finalStatus })
    .eq("id", invoiceId)
    .eq("user_id", user.id);

  await assertOk(invoiceUpdateError);

  await createInvoiceEvent({
    invoiceId,
    userId: user.id,
    eventType: "manual_payment",
    message: `Manual payment recorded: ${amountUsd ? "$" + amountUsd : ""}${amountUsd && amountLbp ? " + " : ""}${amountLbp ? amountLbp + " LBP" : ""}`,
    metadata: { amount_usd: amountUsd, amount_lbp: amountLbp, method, receipt_token: receiptToken }
  });

  if (finalStatus !== oldStatus) {
    await createInvoiceEvent({
      invoiceId,
      userId: user.id,
      eventType: `invoice_${finalStatus}`,
      message: `Invoice marked ${finalStatus}`
    });
  }

  if (didSatisfyDeposit(invoice, beforePaymentProofs || [], allProofs || [])) {
    await createInvoiceEvent({
      invoiceId,
      userId: user.id,
      eventType: "deposit_satisfied",
      message: "Deposit satisfied",
      metadata: { amount_usd: amountUsd, amount_lbp: amountLbp, method }
    });
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/dashboard");
}

export async function approveInvoiceByTokenAction(formData: FormData) {
  const supabase = await createClient();
  const publicToken = text(formData, "token");
  const approvedByName = text(formData, "name");
  const approvedNote = nullableText(formData, "note");

  const { data, error: rpcError } = await supabase.rpc("approve_invoice_by_token", {
    p_token: publicToken,
    p_approved_by_name: approvedByName,
    p_approved_note: approvedNote
  });

  if (rpcError) throw new Error(rpcError.message);
  if (data && !data.success) throw new Error(data.message);

  // Get invoice owner to record event
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, user_id, document_type")
    .eq("public_token", publicToken)
    .single();

  if (invoice) {
    const noun = normalizeDocumentType(invoice.document_type) === "quote" ? "Quote" : "Invoice";
    await createInvoiceEvent({
      invoiceId: invoice.id,
      userId: invoice.user_id,
      eventType: "client_approved",
      message: `${noun} approved by ${approvedByName}`,
      metadata: { client_name: approvedByName, note: approvedNote }
    });
  }

  revalidatePath(`/pay/${publicToken}`);
}

export async function rejectInvoiceByTokenAction(formData: FormData) {
  const supabase = await createClient();
  const publicToken = text(formData, "token");
  const approvedByName = text(formData, "name");
  const approvedNote = nullableText(formData, "note");

  const { data, error: rpcError } = await supabase.rpc("reject_invoice_by_token", {
    p_token: publicToken,
    p_approved_by_name: approvedByName,
    p_approved_note: approvedNote
  });

  if (rpcError) throw new Error(rpcError.message);
  if (data && !data.success) throw new Error(data.message);

  // Get invoice owner to record event
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, user_id, document_type")
    .eq("public_token", publicToken)
    .single();

  if (invoice) {
    const noun = normalizeDocumentType(invoice.document_type) === "quote" ? "Quote" : "Invoice";
    await createInvoiceEvent({
      invoiceId: invoice.id,
      userId: invoice.user_id,
      eventType: "client_rejected",
      message: `${noun} rejected by ${approvedByName}`,
      metadata: { client_name: approvedByName, note: approvedNote }
    });
  }

  revalidatePath(`/pay/${publicToken}`);
}

export async function createServicePresetAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  
  const { error } = await supabase.from("service_presets").insert({
    user_id: user.id,
    name: text(formData, "name"),
    description: nullableText(formData, "description"),
    amount_usd: nullableNumber(formData, "amount_usd"),
    amount_lbp: nullableNumber(formData, "amount_lbp"),
    currency: text(formData, "currency") || "USD",
    default_validity_days: nullableNumber(formData, "default_validity_days")
  });

  await assertOk(error);
  revalidatePath("/settings/service-presets");
}

export async function updateServicePresetAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");

  const { error } = await supabase
    .from("service_presets")
    .update({
      name: text(formData, "name"),
      description: nullableText(formData, "description"),
      amount_usd: nullableNumber(formData, "amount_usd"),
      amount_lbp: nullableNumber(formData, "amount_lbp"),
      currency: text(formData, "currency") || "USD",
      default_validity_days: nullableNumber(formData, "default_validity_days")
    })
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(error);
  revalidatePath("/settings/service-presets");
}

export async function deleteServicePresetAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");

  const { error } = await supabase
    .from("service_presets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(error);
  revalidatePath("/settings/service-presets");
}

export async function uploadProofAction(formData: FormData) {
  const supabase = await createClient();
  const publicToken = text(formData, "token");
  const file = formData.get("proof");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please upload a screenshot or receipt.");
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Please upload a JPG, PNG, WebP, or PDF file.");
  }

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error("File is too large. Maximum size is 5MB.");
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, user_id, status, valid_until, document_type")
    .eq("public_token", publicToken)
    .single();

  await assertOk(invoiceError);
  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  if (normalizeDocumentType(invoice.document_type) === "quote") {
    throw new Error("This is a quote, not a payment request yet.");
  }

  if (invoice.valid_until && invoice.status !== "paid") {
    const validUntil = new Date(invoice.valid_until);
    if (!Number.isNaN(validUntil.getTime()) && validUntil < new Date()) {
      throw new Error("This invoice has expired. Please contact the business.");
    }
  }

  const normalizedPaymentDate = isoDateOnly(formData.get("payment_date")) || null;
  const normalizedMethod = normalizeMethod(formData.get("method"));
  const amountUsd = nullableNumber(formData, "amount_usd");
  const amountLbp = nullableNumber(formData, "amount_lbp");

  if (normalizedPaymentDate && normalizedMethod && (amountUsd !== null || amountLbp !== null)) {
    const { data: possibleDuplicates } = await supabase
      .from("payment_proofs")
      .select("id, status, amount_usd, amount_lbp, payment_date, method")
      .eq("invoice_id", invoice.id)
      .in("status", ["pending", "accepted"]);

    const isDuplicate = (possibleDuplicates || []).some((p: any) => {
      const sameDate = isoDateOnly(p.payment_date) && isoDateOnly(p.payment_date) === normalizedPaymentDate;
      const sameMethod = normalizeMethod(p.method) && normalizeMethod(p.method) === normalizedMethod;
      const sameUsd = amountUsd !== null && p.amount_usd !== null && Number(p.amount_usd) === Number(amountUsd);
      const sameLbp = amountLbp !== null && p.amount_lbp !== null && Number(p.amount_lbp) === Number(amountLbp);
      const hasAmountMatch = sameUsd || sameLbp;
      return Boolean(sameDate && sameMethod && hasAmountMatch);
    });

    if (isDuplicate) {
      throw new Error("This payment looks like a duplicate (same amount/date/method). If this is a different payment, adjust the details and try again.");
    }
  }

  const extension = file.name.split(".").pop() || "png";
  const path = `${invoice.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("payment-proofs").upload(path, await file.arrayBuffer(), {
    contentType: file.type || "image/png"
  });

  await assertOk(uploadError);

  const { error: proofError } = await supabase.from("payment_proofs").insert({
    invoice_id: invoice.id,
    method: nullableText(formData, "method"),
    image_url: path, // Save the path instead of public URL
    note: nullableText(formData, "note"),
    status: "pending",
    amount_usd: amountUsd,
    amount_lbp: amountLbp,
    payment_date: nullableText(formData, "payment_date")
  });

  await assertOk(proofError);

  await createInvoiceEvent({
    invoiceId: invoice.id,
    userId: invoice.user_id,
    eventType: "proof_uploaded",
    message: "Payment proof uploaded by client",
    metadata: { method: formData.get("method") }
  });

  revalidatePath(`/pay/${publicToken}`);
  redirect(`/pay/${publicToken}?uploaded=1`);
}

export async function voidPaymentAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const proofId = text(formData, "proof_id");
  const reason = nullableText(formData, "reason");

  // 1. Verify ownership and state
  const { data: proof, error: proofError } = await supabase
    .from("payment_proofs")
    .select("*, invoices(user_id, status)")
    .eq("id", proofId)
    .single();

  if (proofError || !proof || (proof.invoices as any).user_id !== user.id) {
    throw new Error("Payment record not found or access denied.");
  }

  if (proof.status !== "accepted") {
    throw new Error("Only accepted payments can be voided.");
  }

  const invoiceId = proof.invoice_id;

  // 2. Void the proof
  const { error: voidError } = await supabase
    .from("payment_proofs")
    .update({
      status: "voided",
      voided_at: new Date().toISOString(),
      void_reason: reason
    })
    .eq("id", proofId);

  await assertOk(voidError);

  // 3. Recalculate invoice status
  const { data: refreshedProofs } = await supabase
    .from("payment_proofs")
    .select("status, amount_usd, amount_lbp")
    .eq("invoice_id", invoiceId);

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  const finalStatus = reconcileInvoiceStatus(invoice, refreshedProofs || []);

  await supabase
    .from("invoices")
    .update({ status: finalStatus })
    .eq("id", invoiceId);

  // 4. Activity event
  await createInvoiceEvent({
    invoiceId,
    userId: user.id,
    eventType: "payment_voided",
    message: `Payment voided: ${proof.amount_usd ? "$" + proof.amount_usd : ""}${proof.amount_usd && proof.amount_lbp ? " + " : ""}${proof.amount_lbp ? proof.amount_lbp + " LBP" : ""}${reason ? " (Reason: " + reason + ")" : ""}`,
    metadata: { 
      proof_id: proofId, 
      amount_usd: proof.amount_usd, 
      amount_lbp: proof.amount_lbp, 
      reason 
    }
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/proofs");
}

export async function duplicateInvoiceAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !invoice) {
    throw new Error("Invoice not found or you do not have permission to duplicate it.");
  }

  const documentType = normalizeDocumentType(invoice.document_type);
  const uniqueInvoiceNumber = await generateUniqueInvoiceNumber({
    supabase,
    userId: user.id,
    preferred: null,
    documentType
  });

  const { data: newInvoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: invoice.client_id,
      document_type: documentType,
      title: invoice.title,
      description: invoice.description,
      amount_usd: invoice.amount_usd,
      amount_lbp: invoice.amount_lbp,
      currency: invoice.currency,
      deposit_enabled: documentType === "quote" ? false : invoice.deposit_enabled,
      deposit_type: documentType === "quote" ? null : invoice.deposit_type,
      deposit_percent: documentType === "quote" ? null : invoice.deposit_percent,
      deposit_amount_usd: documentType === "quote" ? null : invoice.deposit_amount_usd,
      deposit_amount_lbp: documentType === "quote" ? null : invoice.deposit_amount_lbp,
      deposit_note: documentType === "quote" ? null : invoice.deposit_note,
      status: "draft",
      invoice_number: uniqueInvoiceNumber.invoiceNumber,
      public_token: token(),
      due_date: null
    })
    .select("id")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${newInvoice.id}`);
}

export async function recordReminderEventAction(invoiceId: string, stage: string, channel: string) {
  const { supabase, user } = await requireUser();
  
  // Verify ownership
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single();

  if (!invoice) throw new Error("Invoice not found");

  await createInvoiceEvent({
    invoiceId,
    userId: user.id,
    eventType: "reminder_copied",
    message: `Reminder copied (${channel})`,
    metadata: { 
      stage, 
      channel,
      timestamp: new Date().toISOString()
    }
  });

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/recoveries");
}

export async function extendInvoiceValidityAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  const days = nullableNumber(formData, "days");
  const customDate = nullableText(formData, "custom_date");

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !invoice) {
    throw new Error("Invoice not found or access denied.");
  }

  let newValidUntil: string;

  if (customDate) {
    newValidUntil = customDate;
  } else if (days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    newValidUntil = date.toISOString().split("T")[0];
  } else {
    throw new Error("Please specify extension days or a custom date.");
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ 
      valid_until: newValidUntil,
      // If we are extending, we implicitly want the status to be re-evaluated
      // but status itself doesn't change here, only the "isExpired" check in UI
    })
    .eq("id", id);

  await assertOk(updateError);

  await createInvoiceEvent({
    invoiceId: id,
    userId: user.id,
    eventType: "payment_link_extended",
    message: `Payment link extended until ${shortDate(newValidUntil)}`,
    metadata: {
      old_valid_until: invoice.valid_until,
      new_valid_until: newValidUntil,
      extension_days: days
    }
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/pay/${invoice.public_token}`);
  revalidatePath("/recoveries");
}

export async function regenerateInvoicePublicTokenAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "invoice_id");

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("id, user_id, public_token")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  await assertOk(fetchError);
  if (!invoice) {
    throw new Error("Invoice not found or access denied.");
  }

  const previousToken = invoice.public_token;
  const nextToken = token();

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ public_token: nextToken })
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(updateError);

  await createInvoiceEvent({
    invoiceId: id,
    userId: user.id,
    eventType: "pay_link_regenerated",
    message: "Public payment link token regenerated (old links stop working).",
    metadata: { previous_token_suffix: previousToken?.slice(-8) ?? null }
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  if (previousToken) {
    revalidatePath(`/pay/${previousToken}`);
  }
  revalidatePath(`/pay/${nextToken}`);

  revalidatePath("/recoveries");
  redirect(`/invoices/${id}`);
}

export async function saveInvoicePaymentPlanAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "invoice_id");
  const raw = text(formData, "plan_json");
  if (!id || !raw) throw new Error("Missing plan data.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid plan data.");
  }
  const plan = parsePaymentPlan(parsed);
  if (!plan) throw new Error("Add at least one milestone with an amount.");

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, public_token, currency, amount_usd, amount_lbp, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  await assertOk(invErr);
  if (!invoice) throw new Error("Invoice not found.");

  const { data: proofRows, error: prErr } = await supabase
    .from("payment_proofs")
    .select("status, amount_usd, amount_lbp")
    .eq("invoice_id", id);
  await assertOk(prErr);

  const remaining = getRemainingBalance(invoice as never, proofRows || []);
  const primary = (invoice.currency || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
  const totalPlan = plan.milestones.reduce((sum, m) => {
    const v = primary === "USD" ? Number(m.amount_usd || 0) : Number(m.amount_lbp || 0);
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const rem = primary === "USD" ? remaining.usd : remaining.lbp;
  const tol = primary === "USD" ? 0.05 : 500;
  if (totalPlan - rem > tol) {
    throw new Error("Milestone total cannot exceed the remaining balance.");
  }

  const { error: upErr } = await supabase
    .from("invoices")
    .update({ payment_plan: plan as never })
    .eq("id", id)
    .eq("user_id", user.id);
  await assertOk(upErr);

  await createInvoiceEvent({
    invoiceId: id,
    userId: user.id,
    eventType: "payment_plan_saved",
    message: "Manual payment plan saved (milestones only; not recurring billing).",
    metadata: { milestone_count: plan.milestones.length }
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/recoveries");
  if (invoice.public_token) revalidatePath(`/pay/${invoice.public_token}`);
}

export async function clearInvoicePaymentPlanAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "invoice_id");
  if (!id) throw new Error("Missing invoice.");

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, public_token")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  await assertOk(invErr);
  if (!invoice) throw new Error("Invoice not found.");

  const { error } = await supabase
    .from("invoices")
    .update({ payment_plan: null })
    .eq("id", id)
    .eq("user_id", user.id);
  await assertOk(error);

  await createInvoiceEvent({
    invoiceId: id,
    userId: user.id,
    eventType: "payment_plan_cleared",
    message: "Payment plan cleared.",
    metadata: {}
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/recoveries");
  if (invoice.public_token) revalidatePath(`/pay/${invoice.public_token}`);
}

export async function setPaymentPlanMilestoneSatisfiedAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "invoice_id");
  const mid = text(formData, "milestone_id");
  const satisfied = text(formData, "satisfied") === "1";
  if (!id || !mid) throw new Error("Missing milestone.");

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, public_token, payment_plan, currency")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  await assertOk(invErr);
  if (!invoice) throw new Error("Invoice not found.");

  const plan = parsePaymentPlan(invoice.payment_plan);
  if (!plan) throw new Error("No payment plan on file.");

  const next = {
    ...plan,
    milestones: plan.milestones.map((m) =>
      m.id === mid ? { ...m, satisfied_at: satisfied ? new Date().toISOString() : null } : m
    )
  };

  const { error } = await supabase
    .from("invoices")
    .update({ payment_plan: next as never })
    .eq("id", id)
    .eq("user_id", user.id);
  await assertOk(error);

  await createInvoiceEvent({
    invoiceId: id,
    userId: user.id,
    eventType: "payment_plan_milestone_updated",
    message: satisfied ? "Marked installment as received." : "Cleared installment received flag.",
    metadata: { milestone_id: mid }
  });

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/recoveries");
  if (invoice.public_token) revalidatePath(`/pay/${invoice.public_token}`);
}

const SHARED_REPORT_TYPES = new Set([
  "monthly_collections",
  "overdue_summary",
  "client_payment_history",
  "proof_review_summary",
  "recovery_progress",
  "payment_summary",
  "invoice_summary"
]);

function safeJsonObject(raw: string) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function createSharedReportAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const reportType = text(formData, "report_type") || "monthly_collections";
  if (!SHARED_REPORT_TYPES.has(reportType)) {
    throw new Error("Unsupported report type.");
  }

  const expiresDays = nullableNumber(formData, "expires_days");
  const expiresAt =
    expiresDays && expiresDays > 0
      ? new Date(Date.now() + Math.min(90, expiresDays) * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const title = text(formData, "title") || "Shared business report";
  const filters = safeJsonObject(text(formData, "filters_json")) as Record<string, unknown>;
  const from = nullableText(formData, "from");
  const to = nullableText(formData, "to");
  const month = nullableText(formData, "month");
  if (from) filters.from = from;
  if (to) filters.to = to;
  if (month) filters.month = month;

  const { error } = await supabase.from("shared_reports").insert({
    user_id: user.id,
    token: token(),
    report_type: reportType,
    title,
    description: nullableText(formData, "description"),
    filters,
    expires_at: expiresAt
  });

  await assertOk(error);
  revalidatePath("/connectivity");
  revalidatePath("/export");
}

export async function revokeSharedReportAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "share_id");
  const { error } = await supabase
    .from("shared_reports")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  await assertOk(error);
  revalidatePath("/connectivity");
  revalidatePath("/export");
}

type ImportRow = Record<string, unknown>;

function parseImportRows(formData: FormData) {
  const raw = text(formData, "rows_json");
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Import rows are not valid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("Import rows must be an array.");
  return parsed.slice(0, 100).filter((row): row is ImportRow => Boolean(row && typeof row === "object" && !Array.isArray(row)));
}

function importCell(row: ImportRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()] ?? row[key.replaceAll(" ", "_")];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function importNumberCell(row: ImportRow, keys: string[]) {
  const raw = importCell(row, keys).replaceAll(",", "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function importDateCell(row: ImportRow, keys: string[]) {
  const raw = importCell(row, keys);
  if (!raw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export async function importConnectivityCsvAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const mode = text(formData, "import_mode");
  const rows = parseImportRows(formData);

  if (!rows.length) {
    throw new Error("No valid rows to import.");
  }

  if (mode === "clients") {
    const { data: existing } = await supabase.from("clients").select("name").eq("user_id", user.id);
    const existingNames = new Set((existing || []).map((row: { name?: string | null }) => (row.name || "").trim().toLowerCase()).filter(Boolean));
    const inserts = rows
      .map((row) => ({
        user_id: user.id,
        name: importCell(row, ["name", "client", "client name"]),
        email: importCell(row, ["email"]) || null,
        phone: importCell(row, ["phone", "mobile", "whatsapp"]) || null,
        notes: importCell(row, ["notes", "note"]) || null,
        client_portal_token: portalToken()
      }))
      .filter((row) => row.name && !existingNames.has(row.name.toLowerCase()));

    if (!inserts.length) {
      throw new Error("No new clients to import. Existing names are skipped to avoid overwrites.");
    }

    const { error } = await supabase.from("clients").insert(inserts);
    await assertOk(error);
    revalidatePath("/clients");
    revalidatePath("/connectivity");
    return;
  }

  if (mode === "invoices") {
    const { data: clients } = await supabase.from("clients").select("id, name").eq("user_id", user.id);
    const clientByName = new Map((clients || []).map((client: { id: string; name?: string | null }) => [(client.name || "").trim().toLowerCase(), client.id]));
    const inserts = rows
      .map((row) => {
        const currency = (importCell(row, ["currency"]) || "USD").toUpperCase() === "LBP" ? "LBP" : "USD";
        const documentType = importCell(row, ["document_type", "type"]).toLowerCase() === "quote" ? "quote" : "invoice";
        const clientName = importCell(row, ["client", "client name", "client_name"]).toLowerCase();
        return {
          user_id: user.id,
          client_id: clientByName.get(clientName) || null,
          document_type: documentType,
          invoice_number: invoiceNumber(documentType),
          title: importCell(row, ["title", "invoice title", "description"]) || "Imported draft",
          description: importCell(row, ["description", "notes", "note"]) || null,
          amount_usd: importNumberCell(row, ["amount_usd", "amount usd", "usd"]),
          amount_lbp: importNumberCell(row, ["amount_lbp", "amount lbp", "lbp"]),
          currency,
          due_date: importDateCell(row, ["due_date", "due date"]),
          status: "draft" as InvoiceStatus,
          public_token: token(),
          approval_status: "not_required"
        };
      })
      .filter((row) => row.title && (row.amount_usd || row.amount_lbp));

    if (!inserts.length) {
      throw new Error("No invoice drafts to import. Add a title and at least one amount column.");
    }

    const { error } = await supabase.from("invoices").insert(inserts);
    await assertOk(error);
    revalidatePath("/invoices");
    revalidatePath("/connectivity");
    return;
  }

  throw new Error("Choose a supported import mode.");
}
