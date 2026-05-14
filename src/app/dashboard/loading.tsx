import { AppShell } from "@/components/AppShell";
import { ListPageSkeleton } from "@/components/ListPageSkeleton";

export default function DashboardLoading() {
  return (
    <AppShell>
      <ListPageSkeleton rows={8} />
    </AppShell>
  );
}
