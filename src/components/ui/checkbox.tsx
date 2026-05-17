"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-[1.125rem] w-[1.125rem] shrink-0 rounded-[5px] border border-slate-300/80 bg-white shadow-sm outline-none transition-[border-color,background-color,box-shadow,transform] focus-visible:shadow-[var(--q-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-cedar data-[state=checked]:bg-cedar data-[state=checked]:text-white data-[state=checked]:shadow-[0_1px_3px_rgba(17,100,102,0.25)]",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
