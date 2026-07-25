import { describe, expect, it } from "vitest";
import { validateInvoiceCreatorForm } from "@/lib/invoice-creator";

function creatorForm(values: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }

  return formData;
}

const validInvoice = {
  amount_usd: "250",
  currency: "USD",
  document_type: "invoice",
  require_approval: "no",
  status: "draft",
  title: "May retainer"
};

describe("validateInvoiceCreatorForm", () => {
  it("shows field errors when required creator fields are missing", () => {
    const result = validateInvoiceCreatorForm(
      creatorForm({
        currency: "USD",
        document_type: "invoice",
        require_approval: "no",
        status: "draft"
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected validation to fail.");

    expect(result.fieldErrors.title).toBe("Title is required.");
    expect(result.fieldErrors.amount_usd).toBe("Enter an amount in USD greater than 0.");
    expect(result.message).toBe("Title is required.");
  });

  it("requires the amount for the selected currency", () => {
    const result = validateInvoiceCreatorForm(
      creatorForm({
        ...validInvoice,
        amount_usd: "250",
        currency: "LBP"
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected validation to fail.");

    expect(result.fieldErrors.amount_lbp).toBe("Enter an amount in LBP greater than 0.");
  });

  it("accepts a filled invoice creator form and returns normalized values", () => {
    const result = validateInvoiceCreatorForm(
      creatorForm({
        ...validInvoice,
        client_id: "client-1",
        description: "Design and implementation",
        due_date: "2026-05-31",
        exchange_rate_lbp_per_usd: "89500",
        invoice_number: "INV-123",
        valid_until: "2026-06-05T17:30"
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected validation to pass.");

    expect(result.values).toMatchObject({
      amountUsd: 250,
      clientId: "client-1",
      currency: "USD",
      documentType: "invoice",
      exchangeRateLbpPerUsd: 89500,
      requestedInvoiceNumber: "INV-123",
      title: "May retainer"
    });
  });

  it("blocks deposit submissions before the create action runs when deposit details are invalid", () => {
    const result = validateInvoiceCreatorForm(
      creatorForm({
        ...validInvoice,
        deposit_enabled: "true",
        deposit_type: "percent",
        deposit_percent: "125"
      })
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected validation to fail.");

    expect(result.fieldErrors.deposit_percent).toBe("Deposit percent must be greater than 0 and no more than 100.");
  });
});
