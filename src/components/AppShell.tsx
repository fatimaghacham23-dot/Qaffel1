"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
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
    items: [{ href: "/export", label: "Export", icon: Download }]
  }
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="mx-auto grid min-w-0 w-full max-w-none gap-6 px-3 py-6 sm:px-4 md:grid-cols-[250px_minmax(0,1fr)] lg:px-6 2xl:px-8 print:block print:max-w-none print:p-0">
      <aside className="h-fit rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-soft backdrop-blur print:hidden md:sticky md:top-6">
        <div className="mb-4 rounded-xl bg-gradient-to-br from-cedar to-ink p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Qaffel</p>
          <p className="mt-1 text-lg font-bold">Workspace</p>
        </div>

        <nav className="grid gap-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
                      className={cn(
                        "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-ink",
                        active && "bg-cedar/10 text-cedar shadow-[inset_0_0_0_1px_rgba(17,100,102,0.12)]"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition group-hover:text-ink",
                          active && "border-cedar/20 bg-white text-cedar"
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

      <section className="min-w-0 w-full max-w-none">{children}</section>
    </main>
  );
}
