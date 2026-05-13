import Link from "next/link";
import { Mail, Phone, UserRound } from "lucide-react";
import { createClientAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";

export default async function NewClientPage({
  searchParams
}: {
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { invoice_id } = await searchParams;

  return (
    <AppShell>
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <Link className="text-sm font-semibold text-cedar" href="/clients">
          Back to clients
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">New client</h1>
            <p className="mt-1 text-sm text-slate-600">Create a clean client profile for invoices, reminders, statements, and portal access.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status="active" label="Statement ready" />
              <StatusBadge status="warning" label="Email optional" />
              <StatusBadge status="warning" label="Phone optional" />
            </div>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cedar/10 text-cedar">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <form action={createClientAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="panel grid gap-4">
          {invoice_id && <input name="invoice_id" type="hidden" value={invoice_id} />}
          <div>
            <p className="text-sm font-semibold text-ink">Client identity</p>
            <p className="mt-1 text-xs text-slate-500">Only the name is required. Contact details improve reminders and statements.</p>
          </div>
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input className="field" id="name" name="name" required />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input className="field" id="email" name="email" type="email" />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Phone
              </label>
              <input className="field" id="phone" name="phone" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea className="field min-h-24" id="notes" name="notes" />
          </div>
          <div className="border-t border-slate-200 pt-4">
            <button className="btn btn-primary w-full sm:w-fit" type="submit">
              Create client
            </button>
          </div>
        </section>

        <aside className="panel h-fit">
          <p className="text-sm font-semibold text-ink">What improves after adding contact details</p>
          <div className="mt-4 grid gap-3">
            <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <Mail className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <p className="text-sm text-slate-600">Email appears on statement and contact cards.</p>
            </div>
            <div className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <Phone className="mt-0.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <p className="text-sm text-slate-600">Phone enables faster WhatsApp reminder workflows.</p>
            </div>
          </div>
        </aside>
      </form>
    </AppShell>
  );
}
