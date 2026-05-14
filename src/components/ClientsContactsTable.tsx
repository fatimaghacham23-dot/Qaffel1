"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  Mail,
  Phone,
  PlusCircle,
  Search,
  Trash2,
  User,
  X
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { updateClientAction } from "@/app/actions";
import { ClientDeleteButton } from "@/components/ClientDeleteButton";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ClientHealth } from "@/lib/operations";
import { money, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ClientContactsBalance = {
  currency: "USD" | "LBP";
  billed: number;
  paid: number;
  balance: number;
  overpaid: number;
};

export type ClientContactsInvoiceSummary = {
  paid: number;
  partial: number;
  unpaid: number;
};

export type ClientContactsTableItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string | null;
  invoiceCount: number;
  invoiceSummary: ClientContactsInvoiceSummary;
  balances: ClientContactsBalance[];
  health: ClientHealth;
};

type BalanceFilter = "all" | "due" | "overpaid" | "settled";
type SortField = "name" | "joined" | "invoices";
type SortOrder = "asc" | "desc";

interface ClientsContactsTableProps {
  clients: ClientContactsTableItem[];
}

const ITEMS_PER_PAGE = 10;

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "C";
}

function getBalanceState(client: ClientContactsTableItem): Exclude<BalanceFilter, "all"> {
  if (client.balances.some((balance) => balance.balance > 0)) return "due";
  if (client.balances.some((balance) => balance.overpaid > 0)) return "overpaid";
  return "settled";
}

function ClientHealthBadge({ health }: { health: ClientHealth }) {
  const cfg =
    health === "risk"
      ? { label: "Risk", className: "border-red-200 bg-red-50 text-red-900" }
      : health === "attention"
        ? { label: "Attention", className: "border-amber-200 bg-amber-50 text-amber-900" }
        : { label: "Good", className: "border-emerald-200 bg-emerald-50 text-emerald-900" };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

function BalanceLabel({ client }: { client: ClientContactsTableItem }) {
  if (client.balances.length === 0) {
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-500">
        Settled
      </Badge>
    );
  }

  const state = getBalanceState(client);
  const relevantBalances =
    state === "due"
      ? client.balances.filter((balance) => balance.balance > 0)
      : state === "overpaid"
        ? client.balances.filter((balance) => balance.overpaid > 0)
        : client.balances.slice(0, 1);

  return (
    <div className="grid gap-1">
      {relevantBalances.map((balance) => {
        const amount =
          state === "due" ? balance.balance : state === "overpaid" ? balance.overpaid : 0;
        const label = state === "due" ? "Balance due" : state === "overpaid" ? "Overpaid" : "Settled";

        return (
          <div key={balance.currency} className="min-w-0">
            <p
              className={cn(
                "truncate text-sm font-semibold",
                state === "due" && "text-amber-700",
                state === "overpaid" && "text-emerald-700",
                state === "settled" && "text-emerald-700"
              )}
            >
              {label} {money(amount, balance.currency)}
            </p>
            <p className="truncate text-[11px] text-slate-400">{balance.currency}</p>
          </div>
        );
      })}
    </div>
  );
}

function InvoiceSummary({ client }: { client: ClientContactsTableItem }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-ink">
        {client.invoiceCount.toLocaleString()} {client.invoiceCount === 1 ? "invoice" : "invoices"}
      </p>
      {client.invoiceCount > 0 ? (
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {client.invoiceSummary.paid} paid / {client.invoiceSummary.partial} partial /{" "}
          {client.invoiceSummary.unpaid} unpaid
        </p>
      ) : (
        <p className="mt-0.5 truncate text-xs text-slate-400">No invoices yet</p>
      )}
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-bold text-ink">{value}</div>
    </div>
  );
}

function EditClientForm({ client }: { client: ClientContactsTableItem }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
      <form action={updateClientAction} className="grid gap-3">
        <input name="id" type="hidden" value={client.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`modal-name-${client.id}`}>
              Name
            </label>
            <input className="field" defaultValue={client.name} id={`modal-name-${client.id}`} name="name" required />
          </div>
          <div>
            <label className="label" htmlFor={`modal-email-${client.id}`}>
              Email
            </label>
            <input
              className="field"
              defaultValue={client.email || ""}
              id={`modal-email-${client.id}`}
              name="email"
              type="email"
            />
          </div>
          <div>
            <label className="label" htmlFor={`modal-phone-${client.id}`}>
              Phone
            </label>
            <input className="field" defaultValue={client.phone || ""} id={`modal-phone-${client.id}`} name="phone" />
          </div>
          <div>
            <label className="label" htmlFor={`modal-notes-${client.id}`}>
              Notes
            </label>
            <textarea
              className="field"
              defaultValue={client.notes || ""}
              id={`modal-notes-${client.id}`}
              name="notes"
              rows={1}
            />
          </div>
        </div>
        <button className="btn btn-secondary w-fit text-xs" type="submit">
          Save changes
        </button>
      </form>
      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="mb-3 flex items-start gap-2">
          <Trash2 className="mt-0.5 h-4 w-4 text-red-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-red-800">Danger zone</p>
            <p className="mt-1 text-xs text-red-700">Delete this client only when their statement is no longer needed.</p>
          </div>
        </div>
        <ClientDeleteButton clientId={client.id} />
      </div>
    </div>
  );
}

function ClientDetailsModal({
  client,
  onClose
}: {
  client: ClientContactsTableItem;
  onClose: () => void;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const financialRows = client.balances.length > 0 ? client.balances : [{
    currency: "USD" as const,
    billed: 0,
    paid: 0,
    balance: 0,
    overpaid: 0
  }];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 18 }}
        transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.75 }}
        className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Close client details"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-ink"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="flex items-start gap-4 pr-10">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cedar/10 text-sm font-bold text-cedar ring-1 ring-cedar/15">
            {clientInitials(client.name)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-ink">{client.name}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4" aria-hidden="true" />
                {client.email || "No email"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4" aria-hidden="true" />
                {client.phone || "No phone"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DetailMetric label="Invoices" value={client.invoiceCount.toLocaleString()} />
          <DetailMetric
            label="Total billed"
            value={
              <span className="grid gap-1">
                {financialRows.map((row) => (
                  <span key={row.currency}>{money(row.billed, row.currency)}</span>
                ))}
              </span>
            }
          />
          <DetailMetric
            label="Total paid"
            value={
              <span className="grid gap-1">
                {financialRows.map((row) => (
                  <span key={row.currency}>{money(row.paid, row.currency)}</span>
                ))}
              </span>
            }
          />
          <DetailMetric
            label="Balance"
            value={
              <span className="grid gap-1">
                {financialRows.map((row) => {
                  const rowState = row.balance > 0 ? "due" : row.overpaid > 0 ? "overpaid" : "settled";
                  const amount = rowState === "due" ? row.balance : rowState === "overpaid" ? row.overpaid : 0;
                  const label = rowState === "due" ? "Due" : rowState === "overpaid" ? "Overpaid" : "Settled";

                  return (
                    <span key={row.currency}>
                      {label} {money(amount, row.currency)}
                    </span>
                  );
                })}
              </span>
            }
          />
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{client.notes || "No notes recorded."}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="btn btn-primary" href={`/clients/${client.id}`}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            View statement
          </Link>
          <Link className="btn btn-secondary" href={`/invoices/new?client_id=${client.id}`}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Create invoice
          </Link>
          <button className="btn btn-secondary" onClick={() => setShowEdit((current) => !current)} type="button">
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            {showEdit ? "Close edit" : "Edit client"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showEdit && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-5 overflow-hidden"
            >
              <EditClientForm client={client} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export function ClientsContactsTable({ clients }: ClientsContactsTableProps) {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientContactsTableItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const shouldReduceMotion = useReducedMotion();

  const filteredClients = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = clients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(query) ||
        (client.email || "").toLowerCase().includes(query) ||
        (client.phone || "").toLowerCase().includes(query);
      const matchesBalance = balanceFilter === "all" || getBalanceState(client) === balanceFilter;

      return matchesSearch && matchesBalance;
    });

    return filtered.sort((a, b) => {
      let aValue: string | number = a.name.toLowerCase();
      let bValue: string | number = b.name.toLowerCase();

      if (sortField === "joined") {
        aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
        bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
      }

      if (sortField === "invoices") {
        aValue = a.invoiceCount;
        bValue = b.invoiceCount;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [balanceFilter, clients, searchQuery, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedClients = filteredClients.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const shouldAnimate = !shouldReduceMotion;

  const toggleSelectClient = (clientId: string) => {
    setSelectedClientIds((current) =>
      current.includes(clientId) ? current.filter((id) => id !== clientId) : [...current, clientId]
    );
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedClients.map((client) => client.id);
    const selectedPageIds = pageIds.filter((id) => selectedClientIds.includes(id));

    setSelectedClientIds((current) =>
      selectedPageIds.length === pageIds.length
        ? current.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...current, ...pageIds]))
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }

    setShowSortMenu(false);
    setCurrentPage(1);
  };

  const handleFilter = (filter: BalanceFilter) => {
    setBalanceFilter(filter);
    setShowFilterMenu(false);
    setCurrentPage(1);
  };

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">Clients</h2>
          <p className="text-sm text-slate-500">
            {filteredClients.length.toLocaleString()} of {clients.length.toLocaleString()} clients
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="min-h-11 pl-9"
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search name, email, phone..."
              value={searchQuery}
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <button
                className={cn(
                  "btn btn-secondary min-h-10 px-3 text-xs",
                  balanceFilter !== "all" && "ring-2 ring-cedar/15"
                )}
                onClick={() => setShowFilterMenu((current) => !current)}
                type="button"
              >
                Filter
                {balanceFilter !== "all" && (
                  <span className="rounded bg-cedar px-1.5 py-0.5 text-[10px] text-white">1</span>
                )}
              </button>
              {showFilterMenu && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => setShowFilterMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-soft">
                    {[
                      ["all", "All clients"],
                      ["due", "Balance due"],
                      ["overpaid", "Overpaid"],
                      ["settled", "Settled"]
                    ].map(([value, label]) => (
                      <button
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50",
                          balanceFilter === value && "bg-cedar/10 font-semibold text-cedar"
                        )}
                        key={value}
                        onClick={() => handleFilter(value as BalanceFilter)}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                className="btn btn-secondary min-h-10 px-3 text-xs"
                onClick={() => setShowSortMenu((current) => !current)}
                type="button"
              >
                Sort
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
              {showSortMenu && (
                <>
                  <button className="fixed inset-0 z-10 cursor-default" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-soft">
                    {[
                      ["name", "Name"],
                      ["joined", "Joined"],
                      ["invoices", "Invoices"]
                    ].map(([value, label]) => (
                      <button
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50",
                          sortField === value && "bg-cedar/10 font-semibold text-cedar"
                        )}
                        key={value}
                        onClick={() => handleSort(value as SortField)}
                        type="button"
                      >
                        {label} {sortField === value && `(${sortOrder === "asc" ? "asc" : "desc"})`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="q-table-shell">
        <div className="q-table-head hidden px-4 py-3 md:grid md:grid-cols-[36px_minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(88px,0.55fr)_92px] md:items-center md:gap-3 lg:px-5">
          <label className="flex items-center justify-center">
            <input
              aria-label="Select all visible clients"
              checked={paginatedClients.length > 0 && paginatedClients.every((client) => selectedClientIds.includes(client.id))}
              className="h-4 w-4 rounded border-slate-300 accent-cedar"
              onChange={toggleSelectAll}
              type="checkbox"
            />
          </label>
          <span>Client</span>
          <span>Phone</span>
          <span>Email</span>
          <span>Invoices</span>
          <span>Balance</span>
          <span>Joined</span>
          <span className="text-right">Actions</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${safePage}-${searchQuery}-${balanceFilter}-${sortField}-${sortOrder}`}
            animate="visible"
            initial={shouldAnimate ? "hidden" : "visible"}
            variants={{
              visible: {
                transition: {
                  staggerChildren: shouldAnimate ? 0.025 : 0
                }
              }
            }}
          >
            {paginatedClients.length > 0 ? (
              paginatedClients.map((client) => {
                const selected = selectedClientIds.includes(client.id);

                return (
                  <motion.div
                    key={client.id}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0 },
                      exit: { opacity: 0, y: -8 }
                    }}
                  >
                    <div
                      className={cn(
                        "hidden border-b border-slate-100/90 px-4 py-3 transition-[background-color,box-shadow] duration-q hover:bg-slate-50/80 md:grid md:grid-cols-[36px_minmax(0,1.35fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(88px,0.55fr)_92px] md:items-center md:gap-3 lg:px-5",
                        selected && "bg-cedar/5"
                      )}
                    >
                      <label className="flex items-center justify-center">
                        <input
                          aria-label={`Select ${client.name}`}
                          checked={selected}
                          className="h-4 w-4 rounded border-slate-300 accent-cedar"
                          onChange={() => toggleSelectClient(client.id)}
                          onClick={(event) => event.stopPropagation()}
                          type="checkbox"
                        />
                      </label>
                      <button className="min-w-0 text-left" onClick={() => setSelectedClient(client)} type="button">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cedar/10 text-xs font-bold text-cedar ring-1 ring-cedar/15">
                            {clientInitials(client.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="block truncate text-sm font-bold text-ink">{client.name}</span>
                              <ClientHealthBadge health={client.health} />
                            </span>
                            <span className="block truncate text-xs text-slate-500">{client.email || "No email"}</span>
                          </span>
                        </div>
                      </button>
                      <span className="truncate text-sm text-slate-600">{client.phone || "No phone"}</span>
                      <span className="truncate text-sm text-slate-600">{client.email || "No email"}</span>
                      <InvoiceSummary client={client} />
                      <BalanceLabel client={client} />
                      <span className="truncate text-xs text-slate-500">{shortDate(client.created_at)}</span>
                      <button
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        onClick={() => setSelectedClient(client)}
                        type="button"
                      >
                        Details
                      </button>
                    </div>

                    <div className="border-b border-slate-100 bg-white/95 p-4 md:hidden">
                      <div className="flex items-start gap-3">
                        <input
                          aria-label={`Select ${client.name}`}
                          checked={selected}
                          className="mt-3 h-4 w-4 rounded border-slate-300 accent-cedar"
                          onChange={() => toggleSelectClient(client.id)}
                          type="checkbox"
                        />
                        <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedClient(client)} type="button">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cedar/10 text-xs font-bold text-cedar ring-1 ring-cedar/15">
                              {clientInitials(client.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="block truncate text-base font-bold text-ink">{client.name}</span>
                                <ClientHealthBadge health={client.health} />
                              </span>
                              <span className="block truncate text-xs text-slate-500">{client.email || "No email"}</span>
                              <span className="mt-1 block truncate text-xs text-slate-500">{client.phone || "No phone"}</span>
                            </span>
                          </div>
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoices</p>
                          <InvoiceSummary client={client} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance</p>
                          <BalanceLabel client={client} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Joined</p>
                          <p className="text-sm font-semibold text-ink">{shortDate(client.created_at)}</p>
                        </div>
                        <div className="flex items-end">
                          <button
                            className="btn btn-secondary min-h-9 px-3 text-xs"
                            onClick={() => setSelectedClient(client)}
                            type="button"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <motion.div animate={{ opacity: 1 }} className="p-10 text-center" initial={{ opacity: 0 }}>
                {clients.length === 0 ? (
                  <PremiumEmptyState
                    title="No clients yet."
                    description="Add the first relationship your invoices, reminders, and statements will connect to."
                    guidance={[
                      "Save the WhatsApp phone or email you use for payment follow-up.",
                      "Client records keep invoices, balances, and receipts grouped together.",
                      "After adding a client, create an invoice from their profile or the invoice page."
                    ]}
                    example="Example: Acme Studio, Beirut, with the finance contact phone."
                    icon={<User className="h-6 w-6" aria-hidden="true" />}
                    action={
                      <Link className="btn btn-primary" href="/clients/new">
                        New client
                      </Link>
                    }
                  />
                ) : (
                  <PremiumEmptyState
                    title="No clients match your filters."
                    description="Try a different search term or balance filter."
                    example="Clear the balance filter or search part of the client name."
                    icon={<User className="h-6 w-6" aria-hidden="true" />}
                  />
                )}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Page {safePage} of {totalPages} - {filteredClients.length.toLocaleString()} clients
          </p>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary min-h-9 px-3 text-xs"
              disabled={safePage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </button>
            <button
              className="btn btn-secondary min-h-9 px-3 text-xs"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              type="button"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedClient && <ClientDetailsModal client={selectedClient} onClose={() => setSelectedClient(null)} />}
      </AnimatePresence>
    </div>
  );
}
