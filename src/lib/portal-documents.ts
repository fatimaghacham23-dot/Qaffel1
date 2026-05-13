export function isPortalDocumentsEmpty(rows: unknown[] | null | undefined): boolean {
  return !rows || rows.length === 0;
}
