export type CsvRow = Record<string, string | number | null | undefined>;

export function toCsv(rows: CsvRow[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const raw = row[header] ?? "";
          const text = String(raw).replaceAll('"', '""');
          return `"${text}"`;
        })
        .join(",")
    )
  ];

  return lines.join("\r\n");
}
