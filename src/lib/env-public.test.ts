import { describe, expect, it } from "vitest";
import { readPublicEnvironment } from "@/lib/env-public";

describe("public Supabase environment validation", () => {
  it("rejects missing and placeholder public configuration for Preview and Production builds", () => {
    expect(() => readPublicEnvironment("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co", {}, true)).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(() => readPublicEnvironment("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co", { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }, true)).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(() => readPublicEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key", {}, true)).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
  it("allows explicit mocked development configuration without exposing server secrets", () => {
    expect(readPublicEnvironment("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co", { NEXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co" }, false)).toBe("https://mock.supabase.co");
    expect(readPublicEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY", "placeholder-anon-key", {}, false)).toBe("placeholder-anon-key");
  });
});
