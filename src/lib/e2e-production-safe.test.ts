import { describe, expect, it } from "vitest";
import { hostedE2ESafetyError } from "@/lib/e2e-production-safe";

describe("hosted Playwright safety gate", () => {
  it("rejects hosted runs without explicit production-safe QA configuration", () => {
    expect(hostedE2ESafetyError({ E2E_TARGET: "hosted" })).toContain("E2E_PRODUCTION_SAFE");
    expect(hostedE2ESafetyError({ E2E_TARGET: "hosted", E2E_PRODUCTION_SAFE: "true" })).toContain("WORKSPACE_ID");
  });

  it("rejects any workspace name other than the dedicated QA workspace", () => {
    expect(
      hostedE2ESafetyError({
        E2E_TARGET: "hosted",
        E2E_PRODUCTION_SAFE: "true",
        E2E_QA_WORKSPACE_ID: "qa-id",
        E2E_QA_WORKSPACE_NAME: "customer-workspace",
        E2E_QA_OWNER_EMAIL: "qa@example.invalid",
        E2E_QA_OWNER_PASSWORD: "not-a-secret-in-this-unit-test"
      })
    ).toContain("QAFFEL_AUTOMATED_QA");
  });

  it("accepts only an explicitly configured QA workspace", () => {
    expect(
      hostedE2ESafetyError({
        E2E_TARGET: "hosted",
        E2E_PRODUCTION_SAFE: "true",
        E2E_QA_WORKSPACE_ID: "qa-id",
        E2E_QA_WORKSPACE_NAME: "QAFFEL_AUTOMATED_QA",
        E2E_QA_OWNER_EMAIL: "qa@example.invalid",
        E2E_QA_OWNER_PASSWORD: "not-a-secret-in-this-unit-test"
      })
    ).toBeNull();
  });
});
