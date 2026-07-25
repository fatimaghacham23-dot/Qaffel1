import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { E2E_CLIENT_NAME, E2E_INVOICE_TITLE, E2E_PASSWORD, E2E_USERS } from "./fixtures";

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function invoiceFixture() {
  const { data, error } = await adminClient()
    .from("invoices")
    .select("id, public_token, client_id")
    .eq("title", E2E_INVOICE_TITLE)
    .single();
  if (error || !data) throw error || new Error("E2E invoice does not exist.");
  return data;
}

async function uploadProof(page: Page, amount: string, note: string) {
  const invoice = await invoiceFixture();
  await page.goto(`/pay/${invoice.public_token}`);
  await page.getByLabel("Amount paid USD").fill(amount);
  await page.getByLabel("Method used").selectOption({ label: "E2E Bank Transfer" });
  await page.getByLabel("Note (optional)").fill(note);
  await page.getByLabel("Screenshot or PDF").setInputFiles({
    name: `${note}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
      "base64"
    )
  });
  await page.getByRole("button", { name: "Submit payment proof" }).click();
  await expect(page).toHaveURL(/uploaded=1/);
  await expect(page.getByText("Upload received.", { exact: true })).toBeVisible();
}

test.describe.serial("Qaffel production acceptance workflow", () => {
  test("owner creates a client and invoice through the product UI", async ({ page }) => {
    await login(page, E2E_USERS.owner);
    await page.goto("/clients/new");
    await page.getByLabel("Name").fill(E2E_CLIENT_NAME);
    await page.getByLabel("Email").fill("client.e2e@example.com");
    await page.getByLabel("Phone").fill("+96171111111");
    await page.getByRole("button", { name: "Create client" }).click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByText(E2E_CLIENT_NAME, { exact: true })).toBeVisible();

    await page.goto("/invoices/new");
    await page.getByLabel("Select Client").selectOption({ label: E2E_CLIENT_NAME });
    await page.getByLabel("Title").fill(E2E_INVOICE_TITLE);
    await page.getByLabel("Description").fill("Deterministic browser acceptance invoice");
    await page.getByLabel("Amount USD").fill("100");
    await page.getByLabel("Currency").selectOption("USD");
    await page.getByLabel("Due date").fill("2026-12-31");
    await page.getByLabel("Status").selectOption("sent");
    await page.getByRole("button", { name: "Create document" }).click();
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
    await expect(page.getByText(E2E_INVOICE_TITLE, { exact: true }).first()).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("Outstanding", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create invoice" })).toBeVisible();
  });

  test("invalid and expired-looking public tokens fail safely", async ({ page }) => {
    const response = await page.goto("/pay/not-a-valid-token");
    expect(response?.status()).toBe(404);
  });

  test("mobile client uploads two real private proofs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await uploadProof(page, "40", "accept-this-proof");
    await uploadProof(page, "5", "reject-this-proof");
  });

  test("reviewer gets signed proof access, accepts one partial payment, and rejects the other", async ({ page, request }) => {
    await login(page, E2E_USERS.reviewer);
    await page.goto("/payments?view=awaiting");

    const acceptedRow = page.getByRole("row").filter({ hasText: "$40.00" });
    await expect(acceptedRow).toContainText(E2E_INVOICE_TITLE);
    const signedUrl = await acceptedRow.getByAltText("Payment proof preview").locator("..").getAttribute("href");
    expect(signedUrl).toContain("/storage/v1/object/sign/payment-proofs/");
    const signedResponse = await request.get(signedUrl!);
    expect(signedResponse.status()).toBe(200);
    await acceptedRow.getByRole("button", { name: "Open proof actions" }).click();
    await page.getByText("Accept partial", { exact: true }).click();
    await expect(acceptedRow).toHaveCount(0);

    const rejectedRow = page.getByRole("row").filter({ hasText: "$5.00" });
    await rejectedRow.getByRole("button", { name: "Open proof actions" }).click();
    await page.getByText("Reject", { exact: true }).click();
    await expect(page.getByText("No proofs waiting for review", { exact: true })).toBeVisible();

    await page.goto("/payments?view=approved");
    await expect(page.getByText("$40.00", { exact: true })).toBeVisible();
    await page.goto("/payments?view=rejected");
    await expect(page.getByText("$5.00", { exact: true })).toBeVisible();
  });

  test("finance records and voids a manual payment without corrupting the balance", async ({ page }) => {
    const invoice = await invoiceFixture();
    await login(page, E2E_USERS.finance);
    await page.goto(`/invoices/${invoice.id}`);
    const manual = page.locator("#manual-payment");
    await manual.getByLabel("Amount USD").fill("10");
    await manual.getByLabel("Method").fill("Cash");
    await manual.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Payment recorded successfully!", { exact: true })).toBeVisible();

    await page.goto(`/pay/${invoice.public_token}`);
    await expect(page.getByText(/Remaining balance:.*50/i)).toBeVisible();

    await page.goto(`/invoices/${invoice.id}`);
    const paymentCard = page.locator("div.rounded-xl.border.border-slate-100").filter({ hasText: "$10.00" });
    let dialogCount = 0;
    page.on("dialog", async (dialog) => {
      dialogCount += 1;
      if (dialog.type() === "prompt") await dialog.accept("E2E reconciliation test");
      else await dialog.accept();
    });
    await paymentCard.getByRole("button", { name: "Void payment" }).click();
    await expect(page.getByText("Payment voided successfully", { exact: true })).toBeVisible();
    expect(dialogCount).toBe(2);

    await page.goto(`/pay/${invoice.public_token}`);
    await expect(page.getByText(/Remaining balance:.*60/i)).toBeVisible();
  });

  test("accepted uploaded proof has a valid public receipt", async ({ page }) => {
    const { data: proof, error } = await adminClient()
      .from("payment_proofs")
      .select("receipt_token")
      .eq("status", "accepted")
      .not("image_url", "is", null)
      .not("receipt_token", "is", null)
      .single();
    expect(error).toBeNull();
    expect(proof?.receipt_token).toBeTruthy();
    await page.goto(`/receipt/${proof!.receipt_token}`);
    await expect(page.getByText(/Receipt/i).first()).toBeVisible();
  });

  test("limited roles receive only their permitted payment views and actions", async ({ page }) => {
    await login(page, E2E_USERS.staff);
    await page.goto("/payments?view=awaiting");
    await expect(page.getByRole("button", { name: "Open proof actions" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Manual payments" })).toHaveCount(0);

    await login(page, E2E_USERS.operations);
    await page.goto("/payments?view=awaiting");
    await expect(page.getByRole("link", { name: "Awaiting review" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manual payments" })).toHaveCount(0);

    await login(page, E2E_USERS.admin);
    await page.goto("/payments?view=history");
    await expect(page.getByRole("link", { name: "Manual payments" })).toBeVisible();
  });

  test("client portal stays token-scoped", async ({ page }) => {
    const invoice = await invoiceFixture();
    const { data: client, error } = await adminClient()
      .from("clients")
      .select("client_portal_token")
      .eq("id", invoice.client_id)
      .single();
    expect(error).toBeNull();
    await page.goto(`/client/${client!.client_portal_token}`);
    await expect(page.getByText(E2E_INVOICE_TITLE, { exact: true })).toBeVisible();
    const bad = await page.goto("/client/not-a-valid-token");
    expect(bad?.status()).toBe(404);
  });

  test.skip("Arabic content and RTL public payment layout", async () => {
    // Release blocker: the current public payment route has no Arabic locale selector or RTL document direction.
  });
});