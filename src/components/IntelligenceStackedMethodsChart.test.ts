import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatPaymentMethodChartAmount, IntelligenceStackedMethodsChart, paymentMethodTooltipLabel } from "@/components/IntelligenceStackedMethodsChart";
import type { PaymentMethodCurrencyChart } from "@/lib/payment-method-currency-charts";

const charts: PaymentMethodCurrencyChart[] = [
  { currency: "LBP", series: [{ key: "LBP:Cash", method: "Cash", currency: "LBP", stackId: "method:LBP" }], rows: [{ month: "2026-06", values: { "LBP:Cash": 0 } }] },
  { currency: "USD", series: [{ key: "USD:Bank", method: "Bank", currency: "USD", stackId: "method:USD" }], rows: [{ month: "2026-06", values: { "USD:Bank": 10 } }] }
];

describe("currency-safe payment-method chart presentation", () => {
  it("renders one labelled section per supplied currency without approximation copy", () => {
    const html = renderToStaticMarkup(createElement(IntelligenceStackedMethodsChart, { data: charts }));
    expect(html).toContain("Payment methods — LBP");
    expect(html).toContain("Payment methods — USD");
    expect(html).not.toContain("approx");
    expect(html).not.toContain("USD equivalent");
  });

  it("keeps tooltip labels and values explicit in the section currency", () => {
    expect(paymentMethodTooltipLabel("Bank", "USD")).toBe("Bank · USD");
    expect(formatPaymentMethodChartAmount(2_000_000, "LBP")).toContain("2,000,000");
  });

  it("uses the factual empty state when no eligible facts are supplied", () => {
    const html = renderToStaticMarkup(createElement(IntelligenceStackedMethodsChart, { data: [] }));
    expect(html).toContain("Need accepted, non-voided payment records with methods to show this view.");
    expect(html).not.toContain("Payment methods — USD");
  });
});