"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex min-h-10 w-full rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 text-sm text-ink shadow-[inset_0_1px_0_rgba(15,23,42,0.02)] outline-none transition-[border-color,box-shadow,background-color] duration-q file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus:border-cedar/50 focus:bg-white focus:ring-4 focus:ring-cedar/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-70",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
