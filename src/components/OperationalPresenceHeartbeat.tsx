"use client";

import { useEffect } from "react";
import { recordOperationalPresenceAction } from "@/app/presence-actions";
import type { OperationalPresenceEntityType, OperationalPresenceScope } from "@/lib/operational-presence";

type OperationalPresenceHeartbeatProps = {
  scope: OperationalPresenceScope;
  entityType?: OperationalPresenceEntityType;
  entityId?: string;
  label: string;
  targetHref: string;
};

export function OperationalPresenceHeartbeat({
  scope,
  entityType = "workspace",
  entityId = "workspace",
  label,
  targetHref
}: OperationalPresenceHeartbeatProps) {
  useEffect(() => {
    let cancelled = false;
    let lastPing = 0;

    const ping = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastPing < 60_000) return;
      lastPing = now;
      void recordOperationalPresenceAction({ scope, entityType, entityId, label, targetHref }).catch(() => {
        // Presence is supportive context only; the workspace should keep working if it cannot be recorded.
      });
    };

    ping();
    const interval = window.setInterval(ping, 4 * 60_000);
    window.addEventListener("focus", ping);
    document.addEventListener("visibilitychange", ping);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", ping);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [entityId, entityType, label, scope, targetHref]);

  return null;
}
