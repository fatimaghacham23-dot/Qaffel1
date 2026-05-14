import type { CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENT_THEMES = ["minimal", "professional", "soft", "modern", "executive"] as const;
export type DocumentTheme = (typeof DOCUMENT_THEMES)[number];

const HEX = /^#([0-9a-fA-F]{6})$/;

export function sanitizeHexColor(value: string | null | undefined, fallback: string): string {
  const v = (value || "").trim();
  if (!HEX.test(v)) return fallback;
  return v.toLowerCase();
}

export function normalizeDocumentTheme(value: string | null | undefined): DocumentTheme {
  const v = (value || "").toLowerCase().trim();
  return (DOCUMENT_THEMES as readonly string[]).includes(v) ? (v as DocumentTheme) : "professional";
}

export function monogramFromName(name: string | null | undefined): string {
  const n = (name || "Q").trim();
  return n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export async function signBrandLogoUrl(
  supabase: Pick<SupabaseClient, "storage">,
  path: string | null | undefined,
  expiresSec = 3600
): Promise<string | null> {
  if (!path || typeof path !== "string") return null;
  const { data, error } = await supabase.storage.from("business-brand").createSignedUrl(path, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function brandCssVars(primary: string, accent: string | null | undefined): CSSProperties {
  const a = accent && HEX.test(accent.trim()) ? accent.trim().toLowerCase() : primary;
  return {
    ["--brand-primary" as string]: primary,
    ["--brand-accent" as string]: a
  };
}
