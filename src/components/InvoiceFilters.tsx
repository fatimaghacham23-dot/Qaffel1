"use client";

import { Filter, Search } from "lucide-react";

interface InvoiceFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" }
];

export function InvoiceFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter
}: InvoiceFiltersProps) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={18} aria-hidden="true" />
          </div>
          <input
            type="text"
            placeholder="Search number, title, or client..."
            className="field min-h-11 pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative lg:w-56">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Filter size={17} aria-hidden="true" />
          </div>
          <select
            className="field min-h-11 pl-10"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
