import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Columns = 1 | 2 | 3 | 4;
const tablet: Record<Columns, string> = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" };
const desktop: Record<Columns, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };
export function ResponsiveGrid({ children, tabletColumns = 2, desktopColumns = 3, className }: { children: ReactNode; tabletColumns?: Columns; desktopColumns?: Columns; className?: string }) { return <div className={cn("grid min-w-0 grid-cols-1 gap-4 sm:gap-5", tablet[tabletColumns], desktop[desktopColumns], className)}>{children}</div>; }
