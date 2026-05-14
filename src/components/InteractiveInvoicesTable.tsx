"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Printer,
  Search,
  X
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { setInvoiceStatusAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { InvoicePriorityBadges } from "@/components/InvoicePriorityBadges";
import { documentNounTitle, documentStatus, isQuoteDocument } from "@/lib/documents";
import { money, shortDate } from "@/lib/format";
import { getFriendlyLifecycleLabel, getInvoicePriorityFlags } from "@/lib/operations";
import { getDisplayInvoiceStatus, reconcileInvoiceStatus } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/types";

export type InvoiceTableInvoice = {
  id: string;
  invoice_number?: string | null;
  title?: string | null;
  clients?: {
    name?: string | null;
  } | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  currency?: string | null;
  created_at?: string | null;
  document_type?: string | null;
  due_date?: string | null;
  approval_status?: string | null;
  public_token?: string | null;
  status: InvoiceStatus;
  valid_until?: string | null;
  payment_proofs?: { id?: string; status?: string | null; amount_usd?: number | null; amount_lbp?: number | null; uploaded_at?: string | null }[];
};

type StatusFilter = "all" | InvoiceStatus | "quote" | "approved" | "expired";

interface InteractiveInvoicesTableProps {
  initialInvoices: InvoiceTableInvoice[];
  invoiceStatuses: InvoiceStatus[];
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  unpaid: "Unpaid",
  overdue: "Overdue",
  partial: "Partial",
  paid: "Paid",
  rejected: "Rejected",
  quote: "Quote",
  approved: "Approved",
  expired: "Expired"
};

function formatAmount(invoice: InvoiceTableInvoice) {
  const usd = Number(invoice.amount_usd || 0);
  const lbp = Number(invoice.amount_lbp || 0);

  if ((invoice.currency || "").toUpperCase() === "LBP" && lbp > 0) {
    return money(invoice.amount_lbp, "LBP");
  }

  if (usd > 0) {
    return money(invoice.amount_usd, "USD");
  }

  if (lbp > 0) {
    return money(invoice.amount_lbp, "LBP");
  }

  return money(invoice.amount_usd, "USD");
}

function rowProofs(invoice: InvoiceTableInvoice) {
  return (invoice.payment_proofs || []).map((p) => ({
    status: p.status || "",
    amount_usd: p.amount_usd,
    amount_lbp: p.amount_lbp
  }));
}

function getRowDisplayStatus(invoice: InvoiceTableInvoice) {
  const proofs = rowProofs(invoice);
  const reconciled = reconcileInvoiceStatus(invoice as any, proofs);
  const isQuote = isQuoteDocument(invoice);
  return isQuote ? documentStatus({ ...invoice, status: reconciled }) : getDisplayInvoiceStatus({ ...invoice, status: reconciled });
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="q-section-label mb-1.5 text-slate-400">{label}</p>
      <div className="text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function buildTags(invoice: InvoiceTableInvoice, displayStatus: string, expired: boolean) {
  const tags = [documentNounTitle(invoice), displayStatus, invoice.clients?.name || "no client"];

  if (invoice.currency) tags.push(invoice.currency.toUpperCase());
  if (Number(invoice.amount_usd || 0) > 0) tags.push("USD");
  if (Number(invoice.amount_lbp || 0) > 0) tags.push("LBP");
  if (invoice.public_token) tags.push(isQuoteDocument(invoice) ? "quote link" : "payment link");
  if (expired) tags.push("expired");

  return Array.from(new Set(tags));
}

function InvoiceRow({
  invoice,
  expanded,
  invoiceStatuses,
  onToggle
}: {
  invoice: InvoiceTableInvoice;
  expanded: boolean;
  invoiceStatuses: InvoiceStatus[];
  onToggle: () => void;
}) {
  const proofs = rowProofs(invoice);
  const reconciled = reconcileInvoiceStatus(invoice as any, proofs);
  const isQuote = isQuoteDocument(invoice);
  const displayStatus = isQuote ? documentStatus({ ...invoice, status: reconciled }) : getDisplayInvoiceStatus({ ...invoice, status: reconciled });
  const friendlyLifecycle = getFriendlyLifecycleLabel({
    invoice: { ...invoice, status: reconciled },
    proofs,
    reconciledStatus: reconciled
  });
  const priorityFlags = getInvoicePriorityFlags({
    invoice,
    proofs,
    displayStatus,
    reconciledStatus: reconciled
  });
  const isExpired =
    Boolean(invoice.valid_until && new Date(invoice.valid_until) < new Date()) &&
    (isQuote ? displayStatus === "expired" : displayStatus !== "paid");
  const nounTitle = documentNounTitle(invoice);
  const invoiceNumber = invoice.invoice_number || nounTitle;
  const title = invoice.title || `Untitled ${nounTitle.toLowerCase()}`;
  const clientName = invoice.clients?.name || "No client";
  const publicPath = invoice.public_token ? `/pay/${invoice.public_token}` : null;
  const tags = buildTags(invoice, displayStatus, Boolean(isExpired));

  return (
    <>
      <motion.button
        type="button"
        onClick={onToggle}
        whileHover={{ backgroundColor: "rgba(17, 100, 102, 0.035)" }}
        className="w-full px-4 py-3.5 text-left transition-[background-color,box-shadow] duration-q hover:bg-slate-50/80 active:bg-slate-100 md:py-4"
      >
        <div className="hidden items-center gap-4 md:flex">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </motion.div>

          <div className="flex w-36 shrink-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={displayStatus} label={friendlyLifecycle} />
              {isExpired ? <StatusBadge status="expired" label="Link expired" size="sm" /> : null}
            </div>
            <InvoicePriorityBadges flags={priorityFlags} />
          </div>

          <time className="w-24 shrink-0 font-mono text-xs text-slate-500">{shortDate(invoice.due_date)}</time>

          <span className="w-36 shrink-0 truncate text-sm font-semibold text-ink">{clientName}</span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{title}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">{invoiceNumber}</p>
          </div>

          <span className="q-figure w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-ink">{formatAmount(invoice)}</span>
        </div>

        <div className="grid gap-3 md:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-ink">{title}</p>
              <p className="mt-1 truncate font-mono text-xs text-slate-500">{invoiceNumber}</p>
            </div>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </motion.div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={displayStatus} label={friendlyLifecycle} />
            {isExpired ? <StatusBadge status="expired" label="Expired link" /> : null}
            <InvoicePriorityBadges flags={priorityFlags} className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Client</p>
              <p className="truncate font-semibold text-ink">{clientName}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Amount</p>
              <p className="q-figure font-semibold tabular-nums text-ink">{formatAmount(invoice)}</p>
            </div>
          </div>
          <p className="font-mono text-xs text-slate-500">Due {shortDate(invoice.due_date)}</p>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-slate-200/80 bg-slate-50/70"
          >
            <div className="space-y-5 p-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{nounTitle}</p>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="break-words text-sm font-bold text-ink">{title}</p>
                  <p className="mt-1 break-words font-mono text-xs text-slate-500">{invoiceNumber}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DetailItem label="Client" value={clientName} />
                <DetailItem label="Status" value={<StatusBadge status={displayStatus} label={friendlyLifecycle} />} />
                <DetailItem
                  label="Amount"
                  value={
                    <span>
                      {money(invoice.amount_usd, "USD")}
                      <span className="mt-1 block text-xs text-slate-500">{money(invoice.amount_lbp, "LBP")}</span>
                    </span>
                  }
                />
                <DetailItem label="Due date" value={shortDate(invoice.due_date)} />
              </div>

              {publicPath && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Public {isQuote ? "quote" : "payment"} link
                  </p>
                  <Link
                    href={publicPath}
                    className="block break-all rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs font-semibold text-cedar hover:border-cedar/30 hover:bg-cedar/5"
                  >
                    {publicPath}
                  </Link>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Metadata</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="bg-white text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <form
                  action={setInvoiceStatusAction}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <input name="id" type="hidden" value={invoice.id} />
                  <label className="sr-only" htmlFor={`status-${invoice.id}`}>
                    Update invoice status
                  </label>
                  <select
                    className="field min-h-10"
                    defaultValue={invoice.status}
                    id={`status-${invoice.id}`}
                    name="status"
                  >
                    {invoiceStatuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabels[status] || status}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-secondary min-h-10" type="submit">
                    Update status
                  </button>
                </form>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Link className="btn btn-primary min-h-10" href={`/invoices/${invoice.id}`}>
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    View {nounTitle.toLowerCase()}
                  </Link>
                  {publicPath && (
                    <Link className="btn btn-secondary min-h-10" href={publicPath}>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Public page
                    </Link>
                  )}
                  <Link className="btn btn-secondary min-h-10" href={`/invoices/${invoice.id}/print`}>
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    Print {nounTitle.toLowerCase()}
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FilterPanel({
  invoiceStatuses,
  selectedStatus,
  statusCounts,
  onStatusChange
}: {
  invoiceStatuses: InvoiceStatus[];
  selectedStatus: StatusFilter;
  statusCounts: Record<string, number>;
  onStatusChange: (status: StatusFilter) => void;
}) {
  const options: StatusFilter[] = ["all", "quote", "approved", "expired", ...invoiceStatuses];
  const hasActiveFilters = selectedStatus !== "all";

  return (
    <motion.aside
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18 }}
      className="w-full shrink-0 overflow-hidden border-b border-slate-200/80 bg-white/95 md:w-72 md:border-b-0 md:border-r"
    >
      <div className="flex max-h-[420px] flex-col gap-6 overflow-y-auto p-4 md:max-h-none">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-ink">Filters</h3>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onStatusChange("all")}>
              Clear
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Document status</p>
          <div className="space-y-2">
            {options.map((status) => {
              const selected = selectedStatus === status;
              const count =
                status === "all"
                  ? Object.values(statusCounts).reduce((sum, value) => sum + value, 0)
                  : statusCounts[status] || 0;

              return (
                <motion.button
                  key={status}
                  type="button"
                  whileHover={{ x: 2 }}
                  onClick={() => onStatusChange(status)}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition-colors",
                    selected
                      ? "border-cedar bg-cedar/10 text-cedar"
                      : "border-slate-200 text-slate-600 hover:border-cedar/30 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    <span className="capitalize">{status === "all" ? "All" : statusLabels[status] || status}</span>
                  </span>
                  <span className="font-mono text-xs text-slate-400">{count.toLocaleString()}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

export function InteractiveInvoicesTable({ initialInvoices, invoiceStatuses }: InteractiveInvoicesTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const statusCounts = useMemo(() => {
    return initialInvoices.reduce<Record<string, number>>((counts, invoice) => {
      const displayStatus = getRowDisplayStatus(invoice);
      counts[displayStatus] = (counts[displayStatus] || 0) + 1;
      return counts;
    }, {});
  }, [initialInvoices]);

  const filteredInvoices = useMemo(() => {
    return initialInvoices.filter((invoice) => {
      const lowerQuery = searchQuery.toLowerCase();
      const displayStatus = getRowDisplayStatus(invoice);

      const matchSearch =
        (invoice.invoice_number?.toLowerCase() || "").includes(lowerQuery) ||
        (invoice.title?.toLowerCase() || "").includes(lowerQuery) ||
        (invoice.clients?.name?.toLowerCase() || "").includes(lowerQuery);

      const matchStatus = statusFilter === "all" || displayStatus === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [initialInvoices, searchQuery, statusFilter]);

  const activeFilters = statusFilter === "all" ? 0 : 1;

  return (
    <section className="q-table-shell">
      <div className="border-b border-slate-200/80 bg-white/95 p-5 sm:p-6">
        <div className="space-y-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="q-headline">Documents</h2>
              <p className="q-body-muted mt-1.5">
                {filteredInvoices.length.toLocaleString()} of {initialInvoices.length.toLocaleString()} documents
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search number, title, or client..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 pl-9 text-sm"
              />
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="shrink-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant={showFilters ? "default" : "outline"}
              size="icon"
              onClick={() => setShowFilters((current) => !current)}
              aria-label="Toggle invoice filters"
              className="relative shrink-0"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              {activeFilters > 0 && (
                <Badge className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center border-0 bg-tomato p-0 text-xs text-white">
                  {activeFilters}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
        <AnimatePresence initial={false}>
          {showFilters && (
            <FilterPanel
              invoiceStatuses={invoiceStatuses}
              selectedStatus={statusFilter}
              statusCounts={statusCounts}
              onStatusChange={setStatusFilter}
            />
          )}
        </AnimatePresence>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="w-full min-w-[760px]">
            <div className="q-table-head hidden px-4 py-3 md:grid md:grid-cols-[32px_minmax(140px,160px)_96px_144px_minmax(0,1fr)_112px] md:gap-4">
              <span />
              <span>Status</span>
              <span>Due</span>
              <span>Client</span>
              <span>Document</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="divide-y divide-slate-100/90">
            <AnimatePresence mode="popLayout">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice, index) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, delay: index * 0.015 }}
                  >
                    <InvoiceRow
                      invoice={invoice}
                      expanded={expandedId === invoice.id}
                      invoiceStatuses={invoiceStatuses}
                      onToggle={() =>
                        setExpandedId((current) => (current === invoice.id ? null : invoice.id))
                      }
                    />
                  </motion.div>
                ))
              ) : (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-10 text-center"
                >
                  {initialInvoices.length === 0 ? (
                    <PremiumEmptyState
                      title="No invoices or quotes yet."
                      description="Create the first client-facing document to open the payment workflow."
                      guidance={[
                        "Invoices generate a public payment page with your active payment methods.",
                        "Clients can upload payment proof from that page for manual review.",
                        "Accepted proofs update the invoice balance and make receipts easier to share."
                      ]}
                      example="Tip: add a client first, then issue INV-001 with a clear due date and payment instructions."
                      icon={<FileText className="h-6 w-6" aria-hidden="true" />}
                      action={
                        <Link className="btn btn-primary" href="/invoices/new">
                          New invoice
                        </Link>
                      }
                    />
                  ) : (
                    <PremiumEmptyState
                      title="No invoices match your filters."
                      description="Try a different search term or clear the active filters."
                      example="Clear the status filter or search by invoice number exactly as printed."
                      icon={<FileText className="h-6 w-6" aria-hidden="true" />}
                      action={
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("all");
                            setShowFilters(false);
                          }}
                        >
                          Clear filters
                        </button>
                      }
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
