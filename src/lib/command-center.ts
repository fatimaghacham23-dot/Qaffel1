export type CommandItemType =
  | "action"
  | "client"
  | "invoice"
  | "navigation"
  | "proof"
  | "recovery"
  | "report"
  | "setting"
  | "memory"
  | "template";

export type CommandItem = {
  id: string;
  type: CommandItemType;
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
  group?: string;
  keywords?: string[];
  shortcut?: string;
};

export type CommandSearchResponse = {
  items: CommandItem[];
};

export const COMMAND_RECENTS_KEY = "qaffel-command-recents-v1";
export const COMMAND_SEARCHES_KEY = "qaffel-command-searches-v1";

export const staticCommandItems: CommandItem[] = [
  {
    id: "action:new-invoice",
    type: "action",
    title: "New invoice or quote",
    subtitle: "Create a billable document",
    href: "/invoices/new",
    badge: "Create",
    group: "Actions",
    shortcut: "C",
    keywords: ["create", "invoice", "quote", "bill", "new"]
  },
  {
    id: "action:new-client",
    type: "action",
    title: "New client",
    subtitle: "Add a client profile",
    href: "/clients/new",
    badge: "Create",
    group: "Actions",
    keywords: ["create", "customer", "contact"]
  },
  {
    id: "action:record-payment",
    type: "action",
    title: "Record payment",
    subtitle: "Open invoices to choose a payment target",
    href: "/invoices",
    badge: "Manual",
    group: "Actions",
    keywords: ["payment", "manual", "proof", "paid"]
  },
  {
    id: "action:review-proofs",
    type: "action",
    title: "Review payment proofs",
    subtitle: "Open the pending proof queue",
    href: "/proofs",
    badge: "Review",
    group: "Actions",
    keywords: ["proofs", "approval", "payments", "whish", "omt"]
  },
  {
    id: "action:recovery",
    type: "action",
    title: "Start recovery workflow",
    subtitle: "Prioritize overdue files and reminders",
    href: "/recoveries",
    badge: "Recovery",
    group: "Actions",
    keywords: ["overdue", "reminder", "whatsapp", "collect"]
  },
  {
    id: "help:shortcuts",
    type: "action",
    title: "Keyboard shortcuts",
    subtitle: "Open the command and navigation shortcut guide",
    href: "#shortcuts",
    badge: "Help",
    group: "Actions",
    shortcut: "?",
    keywords: ["help", "keys", "keyboard", "commands"]
  },
  {
    id: "nav:dashboard",
    type: "navigation",
    title: "Dashboard",
    subtitle: "Mission control and operational priorities",
    href: "/dashboard",
    group: "Navigation",
    shortcut: "G D",
    keywords: ["home", "mission control", "cockpit"]
  },
  {
    id: "nav:dashboard-priorities",
    type: "navigation",
    title: "Today's priorities",
    subtitle: "Jump to the active operations queue",
    href: "/dashboard#priorities",
    group: "Navigation",
    keywords: ["priority", "queue", "urgent"]
  },
  {
    id: "nav:dashboard-financial",
    type: "navigation",
    title: "Financial snapshot",
    subtitle: "Cash position, paid totals, and risk",
    href: "/dashboard#financial-snapshot",
    group: "Navigation",
    keywords: ["cash", "money", "chart", "kpi"]
  },
  {
    id: "nav:dashboard-operations",
    type: "navigation",
    title: "Live operations",
    subtitle: "Review queues, follow-ups, and payments",
    href: "/dashboard#live-operations",
    group: "Navigation",
    keywords: ["operations", "workflow", "queue"]
  },
  {
    id: "nav:invoices",
    type: "navigation",
    title: "Invoices",
    subtitle: "Search and manage invoices",
    href: "/invoices",
    group: "Navigation",
    shortcut: "G I",
    keywords: ["bills", "quotes", "documents"]
  },
  {
    id: "nav:proofs",
    type: "navigation",
    title: "Proofs",
    subtitle: "Manual payment review queue",
    href: "/proofs",
    group: "Navigation",
    shortcut: "G P",
    keywords: ["payments", "screenshots", "approval"]
  },
  {
    id: "nav:recoveries",
    type: "navigation",
    title: "Recoveries",
    subtitle: "Overdue invoices and reminder workflows",
    href: "/recoveries",
    group: "Navigation",
    shortcut: "G R",
    keywords: ["overdue", "collections", "reminders"]
  },
  {
    id: "nav:clients",
    type: "navigation",
    title: "Clients",
    subtitle: "Contacts, balances, and client portals",
    href: "/clients",
    group: "Navigation",
    keywords: ["customers", "contacts", "portal"]
  },
  {
    id: "nav:reports",
    type: "report",
    title: "Reports",
    subtitle: "Revenue, outstanding balances, and exports",
    href: "/reports",
    group: "Navigation",
    keywords: ["analytics", "numbers", "finance"]
  },
  {
    id: "nav:export",
    type: "report",
    title: "Export workspace data",
    subtitle: "Download operational records",
    href: "/export",
    group: "Navigation",
    keywords: ["csv", "download", "records"]
  },
  {
    id: "settings:payment-methods",
    type: "setting",
    title: "Payment methods",
    subtitle: "Whish, OMT, bank transfer, and public payment instructions",
    href: "/settings/payment-methods",
    group: "Settings",
    keywords: ["settings", "wallet", "whish", "omt", "bank"]
  },
  {
    id: "settings:profile",
    type: "setting",
    title: "Business profile",
    subtitle: "Brand, identity, phone, and receipt details",
    href: "/settings/profile",
    group: "Settings",
    keywords: ["settings", "business", "brand", "receipt"]
  },
  {
    id: "settings:presets",
    type: "setting",
    title: "Service presets",
    subtitle: "Reusable invoice line items",
    href: "/settings/service-presets",
    group: "Settings",
    keywords: ["settings", "services", "templates"]
  }
];

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function commandHaystack(item: CommandItem) {
  return normalizeText([item.title, item.subtitle, item.badge, item.group, ...(item.keywords || [])].filter(Boolean).join(" "));
}

function subsequenceScore(text: string, query: string) {
  let textIndex = 0;
  let score = 0;
  let streak = 0;

  for (const char of query) {
    const found = text.indexOf(char, textIndex);
    if (found === -1) return 0;

    const gap = found - textIndex;
    streak = gap === 0 ? streak + 1 : 1;
    score += Math.max(2, 16 - gap) + streak;
    textIndex = found + 1;
  }

  return score;
}

export function scoreCommandItem(item: CommandItem, rawQuery: string) {
  const query = normalizeText(rawQuery);
  if (!query) return item.type === "action" ? 20 : 8;

  const title = normalizeText(item.title);
  const haystack = commandHaystack(item);
  const tokens = query.split(" ").filter(Boolean);

  if (title === query) return 500;
  if (title.startsWith(query)) return 420 - title.length;
  if (haystack.includes(query)) return 320 - haystack.indexOf(query);

  let total = 0;
  for (const token of tokens) {
    if (title.startsWith(token)) {
      total += 120;
      continue;
    }

    const wordStart = haystack.split(" ").some((word) => word.startsWith(token));
    if (wordStart) {
      total += 90;
      continue;
    }

    if (haystack.includes(token)) {
      total += 60;
      continue;
    }

    const subsequence = subsequenceScore(haystack, token);
    if (subsequence > 0) {
      total += subsequence;
      continue;
    }

    return 0;
  }

  return total;
}

export function sortCommandItems(items: CommandItem[], query: string) {
  return [...items]
    .map((item) => ({ item, score: scoreCommandItem(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .map(({ item }) => item);
}
