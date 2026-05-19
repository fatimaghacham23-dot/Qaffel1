export function money(value: number | string | null | undefined, currency: "USD" | "LBP") {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (Number.isNaN(amount) || !Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "LBP" ? 0 : 2
  }).format(amount);
}

export function shortDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "";
  
  const m = method.toLowerCase().trim();
  if (m === "cash") return "Cash";
  if (m.includes("whish")) return "Whish Money";
  if (m.includes("omt")) return "OMT Pay";
  if (m === "bank_transfer" || m === "bank transfer") return "Bank transfer";
  
  // If it's already properly cased or unknown, return it as is but capitalized
  return method.charAt(0).toUpperCase() + method.slice(1);
}
