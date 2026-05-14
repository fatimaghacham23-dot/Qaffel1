import { AppShell } from "@/components/AppShell";
import { ListPageSkeleton } from "@/components/ListPageSkeleton";

export default function ProofsLoading() {
  return (
    <AppShell>
      <ListPageSkeleton rows={8} />
    </AppShell>
  );
}
