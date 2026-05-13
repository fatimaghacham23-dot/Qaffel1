import { describe, expect, it } from "vitest";
import { money } from "@/lib/format";
import { isPortalDocumentsEmpty } from "@/lib/portal-documents";
import { resolveSafeHttpsPageUrl, resolveSafeQrImageSrc } from "@/lib/safe-qr-url";

describe("resolveSafeQrImageSrc", () => {
  it("allows https URLs", () => {
    expect(resolveSafeQrImageSrc("https://cdn.example.com/qr.png")).toEqual({
      kind: "https",
      href: "https://cdn.example.com/qr.png"
    });
  });

  it("allows same-site paths", () => {
    expect(resolveSafeQrImageSrc("/assets/qr.png")).toEqual({
      kind: "relative",
      path: "/assets/qr.png"
    });
  });

  it("blocks javascript:, blob:, file:", () => {
    expect(resolveSafeQrImageSrc("javascript:alert(1)")).toBeNull();
    expect(resolveSafeQrImageSrc("blob:http://x")).toBeNull();
    expect(resolveSafeQrImageSrc("file:///etc/passwd")).toBeNull();
  });

  it("blocks protocol-relative URLs", () => {
    expect(resolveSafeQrImageSrc("//evil.com/a.png")).toBeNull();
  });

  it("blocks path traversal", () => {
    expect(resolveSafeQrImageSrc("/static/../secret.png")).toBeNull();
  });
});

describe("resolveSafeHttpsPageUrl", () => {
  it("allows https only", () => {
    expect(resolveSafeHttpsPageUrl("https://omt.example/pay")).toBe("https://omt.example/pay");
  });

  it("rejects http and dangerous schemes", () => {
    expect(resolveSafeHttpsPageUrl("http://example.com")).toBeNull();
    expect(resolveSafeHttpsPageUrl("javascript:void(0)")).toBeNull();
    expect(resolveSafeHttpsPageUrl("data:text/html,base64")).toBeNull();
  });
});

describe("money", () => {
  it("returns dash for NaN and non-finite values", () => {
    expect(money(Number.NaN, "USD")).toBe("-");
    expect(money(Number.POSITIVE_INFINITY, "USD")).toBe("-");
    expect(money(Number.NEGATIVE_INFINITY, "LBP")).toBe("-");
  });
});

describe("isPortalDocumentsEmpty", () => {
  it("is true for null and empty arrays", () => {
    expect(isPortalDocumentsEmpty(null)).toBe(true);
    expect(isPortalDocumentsEmpty(undefined)).toBe(true);
    expect(isPortalDocumentsEmpty([])).toBe(true);
  });

  it("is false when documents exist", () => {
    expect(isPortalDocumentsEmpty([{ public_token: "x" }])).toBe(false);
  });
});
