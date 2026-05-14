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
        title="Collected (all time)"
        value={totalCollected}
        helperText="Confirmed on invoices"
        icon={WalletCards}
        href="/invoices"
        tone="emerald"
      />
      <StatisticsCard
        title="Waiting to be collected"
        value={outstandingBalance}
        helperText="Open invoice balances"
        icon={ReceiptText}
        href="/invoices"
        tone="cedar"
      />
      <StatisticsCard
        title="Proofs awaiting review"
        value={pendingProofs.toLocaleString()}
        helperText="Money blocked until you confirm"
        icon={FileCheck2}
        href="/proofs"
        tone="amber"
      />
      <StatisticsCard
        title="Invoices with money overdue"
        value={overdueInvoices.toLocaleString()}
        helperText="Past due date"
        icon={AlertTriangle}
        href="/invoices"
        tone="tomato"
      />
    </div>
  );
}
