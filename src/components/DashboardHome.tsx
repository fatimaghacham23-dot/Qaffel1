import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Clock3, FileText, ReceiptText, ShieldCheck, Users } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import type {

  DashboardActivityItem,
  DashboardCapabilities,
  DashboardMetrics,
  DashboardOnboardingState
} from "@/lib/dashboard";
import type { DerivedNotification } from "@/lib/notifications";

type CashFlowPoint = { label: string; collected: number; expected: number };

function groupedMoney(values: Record<"USD" | "LBP", number>) {
  const currencies = (["USD", "LBP"] as const).filter((currency) => values[currency] > 0);
  return currencies.length ? currencies.map((currency) => money(values[currency], currency)).join(" · ") : "—";
}

function Metric({ label, value, description, href }: { label: string; value: string; description: string; href: string }) {
  return (
    <Link href={href} className="group min-w-0 rounded-2xl bg-white px-5 py-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-3 truncate text-2xl font-semibold tracking-tight text-ink sm:text-[1.7rem]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </Link>
  );
}

function CashFlowPreview({ data, currency }: { data: CashFlowPoint[]; currency: "USD" | "LBP" }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.collected, item.expected]));
  const hasData = data.some((item) => item.collected > 0 || item.expected > 0);
  return (
    <section aria-labelledby="cash-flow-heading" className="rounded-3xl bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="q-section-label">Cash-flow preview</p><h2 id="cash-flow-heading" className="mt-1 text-xl font-semibold text-ink">Recent and expected collections</h2></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{currency}</span>
      </div>
      {hasData ? <div className="mt-7 grid h-48 grid-cols-4 items-end gap-3 sm:gap-5" role="img" aria-label={`Four-week cash-flow preview in ${currency}`}>
        {data.map((point) => <div key={point.label} className="flex h-full min-w-0 flex-col justify-end"><div className="flex h-36 items-end justify-center gap-1.5"><div className="w-3 rounded-t bg-cedar sm:w-5" style={{ height: `${Math.max(point.collected > 0 ? 5 : 0, point.collected / max * 100)}%` }} title={`Collected ${money(point.collected, currency)}`} /><div className="w-3 rounded-t bg-tomato/70 sm:w-5" style={{ height: `${Math.max(point.expected > 0 ? 5 : 0, point.expected / max * 100)}%` }} title={`Expected ${money(point.expected, currency)}`} /></div><p className="mt-3 truncate text-center text-xs text-slate-500">{point.label}</p></div>)}
      </div> : <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-10 text-center"><p className="font-semibold text-ink">Cash-flow activity will appear here.</p><p className="mt-2 text-sm text-slate-500">Create and collect invoices to build a short-term view.</p></div>}
      {hasData ? <div className="mt-4 flex gap-5 text-xs text-slate-500"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-cedar" />Collected</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-tomato/70" />Expected</span></div> : null}
    </section>
  );
}

const activityIcon = {
  payment_received: ReceiptText,
  proof_submitted: ShieldCheck,
  payment_approved: Check,
  payment_rejected: CircleAlert,
  invoice_created: FileText,
  invoice_viewed: FileText,
  receipt_viewed: ReceiptText
};

export function DashboardHome(props: {
  greeting: string;
  name: string;
  summary: string;
  capabilities: DashboardCapabilities;
  metrics: DashboardMetrics;
  attention: DerivedNotification[];
  activity: DashboardActivityItem[];
  onboardingState: DashboardOnboardingState;
  cashFlow: CashFlowPoint[];
  cashFlowCurrency: "USD" | "LBP";
  partialData: boolean;
}) {
  const showMetrics = props.capabilities.showFinancialSummary;
  return (
    <main className="mx-auto max-w-[1480px]">
      <header className="mb-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl"><p className="q-section-label">Home</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{props.greeting}, {props.name}.</h1><p className="mt-3 text-base leading-7 text-slate-600">{props.summary}</p></div>
        <div className="flex flex-wrap gap-2"><Link href={props.onboardingState.primaryAction.href} className="btn btn-primary">{props.onboardingState.primaryAction.label}</Link></div>
      </header>
      {props.onboardingState.showNewWorkspaceState ? <section className="mb-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">Start with {props.onboardingState.primaryAction.title}. <Link className="font-semibold text-cedar" href={props.onboardingState.primaryAction.href}>{props.onboardingState.primaryAction.label}</Link><Link className="ml-4 font-semibold text-cedar" href={props.onboardingState.notificationDestination}>Setup</Link></section> : null}
      {props.partialData ? <div className="mb-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">Some dashboard information could not be refreshed. Available data is shown below.</div> : null}
      {showMetrics ? <section aria-label="Financial summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Collected this month" value={groupedMoney(props.metrics.collected)} description="Accepted, non-voided payments confirmed this month." href="/reports" /><Metric label="Outstanding" value={groupedMoney(props.metrics.outstanding)} description="Remaining balance on active invoices." href="/invoices" /><Metric label="Overdue" value={groupedMoney(props.metrics.overdue)} description="Outstanding balance past its due date." href="/recoveries" /><Metric label="Expected in 7 days" value={groupedMoney(props.metrics.expectedNextSevenDays)} description="Open invoice balances due in the next seven days." href="/invoices" /></section> : null}
      <div className={`mt-7 grid gap-7 ${showMetrics ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]" : "max-w-4xl"}`}>
        <div className="space-y-7">
          {props.attention.length ? <section id="attention" aria-labelledby="attention-heading" className="overflow-hidden rounded-3xl bg-ink text-white shadow-card"><div className="flex items-start justify-between gap-4 px-5 pb-4 pt-6 sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-mint">Attention required</p><h2 id="attention-heading" className="mt-2 text-xl font-semibold">Keep collection moving</h2></div><Link href="/notifications" className="text-sm font-semibold text-white/75 hover:text-white">View all notifications</Link></div><div className="divide-y divide-white/10">{props.attention.map((item) => <Link key={item.id} href={item.destinationUrl} className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/[0.06] sm:px-6"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 truncate text-xs text-white/60">{item.description}</p></div><span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-mint">{item.actionLabel || "Open"}<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span></Link>)}</div></section> : null}
          {showMetrics ? <CashFlowPreview data={props.cashFlow} currency={props.cashFlowCurrency} /> : null}
        </div>
        {props.capabilities.showActivity ? <section aria-labelledby="activity-heading" className="rounded-3xl bg-white p-5 shadow-card sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="q-section-label">Latest</p><h2 id="activity-heading" className="mt-1 text-xl font-semibold text-ink">Recent activity</h2></div><Link href="/reports" className="text-xs font-semibold text-cedar">View all activity</Link></div>{props.activity.length ? <div className="mt-5 space-y-1">{props.activity.map((item) => { const Icon = activityIcon[item.type]; return <Link href={item.href} key={item.id} className="flex items-start gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-cedar"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-medium text-ink">{item.label}</span><span className="mt-1 block text-xs text-slate-500">{shortDate(item.timestamp)}</span></span></Link>})}</div> : <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center"><Clock3 className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-3 text-sm font-semibold text-ink">No recent activity yet</p><p className="mt-1 text-xs leading-5 text-slate-500">Meaningful invoice and payment updates will appear here.</p></div>}</section> : null}
      </div>
      {!showMetrics && !props.attention.length && !props.capabilities.showActivity ? <section className="max-w-2xl rounded-3xl bg-white p-8 text-center shadow-card"><Users className="mx-auto h-6 w-6 text-slate-400" /><h2 className="mt-3 text-lg font-semibold text-ink">Nothing needs your attention</h2><p className="mt-2 text-sm text-slate-500">Your permitted workspace updates will appear here when action is needed.</p></section> : null}
    </main>
  );
}
