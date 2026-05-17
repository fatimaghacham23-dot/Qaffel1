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
  Inbox,
  Landmark,
  LayoutDashboard,
  Network,
  ReceiptText,
  SlidersHorizontal,
  UserCircle,
  Users,
  UsersRound
} from "lucide-react";
import { SignOutButton } from "@/components/SignOutButton";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Attention", icon: Inbox },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/invoices", label: "Invoices", icon: ReceiptText },
      { href: "/recoveries", label: "Recovery center", icon: CircleDollarSign },
      { href: "/proofs", label: "Proofs", icon: FileCheck2 },
      { href: "/finance", label: "Finance close", icon: Landmark }
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
      { href: "/settings/profile", label: "Profile", icon: UserCircle },
      { href: "/team", label: "Team", icon: UsersRound }
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
  { href: "/inbox", label: "Attention", icon: Inbox },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/proofs", label: "Proofs", icon: FileCheck2 },
  { href: "/finance", label: "Finance", icon: Landmark }
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto grid min-w-0 w-full max-w-none gap-6 px-4 py-6 pb-[max(6.5rem,calc(env(safe-area-inset-bottom,0px)+6rem))] sm:px-6 md:grid-cols-[256px_minmax(0,1fr)] md:gap-8 md:pb-8 lg:px-8 2xl:px-10 print:block print:max-w-none print:p-0">
      <aside className="hidden h-fit rounded-2xl border border-slate-200/50 bg-white/[0.88] p-4 backdrop-blur-xl print:hidden md:sticky md:top-[4.5rem] md:block" style={{ boxShadow: "var(--q-shadow-card)" }}>
        <div className="mb-5 rounded-2xl border border-white/15 bg-gradient-to-br from-cedar via-[#174f52] to-ink p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Qaffel</p>
          <p className="mt-1.5 text-lg font-semibold tracking-tight">Operations OS</p>
          <p className="mt-2.5 text-xs leading-relaxed text-white/60">Calm command center for invoices, proofs, and collections.</p>
        </div>

        <nav className="grid gap-5" aria-label="Workspace navigation">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400/80">
                {group.label}
              </p>
              <div className="grid gap-0.5">
                {group.items.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-[background-color,color,box-shadow,transform] duration-q ease-q hover:bg-slate-50/80 hover:text-ink",
                        active && "bg-cedar/[0.08] font-semibold text-cedar shadow-[inset_0_0_0_1px_rgba(17,100,102,0.12)]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-xl border border-slate-200/70 bg-white text-slate-500 shadow-xs transition duration-q group-hover:border-slate-200 group-hover:text-ink",
                          active && "border-cedar/18 bg-white text-cedar shadow-[0_6px_18px_-14px_rgba(17,100,102,0.7)]"
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

        <div className="mt-5 border-t border-slate-100/50 pt-4">
          <SignOutButton />
        </div>
      </aside>

      <section className="min-w-0 w-full max-w-none q-safe-bottom">{children}</section>

      <nav
        aria-label="Primary mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/50 bg-white/[0.92] px-2 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-xl md:hidden print:hidden"
        style={{ boxShadow: "0 -8px 32px -8px rgba(15, 23, 42, 0.08), 0 -1px 0 rgba(15, 23, 42, 0.04)" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5">
          {mobileNavItems.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.75rem] touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-slate-500 transition-[background-color,color,transform] duration-q active:scale-[0.96]",
                  active ? "bg-cedar/[0.08] text-cedar" : "hover:bg-slate-50 hover:text-ink"
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform", active && "scale-105")} style={{ transitionDuration: "var(--q-duration-fast)", transitionTimingFunction: "var(--q-ease-spring)" }} aria-hidden="true" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
