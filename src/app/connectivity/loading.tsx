import { AppShell } from "@/components/AppShell";
import { ListPageSkeleton } from "@/components/ListPageSkeleton";

export default function ConnectivityLoading() {
  return (
    <AppShell>
      <ListPageSkeleton />
    </AppShell>
  );
}
