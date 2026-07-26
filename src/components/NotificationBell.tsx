"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import type { DerivedNotification } from "@/lib/notifications";

export function notificationBadgeLabel(count: number) {
  if (count <= 0) return "0";
  return count > 99 ? "99+" : String(count);
}

export function NotificationBell({ items, actionCount }: { items: DerivedNotification[]; actionCount: number }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const preview = items.filter((item) => item.severity !== "info").slice(0, 5);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.removeEventListener("mousedown", onPointerDown); };
  }, [open]);

  return <div className="relative">
    <button ref={buttonRef} type="button" aria-label={actionCount ? `Notifications: ${notificationBadgeLabel(actionCount)} needs attention` : "Notifications: no actions need attention"} aria-expanded={open} aria-controls="notification-preview" onClick={() => setOpen((value) => !value)} className="relative grid h-11 w-11 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar">
      <Bell className="h-5 w-5" aria-hidden="true" />
      <span className="sr-only">{actionCount ? `${notificationBadgeLabel(actionCount)} needs attention` : "No actions need attention"}</span>
      {actionCount > 0 ? <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-tomato px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">{notificationBadgeLabel(actionCount)}</span> : null}
    </button>
    {open ? <div ref={popoverRef} id="notification-preview" role="dialog" aria-label="Notifications preview" className="absolute end-0 top-full z-[60] mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-modal" dir="auto">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div><p className="text-sm font-semibold text-ink">Needs attention</p><p className="text-xs text-slate-500">{actionCount ? `${notificationBadgeLabel(actionCount)} action item${actionCount === 1 ? "" : "s"}` : "No actions need attention"}</p></div>
        <button type="button" aria-label="Close notifications" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>
      {preview.length ? <ul className="max-h-[min(60vh,24rem)] divide-y divide-slate-100 overflow-y-auto p-1.5">{preview.map((item) => <li key={item.id}><Link href={item.destinationUrl} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cedar"><p className="text-sm font-semibold text-ink">{item.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.description}</p></Link></li>)}</ul> : <div className="px-5 py-9 text-center"><p className="text-sm font-semibold text-ink">You’re all caught up</p><p className="mt-1 text-xs leading-5 text-slate-500">No actions need attention right now.</p></div>}
      <div className="border-t border-slate-100 p-3"><Link href="/notifications" onClick={() => setOpen(false)} className="btn btn-secondary w-full text-sm">View all notifications</Link></div>
    </div> : null}
  </div>;
}
