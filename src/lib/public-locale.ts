import type { PublicLang } from "@/lib/i18n-public";

export function resolvePublicLang(value: string | undefined | null): PublicLang {
  return value === "ar" ? "ar" : "en";
}

export function publicLocaleDirection(lang: PublicLang) {
  return lang === "ar" ? "rtl" : "ltr";
}

export function publicLocaleHref(pathname: string, lang: PublicLang, search?: URLSearchParams) {
  const params = new URLSearchParams(search);
  params.set("lang", lang);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
