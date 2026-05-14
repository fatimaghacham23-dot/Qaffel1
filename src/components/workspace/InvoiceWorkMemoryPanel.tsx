"use client";

import { useState, useTransition } from "react";
import { Pin, PinOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  addInvoiceWorkspaceNoteAction,
  deleteInvoiceWorkspaceNoteAction,
  togglePinInvoiceWorkspaceNoteAction,
  updateInvoiceWorkspaceNoteAction
} from "@/app/workspace-memory-actions";
import type { InvoiceNoteCategory, InvoiceWorkspaceNoteRow } from "@/lib/workspace-memory";
import { INVOICE_NOTE_CATEGORY_LABELS } from "@/lib/workspace-memory";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const CATEGORIES: InvoiceNoteCategory[] = ["project", "delivery", "revision", "milestone", "handoff", "general"];

export function InvoiceWorkMemoryPanel({
  invoiceId,
  initialNotes
}: {
  invoiceId: string;
  initialNotes: InvoiceWorkspaceNoteRow[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<InvoiceNoteCategory>("project");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState<InvoiceNoteCategory>("project");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!body.trim()) {
      toast.error("Write something first.");
      return;
    }
    const fd = new FormData();
    fd.set("invoice_id", invoiceId);
    fd.set("body", body.trim());
    fd.set("category", category);
    startTransition(async () => {
      try {
        await addInvoiceWorkspaceNoteAction(fd);
        setBody("");
        toast.success("Work note saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  };

  const onDelete = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      try {
        await deleteInvoiceWorkspaceNoteAction(fd);
        toast.success("Removed");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  const onPin = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      try {
        await togglePinInvoiceWorkspaceNoteAction(fd);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not pin");
      }
    });
  };

  const saveEdit = () => {
    if (!editingId || !editBody.trim()) return;
    const fd = new FormData();
    fd.set("id", editingId);
    fd.set("body", editBody.trim());
    fd.set("category", editCategory);
    startTransition(async () => {
      try {
        await updateInvoiceWorkspaceNoteAction(fd);
        setEditingId(null);
        toast.success("Updated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  };

  const sorted = [...initialNotes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });

  return (
    <section className="panel scroll-mt-24" id="work-memory">
      <h2 className="q-title mb-1">Work memory</h2>
      <p className="q-body-muted text-sm">Lightweight project and delivery notes — internal only.</p>

      <div className="mt-4 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4">
        <select className="field w-full text-sm" value={category} onChange={(e) => setCategory(e.target.value as InvoiceNoteCategory)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {INVOICE_NOTE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <textarea
          className="field mt-2 min-h-[88px] w-full resize-y text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scope, revisions, handoff, milestones…"
          maxLength={8000}
        />
        <Button type="button" className="mt-2" size="sm" disabled={pending} onClick={submit}>
          Add note
        </Button>
      </div>

      <ul className="mt-5 space-y-3">
        {sorted.map((n) => (
          <li
            key={n.id}
            className={cn(
              "rounded-2xl border p-4",
              n.is_pinned ? "border-cedar/25 bg-cedar/[0.04]" : "border-slate-200/70 bg-white/90"
            )}
          >
            {editingId === n.id ? (
              <div className="space-y-2">
                <select
                  className="field w-full text-sm"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as InvoiceNoteCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {INVOICE_NOTE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <textarea className="field min-h-[72px] w-full text-sm" value={editBody} onChange={(e) => setEditBody(e.target.value)} maxLength={8000} />
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={saveEdit} disabled={pending}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {INVOICE_NOTE_CATEGORY_LABELS[n.category]}
                  </span>
                  <span className="text-[11px] text-slate-400">{shortDate(n.created_at)}</span>
                </div>
                <p className="q-body mt-2 whitespace-pre-wrap break-words">{n.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => onPin(n.id)}
                    disabled={pending}
                  >
                    {n.is_pinned ? <PinOff className="mr-1 inline h-3.5 w-3.5" /> : <Pin className="mr-1 inline h-3.5 w-3.5" />}
                    {n.is_pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => {
                      setEditingId(n.id);
                      setEditBody(n.body);
                      setEditCategory(n.category);
                    }}
                    disabled={pending}
                  >
                    <Pencil className="mr-1 inline h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-rose-200/80 bg-rose-50/80 px-2 py-1 text-xs font-semibold text-rose-800"
                    onClick={() => onDelete(n.id)}
                    disabled={pending}
                  >
                    <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
