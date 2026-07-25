import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildClientPortalUrl, buildEligibleClientPortalUrl, buildEligibleReceiptUrl, buildPaymentUrl, buildReceiptUrl, buildEligibleSharedReportUrl, buildSharedReportUrl, getCanonicalAppUrl } from "@/lib/urls";

describe("canonical public URLs", () => {
  it("uses the production domain outside development", () => {
    const prior = process.env.NODE_ENV;
    const priorAppUrl = process.env.APP_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.APP_URL = "http://localhost:3000";
    expect(getCanonicalAppUrl()).toBe("https://qaffel.online");
    expect(buildPaymentUrl("a/b", "ar")).toBe("https://qaffel.online/pay/a%2Fb?lang=ar");
    (process.env as Record<string, string | undefined>).NODE_ENV = prior;
    if (priorAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = priorAppUrl;
  });
  it("builds payment, receipt, portal, and report URLs with encoded tokens", () => {
    expect(buildPaymentUrl("payment token", "en")).toContain("/pay/payment%20token?lang=en");
    expect(buildReceiptUrl("receipt token")).toContain("/receipt/receipt%20token");
    expect(buildClientPortalUrl("client token")).toContain("/client/client%20token");
    expect(buildSharedReportUrl("report token")).toContain("/share/report/report%20token");
  });
  it("builds canonical receipt URLs without duplicate locale parameters", () => {
    const prior = process.env.NODE_ENV;
    const priorAppUrl = process.env.APP_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.APP_URL = "https://preview.example.test/base?lang=ignored";
    expect(buildReceiptUrl("receipt / token", "en")).toBe("https://qaffel.online/receipt/receipt%20%2F%20token?lang=en");
    expect(buildReceiptUrl("receipt / token", "ar")).toBe("https://qaffel.online/receipt/receipt%20%2F%20token?lang=ar");
    (process.env as Record<string, string | undefined>).NODE_ENV = prior;
    if (priorAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = priorAppUrl;
  });
  it("does not generate receipt URLs for voided or ineligible payments", () => {
    expect(buildEligibleReceiptUrl({ status: "voided", receipt_token: "receipt" })).toBeNull();
    expect(buildEligibleReceiptUrl({ status: "accepted", voided_at: "2026-07-25", receipt_token: "receipt" })).toBeNull();
    expect(buildEligibleReceiptUrl({ status: "accepted" })).toBeNull();
  });
  it("keeps the server-only URL module out of the client proof table", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/PaymentProofsTable.tsx"), "utf8");
    expect(source).not.toContain("@/lib/urls");
    expect(source).not.toContain("NEXT_PUBLIC_APP_URL");
  });
  it("keeps invalid public receipt tokens on the safe not-found path", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/receipt/[token]/page.tsx"), "utf8");
    expect(source).toContain("if (!receiptData)");
    expect(source).toContain("return notFound();");
  });
  it("builds canonical client portal URLs with encoded localized tokens", () => {
    const prior = process.env.NODE_ENV;
    const priorAppUrl = process.env.APP_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.APP_URL = "https://preview.example.test/base?lang=ignored";
    expect(buildClientPortalUrl("client / token", "en")).toBe("https://qaffel.online/client/client%20%2F%20token?lang=en");
    expect(buildClientPortalUrl("client / token", "ar")).toBe("https://qaffel.online/client/client%20%2F%20token?lang=ar");
    (process.env as Record<string, string | undefined>).NODE_ENV = prior;
    if (priorAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = priorAppUrl;
  });
  it("does not generate a portal URL without a client portal token", () => {
    expect(buildEligibleClientPortalUrl()).toBeNull();
    expect(buildEligibleClientPortalUrl(null)).toBeNull();
  });
  it("keeps invalid public portal tokens on the safe not-found path", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/client/[token]/page.tsx"), "utf8");
    expect(source).toContain("if (!portalHeader?.client_name)");
    expect(source).toContain("return notFound();");
  });
  it("builds canonical shared report URLs with encoded localized tokens", () => {
    const prior = process.env.NODE_ENV;
    const priorAppUrl = process.env.APP_URL;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.APP_URL = "https://preview.example.test/base?lang=ignored";
    expect(buildSharedReportUrl("report / token", "en")).toBe("https://qaffel.online/share/report/report%20%2F%20token?lang=en");
    expect(buildSharedReportUrl("report / token", "ar")).toBe("https://qaffel.online/share/report/report%20%2F%20token?lang=ar");
    (process.env as Record<string, string | undefined>).NODE_ENV = prior;
    if (priorAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = priorAppUrl;
  });
  it("does not generate a shared report URL without a token", () => {
    expect(buildEligibleSharedReportUrl()).toBeNull();
    expect(buildEligibleSharedReportUrl(null)).toBeNull();
  });
  it("keeps invalid shared report tokens on the safe not-found path", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/share/report/[token]/page.tsx"), "utf8");
    expect(source).toContain("if (!data)");
    expect(source).toContain("notFound();");
  });
});
