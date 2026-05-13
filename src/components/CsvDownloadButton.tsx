"use client";

import { toCsv, type CsvRow } from "@/lib/csv";

export function CsvDownloadButton({
  rows,
  label = "Download CSV",
  className = "btn btn-primary",
  filename = "qaffel-export"
}: {
  rows: CsvRow[];
  label?: string;
  className?: string;
  filename?: string;
}) {
  function download() {
    const csv = toCsv(rows);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <button className={className} disabled={rows.length === 0} onClick={download} type="button">
      {label}
    </button>
  );
}
