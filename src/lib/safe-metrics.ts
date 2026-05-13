/** Clamp to a finite number; non-finite → 0 */
export function finiteN(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/** YYYY-MM from an ISO-ish date string, or null if invalid / too short */
export function monthKeySafe(iso: string | null | undefined): string | null {
  if (!iso || typeof iso !== "string" || iso.length < 7) return null;
  const probe = iso.includes("T") ? iso : `${iso}T12:00:00`;
  const t = new Date(probe).getTime();
  if (!Number.isFinite(t)) return null;
  return iso.slice(0, 7);
}

export function safePercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  const p = Math.round(Math.min(999, Math.max(-999, ratio * 100)));
  return `${p}%`;
}

export function safeDays(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${finiteN(value).toFixed(decimals)} days`;
}

export function safeHours(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(finiteN(value))}h`;
}

export function safeDaysFromHours(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(finiteN(value) / 24).toFixed(1)}d`;
}

export function csvNumber(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return (0).toFixed(decimals);
  return finiteN(n).toFixed(decimals);
}

export function csvEscapeCell(s: string): string {
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
