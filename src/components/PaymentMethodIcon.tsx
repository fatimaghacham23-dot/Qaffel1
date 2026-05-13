"use client";

import { useState } from "react";
import Image from "next/image";
import { Banknote, Building2, CircleDollarSign, Landmark, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentMethodIconProps = {
  type: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: {
    container: "size-10 min-w-10",
    image: "p-1",
    pixels: 40,
    fallback: "h-4 w-4"
  },
  md: {
    container: "size-14 min-w-14",
    image: "p-1.5",
    pixels: 56,
    fallback: "h-5 w-5"
  },
  lg: {
    container: "size-16 min-w-16",
    image: "p-2",
    pixels: 64,
    fallback: "h-6 w-6"
  }
};

const iconConfig = {
  whish: {
    label: "Whish Money",
    className: "from-fuchsia-500 via-purple-500 to-pink-500",
    icon: WalletCards,
    logoSrc: "/logos/whish-money.png"
  },
  omt: {
    label: "OMT",
    className: "from-red-500 via-orange-500 to-amber-500",
    icon: CircleDollarSign,
    logoSrc: "/logos/omt.png"
  },
  cash: {
    label: "Cash",
    className: "from-emerald-500 via-green-500 to-teal-500",
    icon: Banknote
  },
  bank_transfer: {
    label: "Bank transfer",
    className: "from-sky-500 via-blue-500 to-indigo-500",
    icon: Landmark
  },
  other: {
    label: "Other",
    className: "from-slate-500 via-slate-600 to-ink",
    icon: Building2
  }
};

export function getPaymentMethodLabel(type: string | null | undefined) {
  const normalized = (type || "other").toLowerCase().replaceAll(" ", "_");
  return iconConfig[normalized as keyof typeof iconConfig]?.label || type || "Other";
}

export function PaymentMethodIcon({ type, className, size = "md" }: PaymentMethodIconProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const normalized = (type || "other").toLowerCase().replaceAll(" ", "_");
  const config = iconConfig[normalized as keyof typeof iconConfig] || iconConfig.other;
  const Icon = config.icon;
  const logoSrc = "logoSrc" in config ? config.logoSrc : undefined;
  const isWhish = normalized === "whish";
  const sizing = sizeClasses[size];

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full",
        isWhish && !logoFailed
          ? cn(sizing.container, "border border-slate-200 bg-white shadow-sm")
          : cn(sizing.container, "bg-gradient-to-br text-white shadow-soft"),
        !isWhish || logoFailed ? config.className : "",
        className
      )}
    >
      {logoSrc && !logoFailed ? (
        <span className={cn("grid h-full w-full place-items-center", isWhish ? "" : "rounded-full bg-white/95 shadow-sm")}>
          <Image
            alt={config.label}
            className={cn("h-full w-full object-contain", sizing.image, isWhish ? "" : "rounded-full")}
            height={sizing.pixels}
            onError={() => setLogoFailed(true)}
            sizes={`${sizing.pixels}px`}
            src={logoSrc}
            width={sizing.pixels}
          />
        </span>
      ) : (
        <Icon className={sizing.fallback} aria-hidden="true" />
      )}
      <span className="sr-only">{config.label}</span>
    </span>
  );
}
