import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPhone, paymentRequestMessage, whatsAppHref } from "@/lib/whatsapp";

describe("WhatsApp collection workflow", () => {
  it("normalizes Lebanese local and international numbers", () => {
    expect(normalizeWhatsAppPhone("03 123 456")).toBe("9613123456");
    expect(normalizeWhatsAppPhone("+961 70 123 456")).toBe("96170123456");
  });
  it("builds localized payment copy without claiming delivery", () => {
    expect(paymentRequestMessage({ clientName: "Maya", invoiceNumber: "INV-1", amount: "$100", paymentLink: "https://qaffel.online/pay/x" })).toContain("ready");
    expect(paymentRequestMessage({ invoiceNumber: "INV-1", amount: "$100", paymentLink: "https://qaffel.online/pay/x", locale: "ar" })).toContain("فاتورتك");
  });
  it("only creates a WhatsApp URL for a valid phone", () => {
    expect(whatsAppHref(null, "hello")).toBeNull();
    expect(whatsAppHref("03 123 456", "hello")).toContain("wa.me/9613123456");
  });
});
