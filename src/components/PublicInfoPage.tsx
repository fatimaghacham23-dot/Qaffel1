import Link from "next/link";
import { legalReviewNotice, publicSiteConfig } from "@/lib/public-site";

export function PublicInfoPage({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-[calc(100dvh-4rem)] bg-[var(--q-bg)] px-5 py-14 sm:px-8"><article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-10"><Link href="/" className="text-sm font-semibold text-cedar">Qaffel</Link><h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink">{title}</h1><div className="mt-6 space-y-4 text-sm leading-7 text-slate-700">{children}</div><p className="mt-8 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">{legalReviewNotice}</p>{publicSiteConfig.supportEmail ? <a className="mt-4 inline-block text-sm font-semibold text-cedar" href={`mailto:${publicSiteConfig.supportEmail}`}>Contact support</a> : null}</article></main>;
}
