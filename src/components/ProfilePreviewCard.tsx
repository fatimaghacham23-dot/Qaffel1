import { Building2, Mail, Phone } from "lucide-react";

type ProfilePreviewCardProps = {
  businessName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  defaultCurrency?: string | null;
};

export function ProfilePreviewCard({
  businessName,
  fullName,
  phone,
  email,
  address,
  defaultCurrency
}: ProfilePreviewCardProps) {
  const displayName = businessName || fullName || "Your business";

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-cedar">Client invoice preview</p>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cedar to-ink text-white shadow-soft">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink">{displayName}</h2>
            <p className="mt-1 text-sm text-slate-500">Invoice sender</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span className="truncate">{email || "No account email"}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <span className="truncate">{phone || "No phone yet"}</span>
          </div>
          {address ? <p className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600">{address}</p> : null}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice default</p>
        <p className="mt-2 text-lg font-bold text-ink">{defaultCurrency || "USD"}</p>
        <p className="mt-1 text-sm text-slate-500">Used when new invoices need a starting currency.</p>
      </div>
    </aside>
  );
}
