import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { notificationBadgeLabel } from "@/components/NotificationBell";

const source = readFileSync(resolve(process.cwd(), "src/components/NotificationBell.tsx"), "utf8");
const dashboard = readFileSync(resolve(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");
const notifications = readFileSync(resolve(process.cwd(), "src/app/notifications/page.tsx"), "utf8");

describe("notification bell and shared integration", () => {
  it("formats zero, ordinary, and capped action counts", () => {
    expect(notificationBadgeLabel(0)).toBe("0"); expect(notificationBadgeLabel(4)).toBe("4"); expect(notificationBadgeLabel(100)).toBe("99+");
  });
  it("contains accessible popover, keyboard, outside-click and mobile-safe structure", () => {
    for (const token of ["aria-controls=\"notification-preview\"", "event.key === \"Escape\"", "document.addEventListener(\"mousedown\"", "buttonRef.current?.focus()", "w-[min(24rem,calc(100vw-2rem))]", "end-0", "View all notifications", "You’re all caught up"]) expect(source).toContain(token);
    expect(source).not.toMatch(/unread|mark.*read/i);
  });
  it("uses the shared server derivation service from dashboard and notifications", () => {
    expect(dashboard).toContain("getWorkspaceNotifications"); expect(dashboard).toContain("notificationPreview");
    expect(notifications).toContain("getWorkspaceNotifications");
  });
});
