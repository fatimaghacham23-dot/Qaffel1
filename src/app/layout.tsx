import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";
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
      <body>
        <header className="w-full border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
          <div className="flex w-full max-w-none items-center justify-between px-3 py-3 sm:px-4 lg:px-6 2xl:px-8">
            <Link href="/" className="text-lg font-bold text-ink">
              Qaffel
            </Link>
            <nav className="flex items-center gap-2 text-sm">
              <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/dashboard">
                Dashboard
              </Link>
              {!user && (
                <Link className="rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100" href="/login">
                  Login
                </Link>
              )}
            </nav>
          </div>
        </header>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
