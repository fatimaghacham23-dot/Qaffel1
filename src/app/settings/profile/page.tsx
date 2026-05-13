import { AppShell } from "@/components/AppShell";
import { updateProfileAction } from "@/app/actions";
import { OperationsChecklist } from "@/components/OperationsChecklist";
import { ProfilePreviewCard } from "@/components/ProfilePreviewCard";
import { SettingsPageHeader } from "@/components/SettingsPageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { evaluateProfileCompleteness } from "@/lib/operations";
import { requireUser } from "@/lib/supabase/server";

export default async function ProfileSettingsPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, pmCountResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true)
  ]);
  const profileCompleteness = evaluateProfileCompleteness({
    profile,
    userEmail: user.email,
    hasActivePaymentMethod: (pmCountResult.count ?? 0) > 0
  });
  const profileBadges = [
    profile?.business_name ? { status: "complete", label: "Business identity ready" } : { status: "warning", label: "Missing business name" },
    profile?.phone ? { status: "complete", label: "Phone saved" } : { status: "warning", label: "Missing phone" },
    user.email ? { status: "complete", label: "Email active" } : { status: "warning", label: "Missing email" },
    { status: "active", label: `${profile?.default_currency || "USD"} default` }
  ];

  return (
    <AppShell>
      <SettingsPageHeader
        title="Business profile"
        subtitle="Manage the business identity and invoice defaults clients see on public and printable invoices."
      />

      <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ink">Profile readiness</p>
              <p className="mt-1 text-sm text-slate-600">These fields shape the client-facing invoice and receipt identity.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {profileBadges.map((badge) => (
                <StatusBadge key={badge.label} status={badge.status} label={badge.label} />
              ))}
            </div>
          </div>
        </div>
        <OperationsChecklist
          title="Completeness checklist"
          description="Aligned with dashboard profile operations."
          items={[
            {
              id: "bn",
              label: "Business name",
              ok: profileCompleteness.businessName,
              hint: "Shown at the top of client invoices.",
              fixHref: "#profile-form",
              fixLabel: "Fill form below"
            },
            {
              id: "ph",
              label: "Business phone",
              ok: profileCompleteness.phone,
              hint: "Helps clients reach you before paying.",
              fixHref: "#profile-form",
              fixLabel: "Fill form below"
            },
            {
              id: "em",
              label: "Account email",
              ok: profileCompleteness.email,
              hint: "Used for your login and invoice sender identity."
            },
            {
              id: "br",
              label: "Brand on documents (business name)",
              ok: profileCompleteness.brandIdentity,
              hint: "Should match what clients see on Whish/OMT receipts.",
              fixHref: "#profile-form",
              fixLabel: "Fill form below"
            },
            {
              id: "pm",
              label: "Payment methods active",
              ok: profileCompleteness.paymentMethodsActive,
              hint: "Clients need instructions on the public invoice page.",
              fixHref: "/settings/payment-methods",
              fixLabel: "Payment methods"
            },
            {
              id: "ad",
              label: "Business address",
              ok: profileCompleteness.businessAddress,
              hint: "Optional but builds trust on printable invoices.",
              fixHref: "#profile-form",
              fixLabel: "Fill form below"
            }
          ]}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <form id="profile-form" action={updateProfileAction} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft scroll-mt-24">
          <div className="grid gap-6 p-6">
            <section className="grid gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Business identity</p>
                <p className="mt-1 text-xs text-muted-foreground">How your invoices introduce you.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="full_name">
                    Full name
                  </label>
                  <input className="field" defaultValue={profile?.full_name || ""} id="full_name" name="full_name" required />
                </div>
                <div>
                  <label className="label" htmlFor="business_name">
                    Business name
                  </label>
                  <input
                    className={`field ${!profile?.business_name ? "border-amber-300 bg-amber-50" : ""}`}
                    defaultValue={profile?.business_name || ""}
                    id="business_name"
                    name="business_name"
                    placeholder="e.g. Acme Design Studio"
                  />
                  {!profile?.business_name && (
                    <p className="mt-1 text-xs font-medium text-amber-600">Add your business name so invoices look professional.</p>
                  )}
                </div>
              </div>
            </section>

            <div className="border-t border-slate-200" />

            <section className="grid gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Contact details</p>
                <p className="mt-1 text-xs text-muted-foreground">Client-facing contact information.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="email">
                    Email from account
                  </label>
                  <input className="field cursor-not-allowed bg-slate-50" defaultValue={user.email} id="email" readOnly />
                </div>
                <div>
                  <label className="label" htmlFor="phone">
                    Phone
                  </label>
                  <input className="field" defaultValue={profile?.phone || ""} id="phone" name="phone" placeholder="+961 ..." />
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="business_address">
                    Business address optional
                  </label>
                  <textarea
                    className="field min-h-24"
                    defaultValue={profile?.business_address || ""}
                    id="business_address"
                    name="business_address"
                    placeholder="e.g. Beirut, Lebanon"
                  />
                </div>
              </div>
            </section>

            <div className="border-t border-slate-200" />

            <section className="grid gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Invoice display</p>
                <p className="mt-1 text-xs text-muted-foreground">Starting settings for new invoices.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-1">
                  <label className="label" htmlFor="default_currency">
                    Default currency
                  </label>
                  <select className="field" defaultValue={profile?.default_currency || "USD"} id="default_currency" name="default_currency">
                    <option value="USD">USD</option>
                    <option value="LBP">LBP</option>
                  </select>
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end border-t border-slate-200 px-6 py-4">
            <button className="btn btn-primary" type="submit">
              Save profile
            </button>
          </div>
        </form>

        <div className="h-fit xl:sticky xl:top-6">
          <ProfilePreviewCard
            businessName={profile?.business_name}
            fullName={profile?.full_name}
            phone={profile?.phone}
            email={user.email}
            address={profile?.business_address}
            defaultCurrency={profile?.default_currency || "USD"}
          />
        </div>
      </div>
    </AppShell>
  );
}
