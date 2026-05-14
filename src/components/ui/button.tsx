"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "secondary";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  default: "border border-cedar/90 bg-cedar text-white shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_10px_24px_-16px_rgba(17,100,102,0.7)] hover:bg-cedar/95",
  outline: "border border-slate-200/90 bg-white/95 text-slate-800 shadow-sm hover:border-slate-300 hover:bg-white hover:shadow-card",
  ghost: "text-slate-600 hover:bg-slate-100/80 hover:text-ink",
  secondary: "border border-slate-200/80 bg-slate-100/80 text-slate-800 hover:bg-slate-200/70"
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-10 px-4 py-2",
  sm: "min-h-9 px-3",
  lg: "min-h-11 px-5",
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
        "inline-flex touch-manipulation items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-[transform,box-shadow,background-color,border-color,color,opacity] duration-q ease-q active:scale-[0.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cedar/10 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);

Button.displayName = "Button";
