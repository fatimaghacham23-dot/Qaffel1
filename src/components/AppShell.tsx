"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDollarSign, FileSpreadsheet, LayoutDashboard, Menu, ReceiptText, Settings, Users, X } from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { mobileNavigationForRole, navigationForRole } from "@/lib/information-architecture";
import type { WorkspaceRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const icons = { home: LayoutDashboard, invoices: ReceiptText, payments: CircleDollarSign, clients: Users, reports: FileSpreadsheet, team: Users, settings: Settings };
const active = (pathname: string, href: string) => href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

export function AppShell({ children, role = "owner" }: { children: React.ReactNode; role?: WorkspaceRole | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const desktopItems = navigationForRole(role);
  const mobileItems = mobileNavigationForRole(role);
  const moreItems = desktopItems.filter((item) => !item.mobile);
  const linkClass = (selected: boolean) => cn("group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-ink", selected && "bg-cedar/[0.08] font-semibold text-cedar");

  return <main className="mx-auto grid min-w-0 w-full max-w-none gap-6 px-4 py-6 pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+6rem))] sm:px-6 md:grid-cols-[256px_minmax(0,1fr)] md:gap-8 md:pb-8 lg:px-8 2xl:px-10 print:block print:max-w-none print:p-0">
    <aside className="hidden h-fit rounded-2xl border border-slate-200/50 bg-white/[0.88] p-4 backdrop-blur-xl print:hidden md:sticky md:top-[4.5rem] md:block" style={{ boxShadow: "var(--q-shadow-card)" }}>
      <div className="mb-5 rounded-2xl border border-white/15 bg-gradient-to-br from-cedar via-[#174f52] to-ink p-4 text-white"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Qaffel</p><p className="mt-1.5 text-lg font-semibold tracking-tight">Collections</p><p className="mt-2.5 text-xs leading-relaxed text-white/60">Invoices, payment review, and clear follow-up.</p></div>
      <nav className="grid gap-0.5" aria-label="Workspace navigation">{desktopItems.map((item) => { const Icon = icons[item.id]; const selected = active(pathname, item.href); return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={linkClass(selected)}><span className={cn("grid h-8 w-8 place-items-center rounded-xl border border-slate-200/70 bg-white text-slate-500", selected && "border-cedar/18 text-cedar")}><Icon className="h-4 w-4" /></span><span>{item.label}</span></Link>; })}</nav>
      <div className="mt-5 border-t border-slate-100/50 pt-4"><SignOutButton /></div>
    </aside>
    <section className="min-w-0 w-full max-w-none q-safe-bottom">{children}</section>
    <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/50 bg-white/[0.92] px-2 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl md:hidden print:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">{mobileItems.map((item) => { const Icon = icons[item.id]; const selected = active(pathname, item.href); return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={cn("flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-slate-500", selected && "bg-cedar/[0.08] text-cedar")}><Icon className="h-5 w-5" /><span>{item.label}</span></Link>; })}<button aria-expanded={moreOpen} className={cn("flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-slate-500", moreOpen && "bg-cedar/[0.08] text-cedar")} onClick={() => setMoreOpen((open) => !open)} type="button">{moreOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}<span>More</span></button></div>
      {moreOpen ? <div className="absolute bottom-[calc(100%+0.5rem)] right-3 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">{moreItems.map((item) => { const Icon = icons[item.id]; return <Link key={item.id} href={item.href} onClick={() => setMoreOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Icon className="h-4 w-4 text-slate-500" />{item.label}</Link>; })}</div> : null}
    </nav>
  </main>;
}
