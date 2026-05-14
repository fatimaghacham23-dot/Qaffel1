import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DocumentTheme } from "@/lib/brand";
import { brandCssVars } from "@/lib/brand";

export function BrandedPublicSurface({
  theme,
  brandColor,
  brandAccent,
  className,
  children
}: {
  theme: DocumentTheme;
  brandColor: string;
  brandAccent?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-doc-theme={theme}
      className={cn("public-brand-surface", className)}
      style={brandCssVars(brandColor, brandAccent)}
    >
      {children}
    </div>
  );
}
