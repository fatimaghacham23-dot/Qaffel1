"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "secondary";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  default: "border border-cedar/90 bg-cedar text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(17,100,102,0.12),0_10px_24px_-16px_rgba(17,100,102,0.65)] hover:bg-cedar/95 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_4px_rgba(17,100,102,0.14),0_14px_36px_-18px_rgba(17,100,102,0.75)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),0_1px_2px_rgba(17,100,102,0.1)]",
  outline: "border border-slate-200/80 bg-white/95 text-slate-800 shadow-sm hover:border-slate-300 hover:bg-white hover:shadow-card",
  ghost: "text-slate-600 hover:bg-slate-100/50 hover:text-ink border border-transparent hover:border-slate-200/40",
  secondary: "border border-slate-200/70 bg-slate-100/70 text-slate-800 hover:bg-slate-200/50 hover:border-slate-200"
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-10 px-5 py-2.5",
  sm: "min-h-9 px-3.5 text-[13px]",
  lg: "min-h-11 px-6",
  icon: "h-10 w-10"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex touch-manipulation items-center justify-center gap-2 rounded-2xl text-sm font-semibold outline-none will-change-[transform,box-shadow] focus-visible:shadow-[var(--q-focus-ring)] disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      style={{
        transitionProperty: "transform, box-shadow, background-color, border-color, color, opacity",
        transitionDuration: "var(--q-duration-normal)",
        transitionTimingFunction: "var(--q-ease)"
      }}
      {...props}
    />
  )
);

Button.displayName = "Button";
