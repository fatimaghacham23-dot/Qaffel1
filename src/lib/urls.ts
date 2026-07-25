export type PublicLocale = "en" | "ar";

function configuredBaseUrl() {
  const explicit = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (explicit) return explicit;
  return process.env.NODE_ENV === "production" ? "https://qaffel.online" : "http://localhost:3000";
}

export function getCanonicalAppUrl() {
  const raw = configuredBaseUrl();
  const withProtocol = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  if (process.env.NODE_ENV === "production" && url.hostname === "localhost") return "https://qaffel.online";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function buildAbsoluteUrl(path: string, params?: Record<string, string | null | undefined>) {
  const url = new URL(path.replace(/^\/+/, ""), `${getCanonicalAppUrl()}/`);
  for (const [key, value] of Object.entries(params || {})) if (value) url.searchParams.set(key, value);
  return url.toString();
}

function withLocale(path: string, token: string, locale?: PublicLocale) {
  return buildAbsoluteUrl(path.replace(":token", encodeURIComponent(token)), locale ? { lang: locale } : undefined);
}

export function buildPaymentUrl(token: string, locale?: PublicLocale) { return withLocale("pay/:token", token, locale); }
export function buildReceiptUrl(token: string, locale?: PublicLocale) { return withLocale("receipt/:token", token, locale); }
export function buildClientPortalUrl(token: string, locale?: PublicLocale) { return withLocale("client/:token", token, locale); }
export function buildSharedReportUrl(token: string, locale?: PublicLocale) { return withLocale("share/report/:token", token, locale); }