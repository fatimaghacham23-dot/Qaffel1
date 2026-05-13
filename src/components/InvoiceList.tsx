"use client";

import {
  InteractiveInvoicesTable,
  type InvoiceTableInvoice
} from "@/components/InteractiveInvoicesTable";
import type { InvoiceStatus } from "@/lib/types";

export type InvoiceListInvoice = InvoiceTableInvoice;

interface InvoiceListProps {
  initialInvoices: InvoiceListInvoice[];
  invoiceStatuses: InvoiceStatus[];
}

export function InvoiceList({ initialInvoices, invoiceStatuses }: InvoiceListProps) {
  return <InteractiveInvoicesTable initialInvoices={initialInvoices} invoiceStatuses={invoiceStatuses} />;
}
