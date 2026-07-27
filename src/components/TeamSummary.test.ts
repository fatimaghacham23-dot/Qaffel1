import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeamSummary } from "@/components/TeamSummary";

describe("TeamSummary", () => {
  it("keeps People summary values separate without mojibake and with RTL-safe structure", () => {
    const markup = renderToStaticMarkup(createElement(TeamSummary, { additionalMemberCount: 2, pendingInvitationCount: 3 }));

    expect(markup).not.toContain("\u00c3\u201a");
    expect(markup).toContain("Additional members: 2");
    expect(markup).toContain("Pending invitations: 3");
    expect(markup).toContain('dir="auto"');
    expect((markup.match(/<span/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
