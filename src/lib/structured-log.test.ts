import { describe, expect, it } from "vitest";
import { buildStructuredLog } from "@/lib/structured-log";

describe("structured logging", () => {
  it("redacts secrets and customer contact fields recursively", () => {
    const log = buildStructuredLog("error", "test.failure", {
      workspaceId: "workspace-1",
      token: "private-token",
      nested: {
        email: "customer@example.com",
        reason: "safe"
      }
    });

    expect(log.workspaceId).toBe("workspace-1");
    expect(log.token).toBe("[REDACTED]");
    expect(log.nested).toEqual({ email: "[REDACTED]", reason: "safe" });
  });
});
