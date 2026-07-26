import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/layout/SectionCard";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { filterNotifications, notificationFilter, type DerivedNotification, type NotificationFilter } from "@/lib/notifications";
import { getWorkspaceNotifications } from "@/lib/notifications-server";
import { requireUser } from "@/lib/supabase/server";

const filters: { id: NotificationFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "action", label: "Action required" }, { id: "onboarding", label: "Onboarding" }, { id: "payments", label: "Payments" }, { id: "team", label: "Team" }, { id: "system", label: "System" }];
const filterHref = (filter: NotificationFilter) => filter === "all" ? "/notifications" : `/notifications?filter=${filter}`;
function sectionItems(items: DerivedNotification[], section: "action" | "onboarding" | "payments" | "team" | "system") {
  if (section === "action") return items.filter((item) => item.severity !== "info");
  if (section === "payments") return items.filter((item) => item.category === "payments" || item.category === "collections");
  return items.filter((item) => item.category === section);
}
function NotificationRows({ items, empty }: { items: DerivedNotification[]; empty: string }) {
  if (!items.length) return <p className="py-5 text-sm text-slate-600">{empty}</p>;
  return <ul className="divide-y divide-slate-100" aria-label="Notifications">{items.map((item) => <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-semibold text-ink">{item.title}</p><p className="mt-1 text-sm leading-relaxed text-slate-600">{item.description}</p></div><Link href={item.destinationUrl} className="btn btn-secondary shrink-0 text-sm">{item.actionLabel || "Open"}</Link></li>)}</ul>;
}
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const [{ supabase }, ctx, params] = await Promise.all([requireUser(), getWorkspaceContext(), searchParams]);
  const activeFilter = notificationFilter(params.filter);
  const filtered = filterNotifications(await getWorkspaceNotifications(supabase, ctx), activeFilter);
  return <AppShell role={ctx.role}><PageContainer width="default" className="space-y-5"><PageHeader eyebrow="Workspace" title="Notifications" description="Action items are derived from your current workspace state and are not stored." /><nav className="flex flex-wrap gap-2" aria-label="Notification filters">{filters.map((filter) => <Link key={filter.id} href={filterHref(filter.id)} aria-current={activeFilter === filter.id ? "page" : undefined} className={activeFilter === filter.id ? "btn btn-primary text-xs" : "btn btn-secondary text-xs"}>{filter.label}</Link>)}</nav><SectionCard title="Action required"><NotificationRows items={sectionItems(filtered, "action")} empty="No actions require attention right now." /></SectionCard><SectionCard title="Onboarding"><NotificationRows items={sectionItems(filtered, "onboarding")} empty="No onboarding items match this filter." /></SectionCard><SectionCard title="Payments and collections"><NotificationRows items={sectionItems(filtered, "payments")} empty="No payment or collection items match this filter." /></SectionCard><SectionCard title="Team and operations"><NotificationRows items={sectionItems(filtered, "team")} empty="No team or operational items match this filter." /></SectionCard><SectionCard title="System"><NotificationRows items={sectionItems(filtered, "system")} empty="No system notifications are available." /></SectionCard></PageContainer></AppShell>;
}
