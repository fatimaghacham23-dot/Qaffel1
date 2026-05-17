import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PublicPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "public-page-shell min-h-[100dvh] bg-[linear-gradient(180deg,#f7f8f6_0%,#ffffff_42%,#eef3ef_100%)] pb-[max(6rem,calc(env(safe-area-inset-bottom,0px)+5rem))] pt-5 sm:pb-14 sm:pt-10",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PublicContentContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-3xl px-5 sm:max-w-4xl sm:px-6", className)}>{children}</div>;
}
