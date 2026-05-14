import { isQuoteDocument } from "@/lib/documents";
import { formatPaymentMethod, money, shortDate } from "@/lib/format";
import { parsePaymentPlan } from "@/lib/payment-plan";
import { getDisplayInvoiceStatus, reconcileInvoiceStatus, type MinimalProof } from "@/lib/status";

export type ClientNoteCategory = "operational" | "payment" | "communication" | "recovery" | "general";
export type InvoiceNoteCategory = "project" | "delivery" | "revision" | "milestone" | "handoff" | "general";

export type ClientWorkspaceNoteRow = {
  id: string;
  client_id: string;
  category: ClientNoteCategory;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type InvoiceWorkspaceNoteRow = {
  id: string;
  invoice_id: string;
  category: InvoiceNoteCategory;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMessageTemplateRow = {
  id: string;
  category: "reminder" | "recovery" | "thank_you" | "follow_up" | "other";
  label: string;
  body: string;
  is_favorite: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
};

export type MemoryTimelineAccent = "neutral" | "payment" | "reminder" | "receipt" | "risk" | "note";

export type MemoryTimelineItem = {
  id: string;
  kind: "event" | "plan" | "client_note" | "invoice_note";
  at: string;
  title: string;
  detail?: string;
  invoiceId?: string;
  invoiceLabel?: string;
  href?: string;
  accent: MemoryTimelineAccent;
  meta?: string;
};

export type ContextBullet = {
  id: string;
  text: string;
  basis: string;
};

export type RelationshipSignal = {
  id: string;
  label: string;
  tone: "good" | "warn" | "neutral" | "info";
  basis: string;
};

type InvoiceEventRow = {
  id: string;
  invoice_id: string;
  event_type: string;
  message: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  collapsed_count?: number;
};

type InvoiceMemoryInput = {
  id: string;
  title: string;
  invoice_number?: string | null;
  document_type?: string | null;
  status: string;
  currency?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  due_date?: string | null;
  created_at: string;
  deposit_enabled?: boolean | null;
  payment_plan?: unknown;
  payment_proofs?: MinimalProof[] | null;
};

function invoiceLabel(inv: Pick<InvoiceMemoryInput, "title" | "invoice_number">) {
  return inv.invoice_number ? `${inv.invoice_number} · ${inv.title}` : inv.title;
}

function eventAccent(eventType: string): MemoryTimelineAccent {
  if (eventType.includes("proof") || eventType === "manual_payment") return "payment";
  if (eventType === "reminder_copied") return "reminder";
  if (eventType === "receipt_viewed") return "receipt";
  if (eventType.includes("deposit") || eventType === "payment_voided" || eventType === "invoice_expired") return "risk";
  return "neutral";
}

function collapseReceiptViewed(events: InvoiceEventRow[]): InvoiceEventRow[] {
  return events.reduce<InvoiceEventRow[]>((acc, event) => {
    const previous = acc[acc.length - 1];
    const isReceipt = event.event_type === "receipt_viewed";
    const sameAsPreviousReceipt =
      isReceipt &&
      previous &&
      previous.event_type === "receipt_viewed" &&
      previous.message === event.message;

    if (sameAsPreviousReceipt) {
      const current = Number((previous as InvoiceEventRow & { collapsed_count?: number }).collapsed_count || 1);
      (previous as InvoiceEventRow & { collapsed_count?: number }).collapsed_count = current + 1;
      return acc;
    }

    acc.push({ ...event, collapsed_count: 1 } as InvoiceEventRow);
    return acc;
  }, []);
}

const TIMELINE_EVENT_TYPES = new Set([
  "manual_payment",
  "proof_accepted",
  "proof_rejected",
  "proof_uploaded",
  "payment_voided",
  "deposit_satisfied",
  "deposit_requested",
  "reminder_copied",
  "receipt_viewed",
  "client_approved",
  "client_rejected",
  "payment_link_extended",
  "pay_link_regenerated",
  "invoice_paid",
  "invoice_partial",
  "invoice_sent",
  "invoice_unpaid",
  "invoice_overdue",
  "invoice_draft",
  "invoice_created",
  "quote_created",
  "quote_converted",
  "invoice_updated",
  "client_linked",
  "client_unlinked",
  "payment_plan_saved",
  "payment_plan_cleared",
  "payment_plan_milestone_updated",
  "invoice_expired"
]);

export function buildClientMemoryTimeline(input: {
  invoices: InvoiceMemoryInput[];
  events: InvoiceEventRow[];
  clientNotes: ClientWorkspaceNoteRow[];
  invoiceNotes: InvoiceWorkspaceNoteRow[];
}): MemoryTimelineItem[] {
  const invById = new Map(input.invoices.map((i) => [i.id, i]));
  const filteredEvents = input.events.filter((e) => invById.has(e.invoice_id));
  const collapsed = collapseReceiptViewed([...filteredEvents].sort((a, b) => a.created_at.localeCompare(b.created_at)));

  const items: MemoryTimelineItem[] = [];

  for (const e of collapsed) {
    if (!TIMELINE_EVENT_TYPES.has(e.event_type)) continue;
    const inv = invById.get(e.invoice_id);
    if (!inv) continue;
    const collapsedCount = (e as InvoiceEventRow & { collapsed_count?: number }).collapsed_count || 1;
    const detailExtra =
      e.event_type === "receipt_viewed" && collapsedCount > 1 ? ` (${collapsedCount} similar views grouped)` : undefined;

    items.push({
      id: `evt:${e.id}`,
      kind: "event",
      at: e.created_at,
      title: e.message,
      detail: detailExtra,
      invoiceId: inv.id,
      invoiceLabel: invoiceLabel(inv),
      href: `/invoices/${inv.id}`,
      accent: eventAccent(e.event_type),
      meta: e.event_type
    });
  }

  for (const inv of input.invoices) {
    const plan = parsePaymentPlan(inv.payment_plan);
    if (!plan) continue;
    for (const m of plan.milestones) {
      const primary = plan.currency;
      const amt = primary === "USD" ? Number(m.amount_usd || 0) : Number(m.amount_lbp || 0);
      if (amt <= 0) continue;
      const at = m.satisfied_at || (m.due_date ? `${m.due_date}T12:00:00.000Z` : inv.created_at);
      items.push({
        id: `plan:${inv.id}:${m.id}`,
        kind: "plan",
        at,
        title: m.satisfied_at ? "Payment plan milestone satisfied" : "Payment plan milestone",
        detail: `${money(primary === "USD" ? m.amount_usd : m.amount_lbp, primary)}${m.due_date ? ` · due ${shortDate(m.due_date)}` : ""}`,
        invoiceId: inv.id,
        invoiceLabel: invoiceLabel(inv),
        href: `/invoices/${inv.id}#payment-plan`,
        accent: m.satisfied_at ? "payment" : "neutral",
        meta: "payment_plan"
      });
    }
  }

  for (const n of input.clientNotes) {
    items.push({
      id: `cnote:${n.id}`,
      kind: "client_note",
      at: n.created_at,
      title: n.is_pinned ? `Pinned note · ${n.category}` : `Note · ${n.category}`,
      detail: n.body,
      accent: "note",
      meta: n.category
    });
  }

  for (const n of input.invoiceNotes) {
    const inv = invById.get(n.invoice_id);
    if (!inv) continue;
    items.push({
      id: `inote:${n.id}`,
      kind: "invoice_note",
      at: n.created_at,
      title: n.is_pinned ? `Work note (pinned) · ${n.category}` : `Work note · ${n.category}`,
      detail: n.body,
      invoiceId: inv.id,
      invoiceLabel: invoiceLabel(inv),
      href: `/invoices/${inv.id}#work-memory`,
      accent: "note",
      meta: n.category
    });
  }

  const seen = new Set<string>();
  const deduped: MemoryTimelineItem[] = [];
  for (const it of items.sort((a, b) => b.at.localeCompare(a.at))) {
    const key = `${it.kind}:${it.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }
  return deduped;
}

export function groupMemoryTimelineByDay(items: MemoryTimelineItem[]) {
  const groups = new Map<string, MemoryTimelineItem[]>();
  for (const it of items) {
    const day = it.at.slice(0, 10);
    const arr = groups.get(day) || [];
    arr.push(it);
    groups.set(day, arr);
  }
  const keys = [...groups.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map((day) => ({ day, items: groups.get(day) || [] }));
}

function normalizeMethod(method: string | null | undefined) {
  const m = (method || "").trim();
  if (!m) return "";
  return formatPaymentMethod(m) || m;
}

export function deriveClientContextBullets(input: {
  invoices: InvoiceMemoryInput[];
  events: Pick<InvoiceEventRow, "event_type" | "invoice_id">[];
}): ContextBullet[] {
  const bullets: ContextBullet[] = [];
  const billable = input.invoices.filter((i) => !isQuoteDocument(i));
  if (billable.length === 0) return bullets;

  const methodCounts = new Map<string, number>();
  let acceptedPayments = 0;
  for (const inv of billable) {
    const proofs = inv.payment_proofs || [];
    for (const p of proofs) {
      if (p.status !== "accepted") continue;
      acceptedPayments += 1;
      const key = normalizeMethod((p as { method?: string | null }).method);
      if (key) methodCounts.set(key, (methodCounts.get(key) || 0) + 1);
    }
  }

  let topMethod: { key: string; n: number } | null = null;
  for (const [key, n] of methodCounts) {
    if (!topMethod || n > topMethod.n) topMethod = { key, n };
  }
  if (topMethod && acceptedPayments >= 2 && topMethod.n / acceptedPayments >= 0.45) {
    bullets.push({
      id: "pref-method",
      text: `Often pays via ${topMethod.key} (${topMethod.n} of ${acceptedPayments} recorded payments).`,
      basis: "Accepted payment methods on file."
    });
  }

  const reminderEvents = input.events.filter((e) => e.event_type === "reminder_copied");
  if (reminderEvents.length >= 3 && acceptedPayments >= 1) {
    bullets.push({
      id: "reminder-use",
      text: `Reminder copy used ${reminderEvents.length} times across linked invoices.`,
      basis: "Workspace reminder events (manual copy / WhatsApp open from follow-up)."
    });
  }

  const partialInvoices = billable.filter((inv) => {
    const proofs = (inv.payment_proofs || []) as MinimalProof[];
    const rec = reconcileInvoiceStatus(inv as any, proofs);
    return getDisplayInvoiceStatus({ ...inv, status: rec }) === "partial";
  });
  if (partialInvoices.length > 0) {
    bullets.push({
      id: "partial-open",
      text: `${partialInvoices.length} invoice${partialInvoices.length === 1 ? "" : "s"} currently show a partial balance.`,
      basis: "Reconciled invoice status today."
    });
  }

  const depositInvoices = billable.filter((inv) => inv.deposit_enabled);
  if (depositInvoices.length > 0) {
    bullets.push({
      id: "deposits",
      text: `Deposit requested on ${depositInvoices.length} invoice${depositInvoices.length === 1 ? "" : "s"}.`,
      basis: "Invoice deposit settings."
    });
  }

  return bullets.slice(0, 6);
}

export function deriveRelationshipSignals(input: {
  invoices: InvoiceMemoryInput[];
  events: Pick<InvoiceEventRow, "event_type" | "invoice_id" | "created_at">[];
}): RelationshipSignal[] {
  const signals: RelationshipSignal[] = [];
  const billable = input.invoices.filter((i) => !isQuoteDocument(i));
  if (billable.length === 0) return signals;

  if (billable.length >= 2) {
    signals.push({
      id: "repeat",
      label: "Repeat client",
      tone: "good",
      basis: `${billable.length} billable invoices on file.`
    });
  }

  const overdueNow = billable.filter((inv) => {
    const proofs = (inv.payment_proofs || []) as MinimalProof[];
    const rec = reconcileInvoiceStatus(inv as any, proofs);
    return getDisplayInvoiceStatus({ ...inv, status: rec }) === "overdue";
  });
  if (overdueNow.length > 0) {
    signals.push({
      id: "overdue-now",
      label: "Overdue balance",
      tone: "warn",
      basis: `${overdueNow.length} invoice${overdueNow.length === 1 ? "" : "s"} currently overdue.`
    });
  }

  const reminderCount = input.events.filter((e) => e.event_type === "reminder_copied").length;
  const acceptedCount = billable.reduce(
    (n, inv) => n + (inv.payment_proofs || []).filter((p) => p.status === "accepted").length,
    0
  );
  if (reminderCount >= 6 && acceptedCount >= 1) {
    signals.push({
      id: "recovery-heavy",
      label: "Recovery-heavy",
      tone: "warn",
      basis: `${reminderCount} reminder events vs ${acceptedCount} accepted payment lines.`
    });
  }

  if (acceptedCount >= 2 && overdueNow.length === 0 && reminderCount <= 1) {
    signals.push({
      id: "healthy-payer",
      label: "Healthy payer pattern",
      tone: "good",
      basis: "Multiple accepted payments and little reminder activity while current balances are clean."
    });
  }

  const stampDates: string[] = [];
  for (const inv of billable) {
    stampDates.push(inv.created_at);
    for (const p of inv.payment_proofs || []) {
      const pr = p as {
        status: string;
        confirmed_at?: string | null;
        payment_date?: string | null;
        uploaded_at?: string | null;
      };
      if (pr.status !== "accepted") continue;
      if (pr.payment_date) stampDates.push(pr.payment_date);
      if (pr.confirmed_at) stampDates.push(pr.confirmed_at);
      if (pr.uploaded_at) stampDates.push(pr.uploaded_at);
    }
  }
  for (const e of input.events) {
    stampDates.push(e.created_at);
  }
  const lastActivity = stampDates.filter(Boolean).sort((a, b) => b.localeCompare(a))[0];

  if (lastActivity) {
    const days = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86400000);
    if (days > 120 && billable.length > 0) {
      signals.push({
        id: "inactive",
        label: "Inactive recently",
        tone: "neutral",
        basis: `No invoice, event, or accepted payment activity recorded in roughly ${days} days.`
      });
    }
  }

  const voided = billable.reduce((n, inv) => n + (inv.payment_proofs || []).filter((p) => p.status === "voided").length, 0);
  if (voided > 0) {
    signals.push({
      id: "voids",
      label: "Payment corrections",
      tone: "info",
      basis: `${voided} voided payment line${voided === 1 ? "" : "s"} on record.`
    });
  }

  return signals.slice(0, 8);
}

export const CLIENT_NOTE_CATEGORY_LABELS: Record<ClientNoteCategory, string> = {
  operational: "Operational",
  payment: "Payment",
  communication: "Communication",
  recovery: "Recovery",
  general: "General"
};

export const INVOICE_NOTE_CATEGORY_LABELS: Record<InvoiceNoteCategory, string> = {
  project: "Project",
  delivery: "Delivery",
  revision: "Revision",
  milestone: "Milestone",
  handoff: "Handoff",
  general: "General"
};
