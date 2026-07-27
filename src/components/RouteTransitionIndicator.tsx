"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const internalNavigation = (anchor: HTMLAnchorElement) => {
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  return url.protocol === window.location.protocol && url.host === window.location.host && (url.pathname !== window.location.pathname || url.search !== window.location.search || url.hash !== window.location.hash);
};

export function RouteTransitionIndicator() {
  const [pending, setPending] = useState(false);
  const clearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const begin = () => {
      setPending(true);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = window.setTimeout(() => setPending(false), 900);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]");
      if (anchor instanceof HTMLAnchorElement && internalNavigation(anchor)) begin();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("qaffel:route-start", begin);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("qaffel:route-start", begin);
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  return <div aria-hidden="true" className={pending ? "pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 origin-left bg-cedar motion-safe:animate-[qaffel-route-progress_900ms_ease-in-out_infinite] motion-reduce:animate-none" : "hidden"} />;
}

export function startRouteTransition() {
  window.dispatchEvent(new Event("qaffel:route-start"));
}
