/** Max decoded-ish size guard for data URLs (base64 payload + overhead). */
const MAX_DATA_URL_CHARS = 600_000;

const DATA_IMAGE_BASE64 = /^data:image\/(png|jpeg|jpg|webp)(;charset=[\w.-]+)?;base64,([\s\S]+)$/i;

function hasPathTraversal(path: string): boolean {
  const segments = path.split("/");
  for (const seg of segments) {
    if (seg === "..") return true;
  }
  return false;
}

export type SafeQrImageSrc =
  | { kind: "https"; href: string }
  | { kind: "relative"; path: string }
  | { kind: "data"; dataUrl: string };

/**
 * Normalize payment-method QR `src` for public display only.
 * Allows: https, same-origin path starting with / (not //), data:image/png|jpeg|jpg|webp;base64,...
 */
export function resolveSafeQrImageSrc(raw: string | null | undefined): SafeQrImageSrc | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim();
  if (!s) return null;

  const lower = s.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("file:") ||
    lower.startsWith("data:text/") ||
    lower.startsWith("data:application/") ||
    lower.startsWith("data:image/svg")
  ) {
    return null;
  }

  if (lower.startsWith("data:")) {
    if (s.length > MAX_DATA_URL_CHARS) return null;
    const m = DATA_IMAGE_BASE64.exec(s);
    if (!m) return null;
    const b64 = m[3].replace(/\s/g, "");
    if (!b64 || !/^[A-Za-z0-9+/]+=*$/.test(b64)) return null;
    return { kind: "data", dataUrl: s };
  }

  if (s.startsWith("/")) {
    if (s.startsWith("//")) return null;
    if (s.includes("\\") || s.includes("\0")) return null;
    if (hasPathTraversal(s)) return null;
    return { kind: "relative", path: s };
  }

  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    if (u.username || u.password) return null;
    return { kind: "https", href: u.href };
  } catch {
    return null;
  }
}

/** Public pay page: outbound payment links (e.g. OMT) — HTTPS only, no embedded credentials. */
export function resolveSafeHttpsPageUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("file:")
  ) {
    return null;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    if (u.username || u.password) return null;
    return u.href;
  } catch {
    return null;
  }
}
