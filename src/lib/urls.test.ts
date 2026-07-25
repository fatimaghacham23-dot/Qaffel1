import { describe, expect, it } from "vitest";
import { buildClientPortalUrl, buildPaymentUrl, buildReceiptUrl, buildSharedReportUrl, getCanonicalAppUrl } from "@/lib/urls";

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
});