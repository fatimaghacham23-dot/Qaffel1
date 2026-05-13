import { getDisplayInvoiceStatus } from "./status";
import type { DocumentType, InvoiceStatus } from "./types";

export function normalizeDocumentType(value: unknown): DocumentType {
  return typeof value === "string" && value.toLowerCase() === "quote" ? "quote" : "invoice";
}

export function isQuoteDocument(document: { document_type?: string | null }) {
  return normalizeDocumentType(document.document_type) === "quote";
}

export function documentNoun(document: { document_type?: string | null }) {
  return isQuoteDocument(document) ? "quote" : "invoice";
}

export function documentNounTitle(document: { document_type?: string | null }) {
  return isQuoteDocument(document) ? "Quote" : "Invoice";
}

export function documentStatus(document: {
  approval_status?: string | null;
  document_type?: string | null;
  due_date?: string | null;
  status: InvoiceStatus;
  valid_until?: string | null;
}) {
  if (!isQuoteDocument(document)) {
    return getDisplayInvoiceStatus(document);
  }

  if (document.approval_status === "approved") return "approved";
  if (document.approval_status === "rejected") return "rejected";

  const expiresAt = document.valid_until || document.due_date;
  if (expiresAt) {
    const date = new Date(expiresAt);
    if (!Number.isNaN(date.getTime()) && date < new Date()) return "expired";
  }

  return "quote";
}
