"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "border-cedar/90 bg-cedar text-white shadow-sm",
  secondary: "border-slate-200/80 bg-slate-100/80 text-slate-700",
  outline: "border-slate-200/90 bg-white/90 text-slate-700 shadow-sm",
  destructive: "border-tomato/90 bg-tomato text-white shadow-sm"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-q",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}
