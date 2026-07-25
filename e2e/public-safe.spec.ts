import { expect, test } from "@playwright/test";

const publicPaymentToken = process.env.E2E_PUBLIC_PAYMENT_TOKEN?.trim();

test.describe("hosted public-safe routes", () => {
  test("invalid public tokens reveal neither payment nor customer information", async ({ page }) => {
    for (const path of ["/pay/invalid-public-token", "/receipt/invalid-receipt-token", "/client/invalid-client-token", "/share/report/invalid-report-token"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.locator("body")).not.toContainText(/payment-proofs|workspace_id|storage\/v1\/object|receipt_token/i);
    }
  });

  test("public payment supports English, Arabic, RTL, safe query preservation, and mobile layout", async ({ page }) => {
    test.skip(!publicPaymentToken, "E2E_PUBLIC_PAYMENT_TOKEN is required for a valid public-page assertion.");
    await page.goto(`/pay/${publicPaymentToken}?method=whish&lang=en`);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByRole("link", { name: /Arabic|العربية/i })).toBeVisible();

    await page.getByRole("link", { name: /Arabic|العربية/i }).click();
    await expect(page).toHaveURL(new RegExp(`/pay/${publicPaymentToken}\\?method=whish&lang=ar`));
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("body")).not.toContainText(/message delivered|WhatsApp delivered/i);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[dir="rtl"]')).toBeVisible();
  });
});