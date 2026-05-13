import { AlertTriangle, FileCheck2, ReceiptText, WalletCards } from "lucide-react";
import { StatisticsCard } from "@/components/statistics-card-2";

interface DashboardStatsCardsProps {
  totalCollected: string;
  outstandingBalance: string;
  pendingProofs: number;
  overdueInvoices: number;
}

export function DashboardStatsCards({
  totalCollected,
  outstandingBalance,
  pendingProofs,
  overdueInvoices
}: DashboardStatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatisticsCard
        title="Total collected"
        value={totalCollected}
        helperText="Current total"
        icon={WalletCards}
        href="/invoices"
        tone="emerald"
      />
      <StatisticsCard
        title="Outstanding balance"
        value={outstandingBalance}
        helperText="Current total"
        icon={ReceiptText}
        href="/invoices"
        tone="cedar"
      />
      <StatisticsCard
        title="Pending proofs"
        value={pendingProofs.toLocaleString()}
        helperText="Awaiting review"
        icon={FileCheck2}
        href="/proofs"
        tone="amber"
      />
      <StatisticsCard
        title="Overdue invoices"
        value={overdueInvoices.toLocaleString()}
        helperText="Needs attention"
        icon={AlertTriangle}
        href="/invoices"
        tone="tomato"
      />
    </div>
  );
}
