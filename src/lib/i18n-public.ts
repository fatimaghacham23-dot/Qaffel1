export type PublicLang = "en" | "ar";

/** Bilingual-ready copy: default English; Arabic added later without rewrites at call sites. */
export function publicCopy(en: string, ar?: string): { en: string; ar?: string } {
  return { en, ar };
}

export function pickPublicString(block: { en: string; ar?: string }, lang: PublicLang = "en") {
  if (lang === "ar" && block.ar) return block.ar;
  return block.en;
}
