"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileUp, RotateCcw, TableProperties } from "lucide-react";
import { importConnectivityCsvAction } from "@/app/actions";

type ImportMode = "clients" | "invoices";
type ParsedRow = Record<string, string>;

function parseCsv(text: string): ParsedRow[] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  const [headers = [], ...body] = rows;
  return body.map((cells) =>
    headers.reduce<ParsedRow>((acc, header, index) => {
      if (header) acc[header.trim().toLowerCase()] = cells[index]?.trim() || "";
      return acc;
    }, {})
  );
}

function validateRows(mode: ImportMode, rows: ParsedRow[]) {
  const warnings: string[] = [];
  const valid = rows.filter((row, index) => {
    if (mode === "clients") {
      const name = row.name || row.client || row["client name"];
      if (!name) {
        warnings.push(`Row ${index + 2}: missing client name.`);
        return false;
      }
      if (!row.email && !row.phone && !row.whatsapp) {
        warnings.push(`Row ${index + 2}: no email or phone. It can import, but follow-up will be limited.`);
      }
      return true;
    }

    const title = row.title || row.description || row["invoice title"];
    const amount = row.amount_usd || row["amount usd"] || row.usd || row.amount_lbp || row["amount lbp"] || row.lbp;
    if (!title || !amount) {
      warnings.push(`Row ${index + 2}: invoice imports need a title and at least one amount.`);
      return false;
    }
    if (row.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.due_date)) {
      warnings.push(`Row ${index + 2}: due_date should use YYYY-MM-DD. It will be ignored if invalid.`);
    }
    return true;
  });

  return { valid, warnings };
}

export function ConnectivityImportTool() {
  const [mode, setMode] = useState<ImportMode>("clients");
  const [raw, setRaw] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const rows = useMemo(() => parseCsv(raw).slice(0, 100), [raw]);
  const { valid, warnings } = useMemo(() => validateRows(mode, rows), [mode, rows]);

  const sample =
    mode === "clients"
      ? "name,email,phone,notes\nMira Studio,mira@example.com,03123456,VIP client"
      : "title,client_name,amount_usd,amount_lbp,currency,due_date,description\nWebsite retainer,Mira Studio,500,,USD,2026-05-31,Imported as draft";

  return (
    <section className="q-surface p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="q-section-label">Workspace imports</p>
          <h2 className="q-title-sm mt-1">CSV import preview</h2>
          <p className="q-body-muted mt-1 max-w-2xl">
            Validate rows, preview conflicts, then import manually. Existing client names are skipped; invoice rows become drafts.
          </p>
        </div>
        <span className="q-chip">No bulk overwrite</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className={`rounded-2xl border p-3 text-left ${mode === "clients" ? "border-cedar/40 bg-cedar/5" : "border-slate-200 bg-white"}`}
          onClick={() => {
            setMode("clients");
            setConfirmed(false);
          }}
        >
          <span className="text-sm font-bold text-ink">Client import</span>
          <span className="mt-1 block text-xs text-slate-600">Name, phone, email, and notes.</span>
        </button>
        <button
          type="button"
          className={`rounded-2xl border p-3 text-left ${mode === "invoices" ? "border-cedar/40 bg-cedar/5" : "border-slate-200 bg-white"}`}
          onClick={() => {
            setMode("invoices");
            setConfirmed(false);
          }}
        >
          <span className="text-sm font-bold text-ink">Invoice draft import</span>
          <span className="mt-1 block text-xs text-slate-600">Creates draft invoices only. Nothing is sent.</span>
        </button>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="csv-import">
          CSV rows
        </label>
        <textarea
          id="csv-import"
          className="field min-h-44 font-mono text-xs"
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setConfirmed(false);
          }}
          placeholder={sample}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-xs" onClick={() => setRaw(sample)}>
            <TableProperties className="h-4 w-4" aria-hidden />
            Load sample
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => {
              setRaw("");
              setConfirmed(false);
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Cancel preview
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Parsed</p>
          <p className="mt-1 text-lg font-bold text-ink">{rows.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Valid</p>
          <p className="mt-1 text-lg font-bold text-emerald-800">{valid.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Warnings</p>
          <p className="mt-1 text-lg font-bold text-amber-800">{warnings.length}</p>
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Review before import
          </p>
          <ul className="mt-2 grid gap-1 text-xs text-amber-900">
            {warnings.slice(0, 6).map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {valid.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Preview first {Math.min(5, valid.length)} rows
          </div>
          <div className="grid gap-2 p-3">
            {valid.slice(0, 5).map((row, index) => (
              <div key={`${index}-${JSON.stringify(row)}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {Object.entries(row)
                  .slice(0, 5)
                  .map(([key, value]) => `${key}: ${value || "-"}`)
                  .join(" | ")}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <form action={importConnectivityCsvAction} className="mt-4">
        <input type="hidden" name="import_mode" value={mode} />
        <input type="hidden" name="rows_json" value={JSON.stringify(valid)} />
        {!confirmed ? (
          <button type="button" className="btn btn-secondary w-full" disabled={valid.length === 0} onClick={() => setConfirmed(true)}>
            Review complete - enable import
          </button>
        ) : (
          <button type="submit" className="btn btn-primary w-full" disabled={valid.length === 0}>
            <FileUp className="h-4 w-4" aria-hidden />
            Import {valid.length} {mode === "clients" ? "client" : "draft invoice"} row{valid.length === 1 ? "" : "s"}
          </button>
        )}
      </form>
    </section>
  );
}
