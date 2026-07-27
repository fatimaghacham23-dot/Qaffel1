import { normalizeDocumentType } from "@/lib/documents";
import { invoiceStatuses, type DocumentType, type InvoiceStatus } from "@/lib/types";

export type InvoiceCreatorField =
  | "client_id"
  | "document_type"
  | "invoice_number"
  | "title"
  | "description"
  | "amount_usd"
  | "amount_lbp"
  | "currency"
  | "due_date"
  | "status"
  | "require_approval"
  | "valid_until"
  | "exchange_rate_lbp_per_usd"
  | "rate_note"
  | "deposit_type"
  | "deposit_percent"
  | "deposit_amount_usd"
  | "deposit_amount_lbp"
  | "deposit_note";

export type InvoiceCreatorFieldErrors = Partial<Record<InvoiceCreatorField, string>>;

export type InvoiceCreatorValues = {
  amountLbp: number | null;
  amountUsd: number | null;
  clientId: string | null;
  currency: "USD" | "LBP";
  description: string | null;
  documentType: DocumentType;
  dueDate: string | null;
  exchangeRateLbpPerUsd: number | null;
  rateNote: string | null;
  requireApproval: boolean;
  requestedInvoiceNumber: string | null;
  status: InvoiceStatus;
  title: string;
  validUntil: string | null;
};

export type InvoiceCreatorValidationResult =
  | {
      ok: true;
      values: InvoiceCreatorValues;
    }
  | {
      ok: false;
      fieldErrors: InvoiceCreatorFieldErrors;
      message: string;
    };

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

function isValidDateOnly(value: string | null) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function isValidDateTimeLocal(value: string | null) {
  if (!value) return true;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
}

function addNumberError(
  fieldErrors: InvoiceCreatorFieldErrors,
  formData: FormData,
  field: "amount_usd" | "amount_lbp" | "exchange_rate_lbp_per_usd",
  label: string
) {
  const raw = text(formData, field);
  const value = nullableNumber(formData, field);
  if (raw && value === null) {
    fieldErrors[field] = `${label} must be a valid number.`;
  } else if (value !== null && value < 0) {
    fieldErrors[field] = `${label} cannot be negative.`;
  }
  return value;
}

function firstErrorMessage(fieldErrors: InvoiceCreatorFieldErrors) {
  return Object.values(fieldErrors)[0] || "Fix the highlighted fields before creating the document.";
}

export function validateInvoiceCreatorForm(formData: FormData): InvoiceCreatorValidationResult {
  const fieldErrors: InvoiceCreatorFieldErrors = {};
  const title = text(formData, "title");
  const rawDocumentType = text(formData, "document_type");
  const rawCurrency = text(formData, "currency").toUpperCase();
  const rawStatus = text(formData, "status");

  if (!title) {
    fieldErrors.title = "Title is required.";
  }

  if (rawDocumentType && rawDocumentType !== "invoice" && rawDocumentType !== "quote") {
    fieldErrors.document_type = "Document type must be invoice or quote.";
  }

  const currency = rawCurrency === "LBP" ? "LBP" : rawCurrency === "USD" || rawCurrency === "" ? "USD" : null;
  if (!currency) {
    fieldErrors.currency = "Currency must be USD or LBP.";
  }

  const amountUsd = addNumberError(fieldErrors, formData, "amount_usd", "Amount USD");
  const amountLbp = addNumberError(fieldErrors, formData, "amount_lbp", "Amount LBP");
  const exchangeRateLbpPerUsd = addNumberError(fieldErrors, formData, "exchange_rate_lbp_per_usd", "Exchange rate");

  if (exchangeRateLbpPerUsd !== null && exchangeRateLbpPerUsd <= 0) {
    fieldErrors.exchange_rate_lbp_per_usd = "Exchange rate must be greater than 0.";
  }

  if (currency === "USD" && (amountUsd === null || amountUsd <= 0)) {
    fieldErrors.amount_usd = "Enter an amount in USD greater than 0.";
  }

  if (currency === "LBP" && (amountLbp === null || amountLbp <= 0)) {
    fieldErrors.amount_lbp = "Enter an amount in LBP greater than 0.";
  }

  const status = invoiceStatuses.includes(rawStatus as InvoiceStatus) ? (rawStatus as InvoiceStatus) : null;
  if (!status) {
    fieldErrors.status = "Choose a valid document status.";
  }

  const dueDate = nullableText(formData, "due_date");
  if (!isValidDateOnly(dueDate)) {
    fieldErrors.due_date = "Due date must be a valid date.";
  }

  const validUntil = nullableText(formData, "valid_until");
  if (!isValidDateTimeLocal(validUntil)) {
    fieldErrors.valid_until = "Valid until must be a valid date and time.";
  }

  const documentType = normalizeDocumentType(rawDocumentType);
  const depositEnabled = documentType === "quote" ? false : formDataBoolean(formData, "deposit_enabled");

  if (depositEnabled && currency) {
    const primaryAmount = currency === "USD" ? amountUsd : amountLbp;
    if (primaryAmount === null || primaryAmount <= 0) {
      fieldErrors[currency === "USD" ? "amount_usd" : "amount_lbp"] = `Enter an invoice total in ${currency} before requesting a deposit.`;
    }

    const depositType = text(formData, "deposit_type") || "percent";
    if (depositType !== "percent" && depositType !== "fixed") {
      fieldErrors.deposit_type = "Deposit type must be percent or fixed.";
    }

    if (depositType === "percent") {
      const percent = nullableNumber(formData, "deposit_percent");
      if (percent === null || percent <= 0 || percent > 100) {
        fieldErrors.deposit_percent = "Deposit percent must be greater than 0 and no more than 100.";
      }
    }

    if (depositType === "fixed") {
      const amountField = currency === "USD" ? "deposit_amount_usd" : "deposit_amount_lbp";
      const fixedAmount = nullableNumber(formData, amountField);
      if (fixedAmount === null || fixedAmount <= 0) {
        fieldErrors[amountField] = `Fixed deposit amount must be greater than 0 in ${currency}.`;
      } else if (primaryAmount !== null && fixedAmount > primaryAmount) {
        fieldErrors[amountField] = `Fixed deposit amount cannot exceed the invoice total in ${currency}.`;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0 || !currency || !status) {
    return {
      ok: false,
      fieldErrors,
      message: firstErrorMessage(fieldErrors)
    };
  }

  return {
    ok: true,
    values: {
      amountLbp,
      amountUsd,
      clientId: nullableText(formData, "client_id"),
      currency,
      description: nullableText(formData, "description"),
      documentType,
      dueDate,
      exchangeRateLbpPerUsd,
      rateNote: nullableText(formData, "rate_note"),
      requireApproval: text(formData, "require_approval") === "yes",
      requestedInvoiceNumber: nullableText(formData, "invoice_number"),
      status,
      title,
      validUntil
    }
  };
}
