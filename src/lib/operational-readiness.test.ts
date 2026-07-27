import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readiness = readFileSync(
  resolve(process.cwd(), "src/app/api/readiness/route.ts"),
  "utf8"
);

describe("operational readiness endpoint", () => {
  it("does not return secret values and fails readiness when dependencies fail", () => {
    expect(readiness).not.toContain("SUPABASE_SERVICE_ROLE_KEY:");
    expect(readiness).toContain("status: ready ? 200 : 503");
    expect(readiness).toContain('"Cache-Control": "no-store"');
  });
});
