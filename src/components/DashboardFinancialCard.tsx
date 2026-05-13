"use client";

import { AnimatedDashboardCard } from "@/components/animated-dashboard-card";

interface DashboardFinancialCardProps {
  paidThisMonth: string;
  outstanding: string;
  activityData?: { day: string; value: number }[];
}

export function DashboardFinancialCard({ paidThisMonth, outstanding, activityData }: DashboardFinancialCardProps) {
  return (
    <AnimatedDashboardCard
      title="Paid this month"
      value={paidThisMonth}
      primaryLabel="Total collected"
      primaryValue={paidThisMonth}
      secondaryLabel="Outstanding"
      secondaryValue={outstanding}
      note="Based on your current invoice statuses."
      activityData={activityData}
      activityEmptyMessage="Activity appears as invoices and payments are recorded."
    />
  );
}
