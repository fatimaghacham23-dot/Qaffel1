import { describe, expect, it } from "vitest";
import { resolvePaymentView } from "@/lib/payments-view";
describe("payment view routing", () => { it("defaults to awaiting when work exists", () => expect(resolvePaymentView(undefined, 1)).toBe("awaiting")); it("defaults to history when clear", () => expect(resolvePaymentView(undefined, 0)).toBe("history")); it("falls back safely", () => expect(resolvePaymentView("bad", 0)).toBe("history")); });
