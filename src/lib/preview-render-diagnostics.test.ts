import { describe, expect, it } from "vitest";
import {
  createPreviewDiagnosticTracker,
  previewRenderDiagnostic,
  previewRenderDiagnosticOrThrow,
  sanitizePreviewRenderDiagnostic,
  throwSupabaseQueryFailure
} from "@/lib/preview-render-diagnostics";

describe("Preview render diagnostics", () => {
  it("returns a card payload only in Preview and rethrows the original production error", () => {
    const tracker = createPreviewDiagnosticTracker("DASHBOARD_AUTH");
    const error = new Error("Authentication failed");
    expect(previewRenderDiagnostic({ environment: "production", routePattern: "/dashboard", tracker, error })).toBeNull();
    expect(() => previewRenderDiagnosticOrThrow({ environment: "production", routePattern: "/dashboard", tracker, error })).toThrow(error);
    expect(previewRenderDiagnosticOrThrow({ environment: "preview", routePattern: "/dashboard", tracker, error })).toMatchObject({ routePattern: "/dashboard", stage: "DASHBOARD_AUTH" });
  });

  it("redacts sensitive strings and bounds the message", () => {
    const value = `qa@example.com 123e4567-e89b-12d3-a456-426614174000 https://example.test/token payment-proofs/a/b ${"a".repeat(400)}`;
    const safe = sanitizePreviewRenderDiagnostic(value);
    expect(safe).not.toContain("qa@example.com");
    expect(safe).not.toContain("123e4567-e89b-12d3-a456-426614174000");
    expect(safe).not.toContain("https://example.test");
    expect(safe).not.toContain("payment-proofs/a/b");
    expect(safe.length).toBeLessThanOrEqual(300);
  });

  it("keeps dashboard and notification stages distinguishable", () => {
    const dashboard = createPreviewDiagnosticTracker("DASHBOARD_FINANCIAL_FACTS");
    const notifications = createPreviewDiagnosticTracker("NOTIFICATIONS_ONBOARDING");
    const error = new Error("Failed");
    expect(previewRenderDiagnostic({ environment: "preview", routePattern: "/dashboard", tracker: dashboard, error })?.stage).toBe("DASHBOARD_FINANCIAL_FACTS");
    expect(previewRenderDiagnostic({ environment: "preview", routePattern: "/notifications", tracker: notifications, error })?.stage).toBe("NOTIFICATIONS_ONBOARDING");
  });

  it("labels a Supabase query result failure without returning business data", () => {
    const tracker = createPreviewDiagnosticTracker("NOTIFICATIONS_FACTS");
    const error = new Error("relation missing");
    expect(() => throwSupabaseQueryFailure(tracker, "NOTIFICATIONS_FACTS", error)).toThrow(error);
    const diagnostic = previewRenderDiagnostic({ environment: "preview", routePattern: "/notifications", tracker, error });
    expect(diagnostic).toMatchObject({ code: "SUPABASE_QUERY_FAILED", fromSupabaseQuery: true });
    expect(diagnostic).not.toHaveProperty("data");
  });
});
