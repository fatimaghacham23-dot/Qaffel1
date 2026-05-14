import { AppShell } from "@/components/AppShell";
import { ListPageSkeleton } from "@/components/ListPageSkeleton";

export default function ClientsLoading() {
  return (
    <AppShell>
      <ListPageSkeleton rows={6} />
    </AppShell>
  );
}
