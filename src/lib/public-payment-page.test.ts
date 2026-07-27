import { describe, expect, it } from "vitest";
import { parsePublicPaymentPageData } from "@/lib/public-payment-page";

describe("public payment page projection", () => {
  it("accepts a matching token-scoped projection", () => {
    const parsed = parsePublicPaymentPageData(
      {
        invoice: { id: "invoice-1", user_id: "owner-1", public_token: "token-1" },
        profile: { business_name: "Merchant" },
        proofs: [{ status: "pending", amount_usd: 10 }],
        methods: [{ type: "cash" }]
      },
      "token-1"
    );

    expect(parsed?.invoice.id).toBe("invoice-1");
    expect(parsed?.proofs).toHaveLength(1);
    expect(parsed?.methods).toHaveLength(1);
  });

  it("rejects a mismatched or malformed token projection", () => {
    expect(
      parsePublicPaymentPageData(
        { invoice: { id: "invoice-1", user_id: "owner-1", public_token: "other" } },
        "token-1"
      )
    ).toBeNull();
    expect(parsePublicPaymentPageData(null, "token-1")).toBeNull();
  });
});
