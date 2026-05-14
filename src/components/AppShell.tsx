"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDollarSign,
  CreditCard,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  Network,
  ReceiptText,
  SlidersHorizontal,
  UserCircle,
  Users
} from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/invoices", label: "Invoices", icon: ReceiptText },
      { href: "/recoveries", label: "Recovery center", icon: CircleDollarSign },
      { href: "/proofs", label: "Proofs", icon: FileCheck2 }
    ]
  },
  {
    label: "Intelligence",
    items: [
      { href: "/reports", label: "Reports", icon: FileSpreadsheet },
      { href: "/intelligence/deep", label: "Deep filters", icon: Filter }
    ]
  },
  {
    label: "Settings",
    items: [
      { href: "/settings/payment-methods", label: "Methods", icon: CreditCard },
      { href: "/settings/service-presets", label: "Service presets", icon: SlidersHorizontal },
      { href: "/settings/profile", label: "Profile", icon: UserCircle }
    ]
  },
  {
    label: "Tools",
    items: [
      { href: "/connectivity", label: "Connectivity", icon: Network },
      { href: "/export", label: "Export", icon: Download }
    ]
  }
];

const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/proofs", label: "Proofs", icon: FileCheck2 },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/recoveries", label: "Recover", icon: CircleDollarSign }
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto grid min-w-0 w-full max-w-none gap-5 px-4 py-5 pb-[max(6rem,calc(env(safe-area-inset-bottom,0px)+5.5rem))] sm:px-5 md:grid-cols-[248px_minmax(0,1fr)] md:gap-6 md:pb-8 lg:px-7 2xl:px-9 print:block print:max-w-none print:p-0">
      <aside className="hidden h-fit rounded-3xl border border-slate-200/75 bg-white/[0.88] p-3 shadow-card backdrop-blur-xl print:hidden md:sticky md:top-20 md:block">
        <div className="mb-4 rounded-2xl border border-white/15 bg-gradient-to-br from-cedar via-[#174f52] to-ink p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Qaffel</p>
          <p className="mt-1 text-lg font-bold">Operations OS</p>
          <p className="mt-2 text-xs leading-relaxed text-white/70">Calm command center for invoices, proofs, and collections.</p>
        </div>

        <nav className="grid gap-4" aria-label="Workspace navigation">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {group.label}
              </p>
              <div className="grid gap-1">
                {group.items.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold text-slate-600 transition-[background-color,color,box-shadow,transform] duration-q ease-q hover:bg-slate-50 hover:text-ink hover:shadow-sm",
                        active && "bg-cedar/10 text-cedar shadow-[inset_0_0_0_1px_rgba(17,100,102,0.14)]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-xl border border-slate-200/80 bg-white text-slate-500 shadow-sm transition group-hover:border-slate-300 group-hover:text-ink",
                          active && "border-cedar/20 bg-white text-cedar shadow-[0_8px_20px_-16px_rgba(17,100,102,0.8)]"
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <SignOutButton />
        </div>
      </aside>

      <section className="min-w-0 w-full max-w-none q-safe-bottom">{children}</section>

      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/[0.92] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2 shadow-[0_-14px_36px_-24px_rgba(15,23,42,0.38)] backdrop-blur-xl md:hidden print:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 touch-manipulation flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold text-slate-500 transition-[background-color,color,transform] duration-q",
                  active ? "bg-cedar/10 text-cedar" : "hover:bg-slate-50 hover:text-ink"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
