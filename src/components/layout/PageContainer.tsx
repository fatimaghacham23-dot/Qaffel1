import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageContainerWidth = "default" | "wide" | "compact";

export function PageContainer({ children, className, width = "default" }: { children: ReactNode; className?: string; width?: PageContainerWidth }) {
  const widths: Record<PageContainerWidth, string> = { default: "max-w-7xl", wide: "max-w-none", compact: "max-w-3xl" };
  return <div className={cn("mx-auto min-w-0 w-full px-4 sm:px-6 lg:px-8", widths[width], className)}>{children}</div>;
}
