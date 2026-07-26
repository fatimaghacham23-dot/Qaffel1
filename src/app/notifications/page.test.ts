import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/notifications/page.tsx"), "utf8");

describe("notifications page structure", () => {
  it("provides URL-backed filters and specific empty states", () => {
    for (const label of ["All", "Action required", "Onboarding", "Payments", "Team", "System"]) expect(source).toContain(label);
    for (const empty of ["No actions require attention right now.", "No onboarding items match this filter.", "No payment or collection items match this filter.", "No team or operational items match this filter.", "No system notifications are available."]) expect(source).toContain(empty);
    expect(source).toContain("aria-label=\"Notification filters\"");
  });

  it("uses an accessible responsive row layout without read-state controls", () => {
    expect(source).toContain("flex flex-col gap-3 py-4 sm:flex-row");
    expect(source).toContain("min-w-0");
    expect(source).toContain("aria-label=\"Notifications\"");
    expect(source).not.toMatch(/mark.*read|unread/i);
  });
});
