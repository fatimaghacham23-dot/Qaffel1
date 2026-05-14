import { Building2, Mail, Phone, Palette } from "lucide-react";
import { BusinessLogoOrMonogram } from "@/components/brand/BusinessLogoOrMonogram";
import { brandCssVars, type DocumentTheme } from "@/lib/brand";

type ProfilePreviewCardProps = {
  businessName?: string | null;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  defaultCurrency?: string | null;
  logoUrl?: string | null;
  brandColor?: string;
  brandAccent?: string | null;
  businessTagline?: string | null;
  documentTheme?: DocumentTheme;
  supportEmail?: string | null;
  businessWebsite?: string | null;
};

function themeTitle(theme: DocumentTheme) {
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

export function ProfilePreviewCard({
  businessName,
  fullName,
  phone,
  email,
  address,
  defaultCurrency,
  logoUrl,
  brandColor = "#116466",
  brandAccent,
  businessTagline,
  documentTheme = "professional",
  supportEmail,
  businessWebsite
}: ProfilePreviewCardProps) {
  const displayName = businessName || fullName || "Your business";

  return (
    <aside
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"
      data-doc-theme={documentTheme}
      style={brandCssVars(brandColor, brandAccent)}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-cedar">Client-facing preview</p>
      <div className="public-brand-card mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-start gap-3">
          {logoUrl ? (
            <BusinessLogoOrMonogram logoUrl={logoUrl} businessName={displayName} className="h-14 max-w-[160px]" />
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cedar to-ink text-white shadow-soft">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-ink">{displayName}</h2>
            <p className="mt-1 text-sm text-slate-500">Public pay, receipts & portal</p>
            {businessTagline?.trim() ? <p className="mt-2 text-sm leading-snug text-slate-600">{businessTagline.trim()}</p> : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <Mail className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{supportEmail?.trim() || email || "No support email"}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{phone || "No phone yet"}</span>
          </div>
          {businessWebsite?.trim() ? (
            <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold text-ink">Website · </span>
              {businessWebsite.trim()}
            </p>
          ) : null}
          {address ? <p className="rounded-xl border border-slate-200 bg-white p-3 text-slate-600">{address}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice default</p>
          <p className="mt-2 text-lg font-bold text-ink">{defaultCurrency || "USD"}</p>
          <p className="mt-1 text-sm text-slate-500">Starting currency for new invoices.</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Palette className="h-3.5 w-3.5" aria-hidden />
            Document theme
          </p>
          <p className="mt-2 text-lg font-bold text-ink">{themeTitle(documentTheme)}</p>
          <p className="mt-1 text-sm text-slate-500">Print & PDF presentation preset.</p>
        </div>
      </div>
    </aside>
  );
}
