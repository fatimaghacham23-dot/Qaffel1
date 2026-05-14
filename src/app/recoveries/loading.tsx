import { AppShell } from "@/components/AppShell";
import { ListPageSkeleton } from "@/components/ListPageSkeleton";

export default function RecoveriesLoading() {
  return (
    <AppShell>
      <ListPageSkeleton rows={5} />
    </AppShell>
  );
}
