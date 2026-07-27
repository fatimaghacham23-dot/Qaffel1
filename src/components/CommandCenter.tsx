"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Clock3,
  Command,
  FileCheck2,
  FileText,
  Gauge,
  Bookmark,
  StickyNote,
  HelpCircle,
  PlusCircle,
  ReceiptText,
  Search,
  Settings,
  Sparkles,
  Users,
  X
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  COMMAND_RECENTS_KEY,
  MAX_COMMAND_RECENTS,
  safeRecentDestination,
  type CommandItem,
  type CommandItemType,
  type CommandSearchResponse,
  sortCommandItems,
  staticCommandItems
} from "@/lib/command-center";
import { cn } from "@/lib/utils";
import { startRouteTransition } from "@/components/RouteTransitionIndicator";

type CommandCenterProps = {
  enabled?: boolean;
};

type CommandSection = {
  title: string;
  items: CommandItem[];
};

type CommandEntry = {
  section: string;
  item: CommandItem;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function readStoredItems(key: string): CommandItem[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is CommandItem => Boolean(item?.id && item?.title && item?.href && item?.type))
      .map(safeRecentDestination)
      .filter((item): item is CommandItem => item !== null)
      .slice(0, MAX_COMMAND_RECENTS);
  } catch {
    return [];
  }
}

function saveStoredItems(items: CommandItem[]) {
  try {
    window.localStorage.setItem(COMMAND_RECENTS_KEY, JSON.stringify(items.slice(0, MAX_COMMAND_RECENTS)));
  } catch {
    // Recents are supportive only; private-mode storage should not break navigation.
  }
}

function itemIcon(type: CommandItemType, id: string) {
  if (id.startsWith("action:new")) return PlusCircle;
  if (id === "help:shortcuts") return HelpCircle;
  if (id.includes("recovery") || type === "recovery") return CircleDollarSign;

  const icons = {
    action: Sparkles,
    client: Users,
    invoice: FileText,
    navigation: Gauge,
    proof: FileCheck2,
    report: BarChart3,
    setting: Settings,
    memory: StickyNote,
    template: Bookmark
  } satisfies Record<Exclude<CommandItemType, "recovery">, typeof Search>;

  return icons[type] || Search;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-bold text-slate-500 shadow-[inset_0_-1px_0_rgba(15,23,42,0.05)]">
      {children}
    </kbd>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return <>{text}</>;

  const lower = text.toLowerCase();
  const index = lower.indexOf(cleanQuery);
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-cedar/10 px-0.5 font-semibold text-cedar">{text.slice(index, index + cleanQuery.length)}</mark>
      {text.slice(index + cleanQuery.length)}
    </>
  );
}

function ShortcutsHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const shortcuts = [
    { keys: ["Ctrl/Cmd", "K"], label: "Open command center" },
    { keys: ["/"], label: "Open search from anywhere" },
    { keys: ["G", "D"], label: "Go to dashboard" },
    { keys: ["G", "I"], label: "Go to invoices" },
    { keys: ["G", "P"], label: "Go to proofs" },
    { keys: ["G", "R"], label: "Go to recoveries" },
    { keys: ["C"], label: "Create invoice or quote" },
    { keys: ["Esc"], label: "Close menus and modals" },
    { keys: ["Up/Down"], label: "Move through command results" },
    { keys: ["Enter"], label: "Open selected result" }
  ];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/25 px-4 py-6 backdrop-blur-[12px] print:hidden"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            aria-labelledby="command-shortcuts-title"
            aria-modal="true"
            role="dialog"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/60 bg-white/[0.97] shadow-[var(--q-shadow-modal)] backdrop-blur-2xl"
            initial={reduceMotion ? false : { y: 12, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: 8, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="q-section-label text-cedar">Shortcuts</p>
                <h2 id="command-shortcuts-title" className="mt-1 text-lg font-bold text-ink">
                  Move faster in Qaffel
                </h2>
              </div>
              <button
                aria-label="Close shortcuts"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-2 p-4">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">{shortcut.label}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {shortcut.keys.map((key) => (
                      <Kbd key={`${shortcut.label}-${key}`}>{key}</Kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function CommandCenter({ enabled = true }: CommandCenterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteItems, setRemoteItems] = useState<CommandItem[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recents, setRecents] = useState<CommandItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const chordRef = useRef<{ key: string; at: number } | null>(null);

  const disabledRoute = /^\/(pay|receipt|client)(\/|$)/.test(pathname || "") || pathname === "/" || pathname === "/login" || pathname.startsWith("/auth");
  const active = enabled && !disabledRoute;
  const trimmedQuery = query.trim();

  const openPalette = () => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : triggerRef.current;
    setSelectedIndex(0);
    setOpen(true);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setRecents(readStoredItems(COMMAND_RECENTS_KEY));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !trimmedQuery) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setRemoteLoading(true);
      try {
        const response = await fetch(`/api/command/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Search failed");
        const data = (await response.json()) as CommandSearchResponse;
        setRemoteItems(data.items || []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setRemoteItems([]);
        }
      } finally {
        if (!controller.signal.aborted) setRemoteLoading(false);
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, trimmedQuery]);

  const sections = useMemo<CommandSection[]>(() => {
    if (trimmedQuery) {
      return [
        {
          title: "Actions",
          items: sortCommandItems(staticCommandItems, trimmedQuery).slice(0, 8)
        },
        {
          title: "Workspace results",
          items: remoteItems
        }
      ].filter((section) => section.items.length > 0);
    }

    const topActions = staticCommandItems.filter((item) => item.group === "Actions").slice(0, 6);
    const navigation = staticCommandItems.filter((item) => item.group === "Navigation").slice(0, 12);
    const settings = staticCommandItems.filter((item) => item.group === "Settings").slice(0, 6);
    return [
      { title: "Recent destinations", items: recents },
      { title: "Quick actions", items: topActions },
      { title: "Navigation", items: navigation },
      { title: "Settings", items: settings }
    ].filter((section) => section.items.length > 0);
  }, [recents, remoteItems, trimmedQuery]);

  const entries = useMemo<CommandEntry[]>(
    () => sections.flatMap((section) => section.items.map((item) => ({ section: section.title, item }))),
    [sections]
  );
  const safeSelectedIndex = entries.length > 0 ? Math.min(Math.max(selectedIndex, 0), entries.length - 1) : 0;

  useEffect(() => {
    if (!open) return;
    document.getElementById(`command-entry-${safeSelectedIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, safeSelectedIndex]);

  const rememberItem = (item: CommandItem) => {
    const safeItem = safeRecentDestination(item);
    if (!safeItem) return;

    const next = [safeItem, ...recents.filter((recent) => recent.id !== safeItem.id)].slice(0, MAX_COMMAND_RECENTS);
    setRecents(next);
    saveStoredItems(next);
  };

  const runItem = (item: CommandItem) => {
    if (item.id === "help:shortcuts") {
      setOpen(false);
      setHelpOpen(true);
      return;
    }

    rememberItem(item);
    setOpen(false);
    setQuery("");
    setRemoteItems([]);
    setRemoteLoading(false);
    setSelectedIndex(0);
    startRouteTransition();
    router.push(item.href);
  };

  const closePalette = () => {
    setOpen(false);
    setQuery("");
    setRemoteItems([]);
    setRemoteLoading(false);
    setSelectedIndex(0);
    window.setTimeout(() => (previousFocusRef.current || triggerRef.current)?.focus(), 0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
    if (!value.trim()) {
      setRemoteItems([]);
      setRemoteLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;

    const go = (href: string) => {
      startRouteTransition();
      router.push(href);
      toast.message("Jumped", { description: href.replace("/", "") || "dashboard" });
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
        return;
      }

      if (event.key === "Escape") {
        if (open) closePalette();
        if (helpOpen) setHelpOpen(false);
        return;
      }

      if (open || helpOpen || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "/") {
        event.preventDefault();
        openPalette();
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      const previous = chordRef.current;
      if (previous?.key === "g" && Date.now() - previous.at < 900) {
        const destinations: Record<string, string> = {
          d: "/dashboard",
          i: "/invoices",
          p: "/proofs",
          r: "/recoveries"
        };
        const href = destinations[key];
        chordRef.current = null;
        if (href) {
          event.preventDefault();
          go(href);
        }
        return;
      }

      if (key === "g") {
        chordRef.current = { key: "g", at: Date.now() };
        return;
      }

      if (key === "c") {
        event.preventDefault();
        go("/invoices/new");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, helpOpen, open, router, pathname]);

  const handlePaletteKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (entries.length === 0) return;
      setSelectedIndex((current) => Math.min(entries.length - 1, current + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (entries.length === 0) return;
      setSelectedIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (event.key === "Enter" && entries[safeSelectedIndex]) {
      event.preventDefault();
      runItem(entries[safeSelectedIndex].item);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
      return;
    }

    if (event.key === "Tab") {
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("[data-command-focusable]") || []);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  if (!active) return null;

  return (
    <>
      <button
        ref={triggerRef}
        aria-keyshortcuts="Control+K Meta+K"
        aria-label="Open command center"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-4 z-50 inline-flex h-11 items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 text-sm font-semibold text-ink backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cedar/20 hover:text-cedar focus:outline-none focus:ring-2 focus:ring-cedar/30 sm:bottom-5 sm:px-4 print:hidden"
        style={{ boxShadow: "var(--q-shadow-float)", transitionDuration: "var(--q-duration-normal)", transitionTimingFunction: "var(--q-ease)" }}
        onClick={openPalette}
        type="button"
      >
        <Command className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Command</span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[80] bg-slate-950/20 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-[12px] sm:px-4 sm:pt-[12vh] print:hidden"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closePalette();
            }}
          >
            <motion.div
              ref={panelRef}
              aria-label="Command center"
              aria-modal="true"
              role="dialog"
              className="mx-auto flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/[0.97] backdrop-blur-2xl"
              style={{ boxShadow: "var(--q-shadow-modal)" }}
              initial={reduceMotion ? false : { y: 12, scale: 0.97, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={reduceMotion ? undefined : { y: 8, scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              onKeyDown={handlePaletteKeyDown}
            >
              <div className="flex items-center gap-3 border-b border-slate-100/60 px-4 py-3 sm:px-5">
                <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
                <input
                  ref={inputRef}
                  aria-activedescendant={entries[safeSelectedIndex] ? `command-entry-${safeSelectedIndex}` : undefined}
                  aria-controls="command-results"
                  aria-expanded="true"
                  aria-label="Search Qaffel commands and records"
                  className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-ink outline-none placeholder:text-slate-400 placeholder:transition-opacity placeholder:duration-q focus:placeholder:opacity-40"
                  data-command-focusable
                  onChange={(event) => handleQueryChange(event.target.value)}
                  placeholder="Search invoices, clients, proofs, recoveries..."
                  role="combobox"
                  value={query}
                />
                <button
                  aria-label="Open keyboard shortcuts"
                  className="hidden h-9 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 transition hover:border-cedar/20 hover:bg-cedar/5 hover:text-cedar sm:inline-flex"
                  data-command-focusable
                  onClick={() => {
                    setOpen(false);
                    setHelpOpen(true);
                  }}
                  type="button"
                >
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  Shortcuts
                </button>
                <button
                  aria-label="Close command center"
                  className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-ink"
                  data-command-focusable
                  onClick={closePalette}
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div id="command-results" className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3" role="listbox">
                {sections.length > 0 ? (
                  <div className="grid gap-3">
                    {sections.map((section) => (
                      <section key={section.title}>
                        <div className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{section.title}</div>
                        <div className="grid gap-1">
                          {section.items.map((item) => {
                            const absoluteIndex = entries.findIndex((entry) => entry.item.id === item.id && entry.section === section.title);
                            const selected = absoluteIndex === safeSelectedIndex;
                            const currentPage = item.href.split(/[?#]/)[0] === pathname;
                            const Icon = itemIcon(item.type, item.id);

                            return (
                              <button
                                key={`${section.title}-${item.id}`}
                                id={`command-entry-${absoluteIndex}`}
                                aria-selected={selected}
                                className={cn(
                                  "group flex min-h-[64px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                                  selected
                                    ? "bg-cedar text-white"
                                    : "bg-white text-ink hover:bg-slate-50/70"
                                )}
                                style={{
                                  boxShadow: selected ? "0 4px 16px -6px rgba(17, 100, 102, 0.35)" : undefined,
                                  transition: `background-color var(--q-duration-fast) var(--q-ease), box-shadow var(--q-duration-fast) var(--q-ease)`
                                }}
                                data-command-focusable
                                onMouseEnter={() => setSelectedIndex(Math.max(0, absoluteIndex))}
                                onClick={() => runItem(item)}
                                role="option"
                                type="button"
                              >
                                <span
                                  className={cn(
                                    "grid h-10 w-10 shrink-0 place-items-center rounded-2xl border transition",
                                    selected ? "border-white/20 bg-white/15 text-white" : "border-slate-200 bg-slate-50 text-slate-500 group-hover:text-cedar"
                                  )}
                                >
                                  <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-bold">
                                    <Highlight text={item.title} query={query} />
                                  </span>
                                  {item.subtitle ? (
                                    <span className={cn("mt-0.5 block truncate text-xs", selected ? "text-white/75" : "text-slate-500")}>
                                      <Highlight text={item.subtitle} query={query} />
                                    </span>
                                  ) : null}
                                </span>
                                <span className="flex shrink-0 items-center gap-2">
                                  {item.shortcut ? <Kbd>{item.shortcut}</Kbd> : null}
                                  {currentPage || item.badge ? (
                                    <span
                                      className={cn(
                                        "hidden rounded-full px-2 py-1 text-[11px] font-bold sm:inline-flex",
                                        selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                                      )}
                                    >
                                      {currentPage ? "Current page" : item.badge}
                                    </span>
                                  ) : null}
                                  <ArrowRight className={cn("h-4 w-4", selected ? "text-white" : "text-slate-300")} aria-hidden="true" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : remoteLoading ? (
                  <div className="grid gap-2 p-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="q-skeleton h-16 rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-[260px] place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
                    <div>
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-400 shadow-soft">
                        <Search className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h3 className="mt-4 text-base font-bold text-ink">No matching command</h3>
                      <p className="mt-1 max-w-sm text-sm text-slate-500">
                        Try an invoice number, client name, proof status, or workflow like recovery.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100/50 bg-slate-50/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {remoteLoading ? "Searching workspace..." : "Arrow keys to move, Enter to open"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Kbd>Esc</Kbd>
                    Close
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <ShortcutsHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
