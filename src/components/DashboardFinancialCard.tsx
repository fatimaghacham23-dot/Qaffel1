"use client";

import { AnimatedDashboardCard } from "@/components/animated-dashboard-card";

interface DashboardFinancialCardProps {
  paidThisMonth: string;
  outstanding: string;
  activityData?: { day: string; value: number }[];
  omitHeroValue?: boolean;
}

export function DashboardFinancialCard({ paidThisMonth, outstanding, activityData, omitHeroValue }: DashboardFinancialCardProps) {
  return (
    <AnimatedDashboardCard
      title="Collected this month"
      value={paidThisMonth}
      primaryLabel="Collected this month"
      primaryValue={paidThisMonth}
      secondaryLabel="Waiting to be collected"
      secondaryValue={outstanding}
      note="Based on your current invoice statuses — same math, clearer labels."
      activityData={activityData}
      activityEmptyMessage="Activity appears as invoices and payments are recorded."
      omitHeroValue={omitHeroValue}
    />
  );
}
