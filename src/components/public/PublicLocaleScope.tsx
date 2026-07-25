"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PublicLang } from "@/lib/i18n-public";
import { publicLocaleDirection, publicLocaleHref } from "@/lib/public-locale";

export function PublicLocaleScope({ lang, pathname, children }: { lang: PublicLang; pathname: string; children: ReactNode }) {
  const direction = publicLocaleDirection(lang);
  const searchParams = useSearchParams();

  useEffect(() => {
    const root = document.documentElement;
    const previousLang = root.lang;
    const previousDir = root.dir;
    root.lang = lang;
    root.dir = direction;
    return () => {
      root.lang = previousLang;
      root.dir = previousDir;
    };
  }, [direction, lang]);

  return (
    <div lang={lang} dir={direction} className={lang === "ar" ? "font-arabic" : undefined}>
      <div className="mx-auto flex max-w-4xl justify-end px-5 pt-3 sm:px-6" dir="ltr">
        <Link
          href={publicLocaleHref(pathname, lang === "ar" ? "en" : "ar", new URLSearchParams(searchParams.toString()))}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 underline-offset-2 hover:text-ink hover:underline"
          aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          {lang === "ar" ? "English" : "العربية"}
        </Link>
      </div>
      {children}
    </div>
  );
}
