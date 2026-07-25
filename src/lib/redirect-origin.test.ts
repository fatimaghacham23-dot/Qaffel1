import { describe, expect, it } from "vitest";
import { trustedRedirectUrl } from "@/lib/redirect-origin";

describe("trusted redirect URLs", () => {
  it("uses canonical production URLs and rejects unsafe redirects", () => {
    const prior = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(trustedRedirectUrl("https://qaffel.online/login")).toBe("https://qaffel.online/login");
    expect(trustedRedirectUrl("https://evil.example")).toBe("https://qaffel.online/");
    expect(trustedRedirectUrl("//evil.example")).toBe("https://qaffel.online/");
    expect(trustedRedirectUrl("javascript:alert(1)")).toBe("https://qaffel.online/");
    expect(trustedRedirectUrl("data:text/plain,test")).toBe("https://qaffel.online/");
    (process.env as Record<string, string | undefined>).NODE_ENV = prior;
  });

  it("allows localhost only outside production", () => {
    const prior = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(trustedRedirectUrl("http://localhost:3000/auth/callback")).toBe("http://localhost:3000/auth/callback");
    (process.env as Record<string, string | undefined>).NODE_ENV = prior;
  });
});
