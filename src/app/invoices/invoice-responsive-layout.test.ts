import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("invoice responsive route structure", () => {
  it("keeps the list in a wide responsive container with header actions and a mobile-safe table", () => {
    const page = source("src/app/invoices/page.tsx");
    const table = source("src/components/InteractiveInvoicesTable.tsx");
    expect(page).toContain('<PageContainer width="wide">');
    expect(page).toContain("<PageHeader");
    expect(page).toContain('href="/invoices/new"');
    expect(page).toContain("<ResponsiveGrid");
    expect(table).toContain("md:hidden");
    expect(table).toContain("overflow-x-auto");
    expect(table).toContain("USD");
    expect(table).toContain("LBP");
  });

  it("keeps invoice detail navigation, public links, gated receipt actions, and responsive summary cards", () => {
    const page = source("src/app/invoices/[id]/page.tsx");
    expect(page).toContain('backHref="/invoices"');
    expect(page).toContain("<PageHeader");
    expect(page).toContain("<ResponsiveGrid");
    expect(page).toContain("buildPaymentUrl");
    expect(page).toContain("receipt_token");
    expect(page).toContain("VoidPaymentButton");
    expect(page).toContain("FollowUpSection");
  });

  it("keeps creation controls, field errors, and mobile-first form columns intact", () => {
    const page = source("src/app/invoices/new/page.tsx");
    const form = source("src/components/NewInvoiceCreatorForm.tsx");
    expect(page).toContain('<PageContainer width="default">');
    expect(page).toContain("<PageHeader");
    expect(form).toContain("validateInvoiceCreatorForm");
    expect(form).toContain("InvoiceDepositFields");
    expect(form).toContain("md:grid-cols-4");
    expect(form).toContain("Create document");
    expect(form).toContain("aria-invalid");
  });

  it("contains print preview overflow and keeps print controls isolated", () => {
    const page = source("src/app/invoices/[id]/print/page.tsx");
    expect(page).toContain("overflow-x-auto");
    expect(page).toContain("print:hidden");
    expect(page).toContain("break-all");
  });
});