import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";
import { CommandCenter } from "@/components/CommandCenter";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Qaffel",
  description: "Payment tracking for Lebanese freelancers and small businesses"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-[100dvh] bg-[var(--q-bg)] text-ink antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cedar focus:ring-offset-2"
        >
          Skip to content
        </a>
        <header
          data-app-header
          className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/[0.88] shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl print:hidden"
        >
          <div className="flex w-full max-w-none items-center justify-between px-4 py-3 sm:px-5 lg:px-7 2xl:px-9">
            <Link href="/" className="inline-flex min-h-10 items-center rounded-xl px-1 text-lg font-bold text-ink transition hover:text-cedar">
              Qaffel
            </Link>
            <nav className="flex items-center gap-1.5 text-sm">
              <Link className="rounded-xl px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100/80 hover:text-ink" href="/dashboard">
                Dashboard
              </Link>
              {!user && (
                <Link className="rounded-xl px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100/80 hover:text-ink" href="/login">
                  Login
                </Link>
              )}
            </nav>
          </div>
        </header>
        <div id="main-content" className="outline-none" tabIndex={-1}>
          {children}
        </div>
        <CommandCenter />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
