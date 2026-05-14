import { AppShell } from "@/components/AppShell";
import { ListPageSkeleton } from "@/components/ListPageSkeleton";

export default function InvoicesLoading() {
  return (
    <AppShell>
      <ListPageSkeleton rows={7} />
    </AppShell>
  );
}
