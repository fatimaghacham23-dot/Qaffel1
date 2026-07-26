import { describe, expect, it } from "vitest";
import { validatePublicSupabaseConfig } from "@/lib/env-public-validation";

describe("public Supabase environment validation", () => {
  const valid = () => validatePublicSupabaseConfig("https://project.supabase.co", "anon-key");
  it("accepts a valid Supabase URL and anonymous key", () => expect(valid()).toEqual({ supabaseUrl: "https://project.supabase.co", supabaseAnonKey: "anon-key" }));
  it("rejects missing, placeholder, and malformed public values", () => {
    expect(() => validatePublicSupabaseConfig(undefined, "anon-key")).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(() => validatePublicSupabaseConfig("https://example.supabase.co", "anon-key")).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(() => validatePublicSupabaseConfig("not-a-url", "anon-key")).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(() => validatePublicSupabaseConfig("https://project.supabase.co", undefined)).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(() => validatePublicSupabaseConfig("https://project.supabase.co", "placeholder-anon-key")).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
  it("returns only browser-safe public configuration", () => {
    expect(Object.keys(valid())).toEqual(["supabaseUrl", "supabaseAnonKey"]);
  });
});
