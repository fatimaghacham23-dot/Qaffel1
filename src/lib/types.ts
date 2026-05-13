export type DocumentType = "invoice" | "quote";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue"
  | "rejected";

export type ProofStatus = "pending" | "accepted" | "rejected";

export const invoiceStatuses: InvoiceStatus[] = [
  "draft",
  "sent",
  "unpaid",
  "partial",
  "paid",
  "overdue",
  "rejected"
];

export const proofStatuses: ProofStatus[] = ["pending", "accepted", "rejected"];

export const documentTypes: DocumentType[] = ["invoice", "quote"];
