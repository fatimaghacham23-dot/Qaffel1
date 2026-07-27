"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CircleDollarSign, FileSpreadsheet, LayoutDashboard, Menu, ReceiptText, Settings, Users, X } from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { mobileNavigationForRole, navigationForRole } from "@/lib/information-architecture";
import type { WorkspaceRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const icons = { home: LayoutDashboard, invoices: ReceiptText, payments: CircleDollarSign, clients: Users, reports: FileSpreadsheet, team: Users, settings: Settings, notifications: Bell };
const active = (pathname: string, href: string) => href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");

export function AppShell({ children, role = "owner" }: { children: React.ReactNode; role?: WorkspaceRole | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const desktopItems = navigationForRole(role);
  const mobileItems = mobileNavigationForRole(role);
  const moreItems = desktopItems.filter((item) => !item.mobile);
  const linkClass = (selected: boolean) => cn("group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar focus-visible:ring-offset-2", selected && "bg-cedar/[0.08] font-semibold text-cedar");
  const prefetch = (href: string) => router.prefetch(href);
  const intent = (href: string) => ({ onMouseEnter: () => prefetch(href), onFocus: () => prefetch(href), onTouchStart: () => prefetch(href) });

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const fallbackFocus = drawerTriggerRef.current;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setMoreOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])') || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    drawerCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      (previousFocusRef.current || fallbackFocus)?.focus();
    };
  }, [moreOpen]);

  return <main className="mx-auto grid min-w-0 w-full max-w-none gap-6 px-4 py-6 pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+6rem))] sm:px-6 md:grid-cols-[256px_minmax(0,1fr)] md:gap-8 md:pb-8 lg:px-8 2xl:px-10 print:block print:max-w-none print:p-0">
    <aside className="hidden h-fit rounded-2xl border border-slate-200/50 bg-white/[0.88] p-4 backdrop-blur-xl print:hidden md:sticky md:top-[4.5rem] md:block" style={{ boxShadow: "var(--q-shadow-card)" }}>
      <div className="mb-5 rounded-2xl border border-white/15 bg-gradient-to-br from-cedar via-[#174f52] to-ink p-4 text-white"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Qaffel</p><p className="mt-1.5 text-lg font-semibold tracking-tight">Collections</p><p className="mt-2.5 text-xs leading-relaxed text-white/60">Invoices, payment review, and clear follow-up.</p></div>
      <nav className="grid gap-0.5" aria-label="Workspace navigation">{desktopItems.map((item) => { const Icon = icons[item.id]; const selected = active(pathname, item.href); return <Link key={item.href} href={item.href} prefetch {...intent(item.href)} aria-current={selected ? "page" : undefined} className={linkClass(selected)}><span className={cn("grid h-8 w-8 place-items-center rounded-xl border border-slate-200/70 bg-white text-slate-500", selected && "border-cedar/18 text-cedar")}><Icon className="h-4 w-4" /></span><span>{item.label}</span></Link>; })}</nav>
      <div className="mt-5 border-t border-slate-100/50 pt-4"><SignOutButton /></div>
    </aside>
    <section className="min-w-0 w-full max-w-none q-safe-bottom">{children}</section>
    <button ref={drawerTriggerRef} aria-controls="mobile-navigation-drawer" aria-expanded={moreOpen} aria-label="Open navigation menu" className="fixed end-4 top-[5.25rem] z-30 grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-ink shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar focus-visible:ring-offset-2 md:hidden print:hidden" onClick={() => setMoreOpen(true)} type="button"><Menu className="h-5 w-5" /></button>
    <nav aria-label="Primary mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/50 bg-white/[0.92] px-2 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl md:hidden print:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">{mobileItems.map((item) => { const Icon = icons[item.id]; const selected = active(pathname, item.href); return <Link key={item.href} href={item.href} prefetch {...intent(item.href)} aria-current={selected ? "page" : undefined} className={cn("flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar", selected && "bg-cedar/[0.08] text-cedar")}><Icon className="h-5 w-5" /><span>{item.label}</span></Link>; })}<button aria-expanded={moreOpen} className={cn("flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar", moreOpen && "bg-cedar/[0.08] text-cedar")} onClick={() => setMoreOpen((open) => !open)} type="button">{moreOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}<span>More</span></button></div>
    </nav>
    {moreOpen ? <div className="fixed inset-0 z-50 md:hidden print:hidden" role="dialog" aria-modal="true" aria-label="Workspace navigation"><button aria-label="Close navigation menu" className="absolute inset-0 h-full w-full bg-ink/35" onClick={() => setMoreOpen(false)} type="button" /><aside ref={drawerRef} id="mobile-navigation-drawer" className="q-mobile-navigation-drawer absolute inset-y-0 end-0 flex w-[min(22rem,calc(100vw-2rem))] flex-col border-s border-slate-200 bg-white p-5 shadow-modal"><div className="mb-5 flex items-center justify-between"><p className="text-lg font-semibold text-ink">Navigation</p><button ref={drawerCloseRef} aria-label="Close navigation menu" className="grid h-11 w-11 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar" onClick={() => setMoreOpen(false)} type="button"><X className="h-5 w-5" /></button></div><nav className="grid gap-1" aria-label="More workspace navigation">{moreItems.map((item) => { const Icon = icons[item.id]; const selected = active(pathname, item.href); return <Link key={item.id} href={item.href} prefetch {...intent(item.href)} onClick={() => setMoreOpen(false)} aria-current={selected ? "page" : undefined} className={linkClass(selected)}><Icon className="h-5 w-5" />{item.label}</Link>; })}</nav><div className="mt-auto border-t border-slate-100 pt-4"><SignOutButton /></div></aside></div> : null}
  </main>;
}
