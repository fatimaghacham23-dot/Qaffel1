"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus:border-cedar focus:ring-2 focus:ring-cedar/15 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
