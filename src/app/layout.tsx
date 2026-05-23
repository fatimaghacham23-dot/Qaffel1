import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
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
  const {
    data: { user }
  } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-[100dvh] bg-[var(--q-bg)] text-ink antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cedar focus:ring-offset-2"
        >
          Skip to content
        </a>
        <header
          data-app-header
          className="sticky top-0 z-40 w-full border-b border-slate-200/50 bg-white/[0.88] backdrop-blur-xl print:hidden"
          style={{ boxShadow: "0 1px 0 rgba(15, 23, 42, 0.03)" }}
        >
          <div className="flex w-full max-w-none items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8 2xl:px-10">
            <Link href="/" className="inline-flex min-h-10 items-center rounded-xl px-1 text-lg font-semibold tracking-tight text-ink transition-colors hover:text-cedar" style={{ transitionDuration: "var(--q-duration-normal)" }}>
              Qaffel
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link className="rounded-xl px-3.5 py-2 font-semibold text-slate-600 transition-[background-color,color] duration-q hover:bg-slate-100/70 hover:text-ink" href="/dashboard">
                Dashboard
              </Link>
              {!user && (
                <Link className="rounded-xl px-3.5 py-2 font-medium text-slate-600 transition-[background-color,color] hover:bg-slate-100/60 hover:text-ink" style={{ transitionDuration: "var(--q-duration-normal)" }} href="/login">
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
        <Analytics />
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
