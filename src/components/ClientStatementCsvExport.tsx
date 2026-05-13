"use client";

import { Download } from "lucide-react";
import { toCsv } from "@/lib/csv";

interface ClientStatementCsvExportProps {
  clientName: string;
  data: any[];
}

export function ClientStatementCsvExport({ clientName, data }: ClientStatementCsvExportProps) {
  const handleExport = () => {
    const csvContent = toCsv(data);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `statement_${clientName.replaceAll(" ", "_")}_${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      className="btn btn-secondary text-xs inline-flex items-center gap-2 print:hidden"
      type="button"
    >
      <Download size={14} />
      Export CSV
    </button>
  );
}
