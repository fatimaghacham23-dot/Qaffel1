import { describe, expect, it } from "vitest";
import { previewRscDiagnostic, sanitizePreviewDiagnosticValue } from "@/lib/preview-rsc-diagnostics";

const context = { routePath: "/clients/[id]", routeType: "render" as const, renderSource: "react-server-components" as const };

describe("Preview RSC diagnostics", () => {
  it("runs only for Preview and keeps the route pattern", () => {
    const error = new Error("Client summary failed");
    expect(previewRscDiagnostic({ environment: "production", error, context, method: "GET" })).toBeNull();
    expect(previewRscDiagnostic({ environment: "preview", error, context, method: "GET" })).toMatchObject({ routePath: "/clients/[id]", routeType: "render", renderSource: "react-server-components", method: "GET" });
  });

  it("redacts sensitive values and truncates messages before logging", () => {
    const longSecret = "a".repeat(64);
    const message = `Contact qa@example.com at https://example.test/pay/token with 123e4567-e89b-12d3-a456-426614174000 and ${longSecret}`;
    const sanitized = sanitizePreviewDiagnosticValue(message, 80);
    expect(sanitized).toContain("[redacted-email]");
    expect(sanitized).not.toContain("qa@example.com");
    expect(sanitized).not.toContain("123e4567-e89b-12d3-a456-426614174000");
    expect(sanitized).not.toContain("https://example.test");
    expect(sanitized.length).toBeLessThanOrEqual(80);
  });

  it("records only a sanitized application-owned stack frame", () => {
    const error = new Error("Failed");
    error.stack = "Error: Failed\n    at loadClient (D:\\Qaffel\\src\\app\\clients\\page.tsx:20:1)\n    at internals";
    const diagnostic = previewRscDiagnostic({ environment: "preview", error, context, method: "get" });
    expect(diagnostic?.applicationFrame).toContain("src\\app\\clients\\page.tsx");
    expect(Object.keys(diagnostic || {})).not.toContain("headers");
    expect(Object.keys(diagnostic || {})).not.toContain("path");
  });
});
