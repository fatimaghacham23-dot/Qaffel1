"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/get-workspace";
import { requireUser } from "@/lib/supabase/server";
import type { ClientNoteCategory, InvoiceNoteCategory } from "@/lib/workspace-memory";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const CLIENT_NOTE_CATEGORIES = new Set<ClientNoteCategory>([
  "operational",
  "payment",
  "communication",
  "recovery",
  "general"
]);

const INVOICE_NOTE_CATEGORIES = new Set<InvoiceNoteCategory>([
  "project",
  "delivery",
  "revision",
  "milestone",
  "handoff",
  "assignment",
  "finance",
  "recovery",
  "operational",
  "general"
]);

type TemplateCategory = "reminder" | "recovery" | "thank_you" | "follow_up" | "other";
const TEMPLATE_CATEGORIES = new Set<TemplateCategory>(["reminder", "recovery", "thank_you", "follow_up", "other"]);

export async function addClientWorkspaceNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const ctx = await getWorkspaceContext();
  const clientId = text(formData, "client_id");
  const body = text(formData, "body");
  const category = text(formData, "category") as ClientNoteCategory;
  const isPinned = formData.get("is_pinned") === "on" || formData.get("is_pinned") === "true";

  if (!clientId || !body) throw new Error("Client and note text are required.");
  if (!CLIENT_NOTE_CATEGORIES.has(category)) throw new Error("Invalid note category.");

  const { error } = await supabase.from("client_workspace_notes").insert({
    user_id: user.id,
    workspace_id: ctx.workspaceId,
    client_id: clientId,
    category,
    body,
    is_pinned: isPinned
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${clientId}`);
}

export async function updateClientWorkspaceNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  const body = text(formData, "body");
  const category = text(formData, "category") as ClientNoteCategory;
  if (!id || !body) throw new Error("Note id and text are required.");
  if (!CLIENT_NOTE_CATEGORIES.has(category)) throw new Error("Invalid note category.");

  const { data: row } = await supabase
    .from("client_workspace_notes")
    .select("client_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) throw new Error("Note not found.");

  const { error } = await supabase
    .from("client_workspace_notes")
    .update({ body, category, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${row.client_id}`);
}

export async function deleteClientWorkspaceNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing note id.");

  const { data: row } = await supabase
    .from("client_workspace_notes")
    .select("client_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("client_workspace_notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  if (row?.client_id) revalidatePath(`/clients/${row.client_id}`);
}

export async function togglePinClientWorkspaceNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing note id.");

  const { data: row } = await supabase
    .from("client_workspace_notes")
    .select("client_id, is_pinned")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) throw new Error("Note not found.");

  const { error } = await supabase
    .from("client_workspace_notes")
    .update({ is_pinned: !row.is_pinned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${row.client_id}`);
}

export async function addInvoiceWorkspaceNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const ctx = await getWorkspaceContext();
  const invoiceId = text(formData, "invoice_id");
  const body = text(formData, "body");
  const category = text(formData, "category") as InvoiceNoteCategory;
  const isPinned = formData.get("is_pinned") === "on" || formData.get("is_pinned") === "true";

  if (!invoiceId || !body) throw new Error("Invoice and note text are required.");
  if (!INVOICE_NOTE_CATEGORIES.has(category)) throw new Error("Invalid work note category.");

  const { error } = await supabase.from("invoice_workspace_notes").insert({
    user_id: user.id,
    workspace_id: ctx.workspaceId,
    invoice_id: invoiceId,
    category,
    body,
    is_pinned: isPinned
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/invoices/${invoiceId}`);
  const { data: inv } = await supabase.from("invoices").select("client_id").eq("id", invoiceId).maybeSingle();
  if (inv?.client_id) revalidatePath(`/clients/${inv.client_id}`);
}

export async function updateInvoiceWorkspaceNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  const body = text(formData, "body");
  const category = text(formData, "category") as InvoiceNoteCategory;
  if (!id || !body) throw new Error("Note id and text are required.");
  if (!INVOICE_NOTE_CATEGORIES.has(category)) throw new Error("Invalid work note category.");

  const { data: row } = await supabase
    .from("invoice_workspace_notes")
    .select("invoice_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) throw new Error("Note not found.");

  const { error } = await supabase
    .from("invoice_workspace_notes")
    .update({ body, category, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/invoices/${row.invoice_id}`);
  const { data: inv } = await supabase.from("invoices").select("client_id").eq("id", row.invoice_id).maybeSingle();
  if (inv?.client_id) revalidatePath(`/clients/${inv.client_id}`);
}

export async function deleteInvoiceWorkspaceNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing note id.");

  const { data: row } = await supabase
    .from("invoice_workspace_notes")
    .select("invoice_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("invoice_workspace_notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  if (row?.invoice_id) {
    revalidatePath(`/invoices/${row.invoice_id}`);
    const { data: inv } = await supabase.from("invoices").select("client_id").eq("id", row.invoice_id).maybeSingle();
    if (inv?.client_id) revalidatePath(`/clients/${inv.client_id}`);
  }
}

export async function togglePinInvoiceWorkspaceNoteAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing note id.");

  const { data: row } = await supabase
    .from("invoice_workspace_notes")
    .select("invoice_id, is_pinned")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) throw new Error("Note not found.");

  const { error } = await supabase
    .from("invoice_workspace_notes")
    .update({ is_pinned: !row.is_pinned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/invoices/${row.invoice_id}`);
  const { data: inv } = await supabase.from("invoices").select("client_id").eq("id", row.invoice_id).maybeSingle();
  if (inv?.client_id) revalidatePath(`/clients/${inv.client_id}`);
}

export async function saveWorkspaceMessageTemplateAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const ctx = await getWorkspaceContext();
  const label = text(formData, "label");
  const body = text(formData, "body");
  const category = text(formData, "category") as TemplateCategory;
  if (!label || !body) throw new Error("Label and message body are required.");
  if (!TEMPLATE_CATEGORIES.has(category)) throw new Error("Invalid template category.");

  const { error } = await supabase.from("workspace_message_templates").insert({
    user_id: user.id,
    workspace_id: ctx.workspaceId,
    label,
    body,
    category,
    is_favorite: formData.get("is_favorite") === "on" || formData.get("is_favorite") === "true"
  });
  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath("/invoices");
}

export async function deleteWorkspaceMessageTemplateAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing template id.");

  const { error } = await supabase.from("workspace_message_templates").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
  revalidatePath("/invoices");
}

export async function toggleFavoriteWorkspaceTemplateAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing template id.");

  const { data: row } = await supabase
    .from("workspace_message_templates")
    .select("is_favorite")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) throw new Error("Template not found.");

  const { error } = await supabase
    .from("workspace_message_templates")
    .update({ is_favorite: !row.is_favorite, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
  revalidatePath("/invoices");
}

export async function recordWorkspaceTemplateUsedAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = text(formData, "id");
  if (!id) throw new Error("Missing template id.");

  const { data: row } = await supabase
    .from("workspace_message_templates")
    .select("use_count")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) throw new Error("Template not found.");

  const next = Number(row.use_count || 0) + 1;
  const { error } = await supabase
    .from("workspace_message_templates")
    .update({
      use_count: next,
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
