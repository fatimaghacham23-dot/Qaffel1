import { AppShell } from "@/components/AppShell";
import { createServicePresetAction } from "@/app/actions";
import { PremiumStatCard } from "@/components/PremiumStatCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ServicePresetItem } from "@/components/ServicePresetItem";
import { StatusBadge } from "@/components/StatusBadge";
import { requireUser } from "@/lib/supabase/server";

export default async function ServicePresetsPage() {
  const { supabase, user } = await requireUser();
  const { data: presets } = await supabase
    .from("service_presets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const presetList = presets || [];
  const currenciesUsed = Array.from(new Set(presetList.map((preset) => preset.currency || "USD")));

  return (
    <AppShell>
      <PageContainer width="default">
      <PageHeader
        title="Service presets"
        breadcrumbs={[{ label: "Settings" }, { label: "Service presets" }]}
        description="Create reusable invoice templates for services you invoice frequently."
        actions={<a className="btn btn-primary" href="#new-preset">New preset</a>}
      />

      <div className="mb-6 rounded-3xl border border-slate-200/70 bg-white/75 p-5 shadow-card backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Preset readiness</p>
            <p className="mt-1 text-sm text-slate-600">Reusable services keep invoice creation fast and consistent.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={presetList.length > 0 ? "active" : "warning"} label={presetList.length > 0 ? "Preset library active" : "No presets yet"} />
            <StatusBadge status={currenciesUsed.length > 1 ? "active" : "neutral"} label={currenciesUsed.length ? `${currenciesUsed.join(" + ")} configured` : "No currency defaults"} />
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <PremiumStatCard label="Total presets" value={presetList.length.toLocaleString()} detail="Saved invoice templates" />
        <PremiumStatCard label="Preset library" value="Reusable templates" detail={presetList[0]?.name || "Ready when you add your first service"} />
        <PremiumStatCard label="Currencies used" value={currenciesUsed.length || 0} detail={currenciesUsed.length ? currenciesUsed.join(" + ") : "No currencies yet"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="border-b border-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-ink">Saved presets</p>
            <p className="mt-1 text-xs text-muted-foreground">Use a preset to quickly start a new invoice with consistent amounts and validity.</p>
          </div>
          <div className="grid gap-4 p-5">
            {presetList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-sm font-semibold text-ink">No service presets yet.</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Create your first reusable template so new invoices start with consistent service details.</p>
              </div>
            ) : (
              presetList.map((preset) => (
                <ServicePresetItem key={preset.id} preset={preset} />
              ))
            )}
          </div>
        </section>

        <aside>
          <div id="new-preset" className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-sm font-semibold text-ink">New preset</p>
              <p className="mt-1 text-xs text-muted-foreground">Store the title, description, amount, and validity you reuse often.</p>
            </div>
            <form action={createServicePresetAction} className="grid gap-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="label" htmlFor="name">
                    Preset name
                  </label>
                  <input className="field" id="name" name="name" required placeholder="e.g. Logo Design" />
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="description">
                    Default Description
                  </label>
                  <textarea className="field min-h-24 text-sm" id="description" name="description" placeholder="Optional service details..." />
                </div>
                <div>
                  <label className="label" htmlFor="amount_usd">
                    Amount USD
                  </label>
                  <input className="field" id="amount_usd" min="0" name="amount_usd" step="0.01" type="number" />
                </div>
                <div>
                  <label className="label" htmlFor="amount_lbp">
                    Amount LBP
                  </label>
                  <input className="field" id="amount_lbp" min="0" name="amount_lbp" step="1" type="number" />
                </div>
                <div>
                  <label className="label" htmlFor="currency">
                    Currency badge
                  </label>
                  <select className="field" defaultValue="USD" id="currency" name="currency">
                    <option value="USD">USD</option>
                    <option value="LBP">LBP</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="default_validity_days">
                    Default validity (days)
                  </label>
                  <input className="field" id="default_validity_days" min="0" name="default_validity_days" type="number" placeholder="e.g. 7" />
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-slate-200 pt-4">
                <button className="btn btn-primary" type="submit">
                  Create preset
                </button>
              </div>
            </form>
          </div>
        </aside>
      </div>
      </PageContainer>
    </AppShell>
  );
}
