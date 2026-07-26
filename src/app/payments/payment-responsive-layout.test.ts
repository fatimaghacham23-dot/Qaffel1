import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("payment and proof responsive structure", () => {
  it("uses a wide container, one PageHeader, accessible view links, and server-generated receipt URLs", () => {
    const page = source("src/app/payments/page.tsx");
    expect(page).toContain('<PageContainer width="wide">');
    expect(page).toContain("<PageHeader");
    expect(page).toContain('aria-label="Payment views"');
    expect(page).toContain("buildEligibleReceiptUrl");
    expect(page).toContain('aria-current={candidate === view ? "page" : undefined}');
    expect(page).toContain('hasPermission(ctx.role, "proofs.view")');
  });

  it("keeps payment history labels, separate currencies, and safe receipt links", () => {
    const view = source("src/components/PaymentsView.tsx");
    expect(view).toContain("Client");
    expect(view).toContain("Amount");
    expect(view).toContain("Method");
    expect(view).toContain("Status and date");
    expect(view).toContain('money(Number(payment.amount_usd), "USD")');
    expect(view).toContain('money(Number(payment.amount_lbp), "LBP")');
    expect(view).toContain("payment.receipt_url");
    expect(view).not.toContain('`/receipt/${payment.receipt_token}`');
  });

  it("retains mobile proof data, keyboard actions, safe receipt props, and wrapped context", () => {
    const table = source("src/components/PaymentProofsTable.tsx");
    expect(table).toContain("Payment proof review queue");
    expect(table).toContain("lg:hidden");
    expect(table).toContain("Amount");
    expect(table).toContain("Method");
    expect(table).toContain("Uploaded");
    expect(table).toContain("Open proof actions");
    expect(table).toContain("receipt_url");
    expect(table).toContain("break-words");
    expect(table).not.toContain('from "@/lib/urls"');
  });

  it("keeps review form controls, validation context, and a contained signed-proof viewer", () => {
    const review = source("src/components/ProofReviewForm.tsx");
    const viewer = source("src/components/ProofImagePreview.tsx");
    const manual = source("src/components/ManualPaymentForm.tsx");
    expect(review).toContain("Internal reviewer note");
    expect(review).toContain("Accept full");
    expect(review).toContain("Reject proof");
    expect(viewer).toContain('role="dialog"');
    expect(viewer).toContain("overflow-auto");
    expect(viewer).toContain("aria-modal");
    expect(manual).toContain('htmlFor="manual_amount_usd"');
    expect(manual).toContain('htmlFor="manual_amount_lbp"');
    expect(manual).toContain("sm:grid-cols-2");
    expect(manual).toContain("w-full sm:w-fit");
  });
});