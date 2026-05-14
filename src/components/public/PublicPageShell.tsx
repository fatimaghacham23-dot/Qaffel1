import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PublicPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "public-page-shell min-h-[100dvh] bg-[linear-gradient(180deg,#f7f8f6_0%,#ffffff_42%,#eef3ef_100%)] pb-[max(6rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] pt-4 sm:pb-12 sm:pt-8",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PublicContentContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-3xl px-4 sm:max-w-4xl sm:px-5", className)}>{children}</div>;
}
