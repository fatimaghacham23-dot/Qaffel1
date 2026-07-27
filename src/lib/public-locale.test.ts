import { describe, expect, it } from "vitest";
import { publicLocaleDirection, publicLocaleHref, resolvePublicLang } from "@/lib/public-locale";

describe("public payment locale", () => {
  it("accepts only the supported Arabic locale and defaults safely to English", () => {
    expect(resolvePublicLang("ar")).toBe("ar");
    expect(resolvePublicLang("en")).toBe("en");
    expect(resolvePublicLang("AR")).toBe("en");
    expect(resolvePublicLang("unexpected")).toBe("en");
    expect(resolvePublicLang(null)).toBe("en");
  });

  it("maps public language to a document direction", () => {
    expect(publicLocaleDirection("en")).toBe("ltr");
    expect(publicLocaleDirection("ar")).toBe("rtl");
  });

  it("preserves safe public query context when switching language", () => {
    const search = new URLSearchParams("uploaded=1&method=whish&lang=en");
    expect(publicLocaleHref("/pay/public-token", "ar", search)).toBe(
      "/pay/public-token?uploaded=1&method=whish&lang=ar"
    );
  });
});
