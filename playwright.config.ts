import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const isHosted = process.env.E2E_TARGET === "hosted";
if (isHosted && !process.env.E2E_BASE_URL?.trim()) {
  throw new Error("Hosted Playwright requires E2E_BASE_URL; refusing to guess a production domain.");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  // Legacy fixtures can only execute on a disposable local Supabase instance.
  globalSetup: isHosted ? undefined : "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: isHosted
    ? undefined
    : {
        command: "npm run dev",
        url: `${process.env.E2E_BASE_URL || "http://127.0.0.1:3000"}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      },
  projects: [
    {
      name: "hosted-public",
      testMatch: /public-safe\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "authenticated-qa",
      testMatch: /qaffel\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});