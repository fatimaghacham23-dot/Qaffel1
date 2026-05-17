"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex min-h-11 w-full rounded-2xl border border-slate-200/70 bg-white/95 px-4 py-2.5 text-sm text-ink shadow-[inset_0_1px_0_rgba(15,23,42,0.02)] outline-none transition-[border-color,box-shadow,background-color] duration-q file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 placeholder:transition-opacity focus:border-cedar/50 focus:bg-white focus:shadow-[inset_0_1px_0_rgba(15,23,42,0.02),0_0_0_3px_rgba(17,100,102,0.08)] focus:placeholder:opacity-40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-70",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
