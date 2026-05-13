"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

const badgeVariants: Record<BadgeVariant, string> = {
  default: "border-transparent bg-cedar text-white",
  secondary: "border-transparent bg-slate-100 text-slate-700",
  outline: "border-slate-200 bg-white text-slate-700",
  destructive: "border-transparent bg-tomato text-white"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}
