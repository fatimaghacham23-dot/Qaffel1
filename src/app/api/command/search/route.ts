import { NextRequest, NextResponse } from "next/server";
import { type CommandItem, sortCommandItems } from "@/lib/command-center";
import { money, shortDate } from "@/lib/format";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoiceSearchRow = {
  id: string;
  invoice_number?: string | null;
  title?: string | null;
  status?: string | null;
  document_type?: string | null;
  due_date?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  currency?: string | null;
  clients?: { name?: string | null } | { name?: string | null }[] | null;
};

type ClientSearchRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string | null;
};

type ClientNoteSearchRow = {
  id: string;
  category: string;
  body: string;
  client_id: string;
  clients?: { name?: string | null } | { name?: string | null }[] | null;
};

type InvoiceNoteSearchRow = {
  id: string;
  category: string;
  body: string;
  invoice_id: string;
  invoices?:
    | { id?: string | null; title?: string | null; invoice_number?: string | null }
    | { id?: string | null; title?: string | null; invoice_number?: string | null }[]
    | null;
};

type TemplateSearchRow = {
  id: string;
  label: string;
  body: string;
  category: string;
};

type AssignmentNoteSearchRow = {
  id: string;
  note_type: string;
  body: string;
  assignment_id: string;
  operational_assignments?:
    | { target_type?: string | null; target_id?: string | null; assignment_type?: string | null }
    | Array<{ target_type?: string | null; target_id?: string | null; assignment_type?: string | null }>
    | null;
};

type ProofSearchRow = {
  id: string;
  status?: string | null;
  method?: string | null;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  uploaded_at?: string | null;
  invoices?:
    | {
        id?: string | null;
        title?: string | null;
        invoice_number?: string | null;
        status?: string | null;
        clients?: { name?: string | null } | { name?: string | null }[] | null;
      }
    | Array<{
        id?: string | null;
        title?: string | null;
        invoice_number?: string | null;
        status?: string | null;
        clients?: { name?: string | null } | { name?: string | null }[] | null;
      }>
    | null;
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function invoiceAmount(row: InvoiceSearchRow | ProofSearchRow) {
  const parts: string[] = [];
  if (row.amount_usd) parts.push(money(row.amount_usd, "USD"));
  if (row.amount_lbp) parts.push(money(row.amount_lbp, "LBP"));
  return parts.join(" + ");
}

function searchText(parts: Array<string | number | null | undefined>) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function matchesQuery(text: string, query: string) {
  if (!query) return true;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((token) => text.includes(token));
}

function invoiceToItem(row: InvoiceSearchRow): CommandItem {
  const client = firstRelated(row.clients);
  const amount = invoiceAmount(row);
  const label = row.invoice_number || (row.document_type === "quote" ? "Quote" : "Invoice");

  return {
    id: `invoice:${row.id}`,
    type: "invoice",
    title: `${label} - ${row.title || "Untitled"}`,
    subtitle: [client?.name, amount, row.due_date ? `Due ${shortDate(row.due_date)}` : null].filter(Boolean).join(" - "),
    href: `/invoices/${row.id}`,
    badge: row.status || row.document_type || "invoice",
    group: "Workspace results",
    keywords: [client?.name || "", row.invoice_number || "", row.document_type || "", row.status || ""]
  };
}

function clientToItem(row: ClientSearchRow): CommandItem {
  return {
    id: `client:${row.id}`,
    type: "client",
    title: row.name || "Unnamed client",
    subtitle: [row.email, row.phone, row.created_at ? `Added ${shortDate(row.created_at)}` : null].filter(Boolean).join(" - "),
    href: `/clients/${row.id}`,
    badge: "Client",
    group: "Workspace results",
    keywords: [row.email || "", row.phone || ""]
  };
}

function proofToItem(row: ProofSearchRow): CommandItem | null {
  const invoice = firstRelated(row.invoices);
  if (!invoice?.id) return null;

  const client = firstRelated(invoice.clients);
  return {
    id: `proof:${row.id}`,
    type: "proof",
    title: `Proof - ${invoice.invoice_number || invoice.title || "Invoice"}`,
    subtitle: [client?.name, invoiceAmount(row), row.method, row.uploaded_at ? shortDate(row.uploaded_at) : null].filter(Boolean).join(" - "),
    href: `/invoices/${invoice.id}#proofs-review`,
    badge: row.status || "proof",
    group: "Workspace results",
    keywords: [invoice.title || "", invoice.invoice_number || "", client?.name || "", row.method || "", row.status || ""]
  };
}

function recoveryToItem(row: InvoiceSearchRow): CommandItem {
  const client = firstRelated(row.clients);
  return {
    id: `recovery:${row.id}`,
    type: "recovery",
    title: `Recover - ${row.invoice_number || row.title || "Invoice"}`,
    subtitle: [client?.name, invoiceAmount(row), row.due_date ? `Due ${shortDate(row.due_date)}` : null].filter(Boolean).join(" - "),
    href: `/invoices/${row.id}#follow-up`,
    badge: "Overdue",
    group: "Workspace results",
    keywords: ["recovery", "overdue", "reminder", client?.name || "", row.invoice_number || "", row.title || ""]
  };
}

function clientNoteToItem(row: ClientNoteSearchRow): CommandItem {
  const client = firstRelated(row.clients);
  return {
    id: `cnote:${row.id}`,
    type: "memory",
    title: `Note · ${client?.name || "Client"}`,
    subtitle: [row.category, row.body.slice(0, 120)].filter(Boolean).join(" — "),
    href: `/clients/${row.client_id}#client-memory-timeline`,
    badge: "Note",
    group: "Memory & notes",
    keywords: [row.body, row.category, client?.name || ""]
  };
}

function invoiceNoteToItem(row: InvoiceNoteSearchRow): CommandItem {
  const inv = firstRelated(row.invoices);
  return {
    id: `inote:${row.id}`,
    type: "memory",
    title: `Work note · ${inv?.invoice_number || inv?.title || "Invoice"}`,
    subtitle: [row.category, row.body.slice(0, 120)].filter(Boolean).join(" — "),
    href: `/invoices/${inv?.id || row.invoice_id}#work-memory`,
    badge: "Work",
    group: "Memory & notes",
    keywords: [row.body, row.category, inv?.title || "", inv?.invoice_number || ""]
  };
}

function templateToItem(row: TemplateSearchRow): CommandItem {
  return {
    id: `tpl:${row.id}`,
    type: "template",
    title: `Template · ${row.label}`,
    subtitle: row.body.slice(0, 140),
    href: "/invoices",
    badge: row.category,
    group: "Memory & notes",
    keywords: [row.label, row.body, row.category]
  };
}

function assignmentNoteToItem(row: AssignmentNoteSearchRow): CommandItem {
  const assignment = firstRelated(row.operational_assignments);
  return {
    id: `anote:${row.id}`,
    type: "memory",
    title: `Assignment note - ${assignment?.assignment_type || "work item"}`,
    subtitle: [row.note_type, row.body.slice(0, 120)].filter(Boolean).join(" - "),
    href: "/inbox",
    badge: "Assignment",
    group: "Memory & notes",
    keywords: [row.body, row.note_type, assignment?.target_type || "", assignment?.assignment_type || ""]
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ items: [] }, { status: 401 });
  }

  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const ctx = await getWorkspaceContext();

  const [{ data: invoiceRows }, { data: clientRows }, { data: proofRows }, { data: clientNoteRows }, { data: invoiceNoteRows }, { data: templateRows }, { data: assignmentNoteRows }] =
    await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, title, status, document_type, due_date, amount_usd, amount_lbp, currency, created_at, clients(name)")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("clients")
      .select("id, name, email, phone, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("payment_proofs")
      .select("id, status, method, amount_usd, amount_lbp, uploaded_at, invoices!inner(id, title, invoice_number, status, workspace_id, clients(name))")
      .eq("invoices.workspace_id", ctx.workspaceId)
      .order("uploaded_at", { ascending: false })
      .limit(120),
    supabase
      .from("client_workspace_notes")
      .select("id, category, body, client_id, clients(name)")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("invoice_workspace_notes")
      .select("id, category, body, invoice_id, invoices!inner(id, title, invoice_number, workspace_id)")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("workspace_message_templates")
      .select("id, label, body, category")
      .eq("workspace_id", ctx.workspaceId)
      .order("last_used_at", { ascending: false })
      .limit(60),
    supabase
      .from("assignment_notes")
      .select("id, note_type, body, assignment_id, operational_assignments!inner(target_type, target_id, assignment_type, workspace_id)")
      .eq("workspace_id", ctx.workspaceId)
      .order("created_at", { ascending: false })
      .limit(80)
    ]);

  const invoiceItems = ((invoiceRows || []) as InvoiceSearchRow[])
    .filter((row) =>
      matchesQuery(
        searchText([row.invoice_number, row.title, row.status, row.document_type, firstRelated(row.clients)?.name, invoiceAmount(row)]),
        query
      )
    )
    .slice(0, 18)
    .map(invoiceToItem);

  const clientItems = ((clientRows || []) as ClientSearchRow[])
    .filter((row) => matchesQuery(searchText([row.name, row.email, row.phone]), query))
    .slice(0, 14)
    .map(clientToItem);

  const proofItems = ((proofRows || []) as ProofSearchRow[])
    .filter((row) => {
      const invoice = firstRelated(row.invoices);
      const client = firstRelated(invoice?.clients);
      return matchesQuery(searchText([invoice?.invoice_number, invoice?.title, client?.name, row.status, row.method, invoiceAmount(row)]), query);
    })
    .slice(0, 14)
    .map(proofToItem)
    .filter((item): item is CommandItem => Boolean(item));

  const today = new Date();
  const recoveryItems = ((invoiceRows || []) as InvoiceSearchRow[])
    .filter((row) => {
      const status = (row.status || "").toLowerCase();
      const dueDate = row.due_date ? new Date(row.due_date) : null;
      const overdueByDate = dueDate ? dueDate < today : false;
      const open = !["paid", "draft", "rejected"].includes(status) && (status === "overdue" || overdueByDate);
      return (
        open &&
        matchesQuery(searchText([row.invoice_number, row.title, firstRelated(row.clients)?.name, "overdue recovery reminder", invoiceAmount(row)]), query)
      );
    })
    .slice(0, 8)
    .map(recoveryToItem);

  const clientNoteItems = ((clientNoteRows || []) as ClientNoteSearchRow[])
    .filter((row) => {
      const client = firstRelated(row.clients);
      const haystack = searchText([row.body, row.category, client?.name]);
      return query.length < 2 ? true : matchesQuery(haystack, query);
    })
    .slice(0, query.length < 2 ? 4 : 10)
    .map(clientNoteToItem);

  const invoiceNoteItems = ((invoiceNoteRows || []) as InvoiceNoteSearchRow[])
    .filter((row) => {
      const inv = firstRelated(row.invoices);
      const haystack = searchText([row.body, row.category, inv?.title, inv?.invoice_number]);
      return query.length < 2 ? true : matchesQuery(haystack, query);
    })
    .slice(0, query.length < 2 ? 4 : 10)
    .map(invoiceNoteToItem);

  const templateItems = ((templateRows || []) as TemplateSearchRow[])
    .filter((row) => {
      const haystack = searchText([row.label, row.body, row.category]);
      return query.length < 2 ? true : matchesQuery(haystack, query);
    })
    .slice(0, query.length < 2 ? 4 : 10)
    .map(templateToItem);

  const assignmentNoteItems = ((assignmentNoteRows || []) as AssignmentNoteSearchRow[])
    .filter((row) => {
      const assignment = firstRelated(row.operational_assignments);
      const haystack = searchText([row.body, row.note_type, assignment?.target_type, assignment?.assignment_type]);
      return query.length < 2 ? true : matchesQuery(haystack, query);
    })
    .slice(0, query.length < 2 ? 4 : 10)
    .map(assignmentNoteToItem);

  const items = sortCommandItems(
    [...invoiceItems, ...clientItems, ...proofItems, ...recoveryItems, ...clientNoteItems, ...invoiceNoteItems, ...templateItems, ...assignmentNoteItems],
    query
  ).slice(0, 32);

  return NextResponse.json({ items });
}
