"use client";

import { Edit3, FileText, PlusCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { updateClientAction } from "@/app/actions";
import { ClientDeleteButton } from "@/components/ClientDeleteButton";
import { Badge } from "@/components/ui/badge";
import { money, shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ClientBalanceSummary = {
  currency: "USD" | "LBP";
  billed: number;
  paid: number;
  balance: number;
  overpaid: number;
};

export type ClientInvoiceSummary = {
  paid: number;
  partial: number;
  unpaid: number;
};

export type ClientMemberListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string | null;
  invoiceCount: number;
  invoiceSummary: ClientInvoiceSummary;
  balances: ClientBalanceSummary[];
};

interface ClientMemberListProps {
  clients: ClientMemberListItem[];
}

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return initials || "C";
}

function BalanceCell({ balances }: { balances: ClientBalanceSummary[] }) {
  if (balances.length === 0) {
    return <span className="text-sm text-slate-400">No financial data</span>;
  }

  return (
    <div className="grid gap-1.5">
      {balances.map((balance) => {
        const settled = balance.balance <= 0 && balance.overpaid <= 0;
        const label = balance.overpaid > 0 ? "Overpaid" : settled ? "Settled" : "Balance due";
        const value =
          balance.overpaid > 0
            ? money(balance.overpaid, balance.currency)
            : settled
              ? money(0, balance.currency)
              : money(balance.balance, balance.currency);

        return (
          <div key={balance.currency} className="min-w-0">
            <p
              className={cn(
                "truncate text-sm font-bold",
                balance.overpaid > 0 || settled ? "text-emerald-700" : "text-amber-700"
              )}
            >
              {label} {value}
            </p>
            <p className="truncate text-[11px] font-medium text-slate-400">{balance.currency}</p>
          </div>
        );
      })}
    </div>
  );
}

function InvoiceSummaryCell({ count, summary }: { count: number; summary: ClientInvoiceSummary }) {
  return (
    <div>
      <p className="text-sm font-bold text-ink">
        {count.toLocaleString()} {count === 1 ? "invoice" : "invoices"}
      </p>
      {count > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge variant="outline" className="bg-emerald-50 text-[11px] text-emerald-700">
            {summary.paid} paid
          </Badge>
          <Badge variant="outline" className="bg-sky-50 text-[11px] text-sky-700">
            {summary.partial} partial
          </Badge>
          <Badge variant="outline" className="bg-slate-50 text-[11px] text-slate-600">
            {summary.unpaid} unpaid
          </Badge>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-400">No invoices yet</p>
      )}
    </div>
  );
}

function EditClientPanel({ client }: { client: ClientMemberListItem }) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 md:px-6">
      <div className="grid gap-3">
        <form action={updateClientAction} className="grid gap-3">
          <input name="id" type="hidden" value={client.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label" htmlFor={`name-${client.id}`}>
                Name
              </label>
              <input className="field" defaultValue={client.name} id={`name-${client.id}`} name="name" required />
            </div>
            <div>
              <label className="label" htmlFor={`email-${client.id}`}>
                Email
              </label>
              <input
                className="field"
                defaultValue={client.email || ""}
                id={`email-${client.id}`}
                name="email"
                type="email"
              />
            </div>
            <div>
              <label className="label" htmlFor={`phone-${client.id}`}>
                Phone
              </label>
              <input className="field" defaultValue={client.phone || ""} id={`phone-${client.id}`} name="phone" />
            </div>
            <div>
              <label className="label" htmlFor={`notes-${client.id}`}>
                Notes
              </label>
              <textarea
                className="field"
                defaultValue={client.notes || ""}
                id={`notes-${client.id}`}
                name="notes"
                rows={1}
              />
            </div>
          </div>
          {client.notes && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Current notes</p>
              <p className="whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
          <button className="btn btn-secondary text-xs" type="submit">
            Save changes
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <Trash2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <ClientDeleteButton clientId={client.id} />
        </div>
      </div>
    </div>
  );
}

function ClientActions({
  client,
  editing,
  onEdit
}: {
  client: ClientMemberListItem;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
      <Link
        aria-label={`View statement for ${client.name}`}
        className="btn btn-secondary min-h-8 px-2.5 text-xs"
        href={`/clients/${client.id}`}
        title="View statement"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        View
      </Link>
      <Link
        aria-label={`Create invoice for ${client.name}`}
        className="btn btn-primary min-h-8 px-2.5 text-xs"
        href={`/invoices/new?client_id=${client.id}`}
        title="Create invoice"
      >
        <PlusCircle className="h-4 w-4" aria-hidden="true" />
        Invoice
      </Link>
      <button
        aria-label={`${editing ? "Close edit" : "Edit client"} for ${client.name}`}
        className="btn btn-secondary min-h-8 px-2.5 text-xs"
        onClick={onEdit}
        title={editing ? "Close edit" : "Edit client"}
        type="button"
      >
        <Edit3 className="h-4 w-4" aria-hidden="true" />
        {editing ? "Close" : "Edit"}
      </button>
    </div>
  );
}

function ClientDesktopRow({
  client,
  editing,
  onEdit
}: {
  client: ClientMemberListItem;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <>
      <div className="hidden items-center gap-3 border-b border-slate-100 px-4 py-3 text-sm transition-colors hover:bg-slate-50/80 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.65fr)_minmax(150px,0.95fr)] lg:gap-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cedar/15 bg-cedar/10 text-xs font-bold text-cedar">
            {clientInitials(client.name)}
          </div>
          <div className="min-w-0">
            <Link className="block truncate font-bold text-ink transition hover:text-cedar" href={`/clients/${client.id}`}>
              {client.name}
            </Link>
            <p className="truncate text-xs text-slate-500">{client.email || "No email"}</p>
          </div>
        </div>
        <p className="truncate text-xs font-medium text-slate-600">{client.phone || "No phone"}</p>
        <InvoiceSummaryCell count={client.invoiceCount} summary={client.invoiceSummary} />
        <BalanceCell balances={client.balances} />
        <p className="text-xs font-medium text-slate-500">{shortDate(client.created_at)}</p>
        <ClientActions client={client} editing={editing} onEdit={onEdit} />
      </div>
      {editing && (
        <div className="hidden md:block">
          <EditClientPanel client={client} />
        </div>
      )}
    </>
  );
}

function ClientMobileCard({
  client,
  editing,
  onEdit
}: {
  client: ClientMemberListItem;
  editing: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="border-b border-slate-100 p-4 last:border-b-0 md:hidden">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cedar/15 bg-cedar/10 text-xs font-bold text-cedar">
          {clientInitials(client.name)}
        </div>
        <div className="min-w-0 flex-1">
          <Link className="block truncate font-bold text-ink transition hover:text-cedar" href={`/clients/${client.id}`}>
            {client.name}
          </Link>
          <p className="truncate text-xs text-slate-500">{client.email || "No email"}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-600">{client.phone || "No phone"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invoices</p>
          <InvoiceSummaryCell count={client.invoiceCount} summary={client.invoiceSummary} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance</p>
          <BalanceCell balances={client.balances} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Client since</p>
          <p className="mt-1 text-sm font-semibold text-ink">{shortDate(client.created_at)}</p>
        </div>
      </div>

      <div className="mt-4">
        <ClientActions client={client} editing={editing} onEdit={onEdit} />
      </div>

      {editing && (
        <div className="-mx-4 mt-4">
          <EditClientPanel client={client} />
        </div>
      )}
    </div>
  );
}

export function ClientMemberList({ clients }: ClientMemberListProps) {
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cedar/10 text-sm font-bold text-cedar">
          CL
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink">No clients yet.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Add a client to start creating invoices and tracking statement balances.
        </p>
        <Link className="btn btn-primary mt-5" href="/clients/new">
          New client
        </Link>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div>
        <div className="hidden gap-3 border-b border-slate-200 bg-slate-50/95 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400 md:sticky md:top-0 md:z-10 md:grid md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,0.65fr)_minmax(150px,0.95fr)] lg:gap-4 lg:px-6">
          <div>Name</div>
          <div>Phone</div>
          <div>Invoices</div>
          <div>Balance</div>
          <div>Joined</div>
          <div className="text-right">Actions</div>
        </div>
        {clients.map((client) => {
          const editing = editingClientId === client.id;
          const onEdit = () => setEditingClientId((current) => (current === client.id ? null : client.id));

          return (
            <div key={client.id}>
              <ClientDesktopRow client={client} editing={editing} onEdit={onEdit} />
              <ClientMobileCard client={client} editing={editing} onEdit={onEdit} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
