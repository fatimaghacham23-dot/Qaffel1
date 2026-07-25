import "server-only";
import { getCanonicalAppUrl } from "@/lib/urls";

function localOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function trustedRedirectUrl(candidate: string | null | undefined, fallbackPath = "/") {
  const fallback = new URL(fallbackPath, `${getCanonicalAppUrl()}/`).toString();
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate);
    const canonical = new URL(getCanonicalAppUrl());
    if (url.origin === canonical.origin) return url.toString();
    if (process.env.NODE_ENV !== "production" && localOrigin(url.origin)) return url.toString();
  } catch {
    return fallback;
  }

  return fallback;
}
