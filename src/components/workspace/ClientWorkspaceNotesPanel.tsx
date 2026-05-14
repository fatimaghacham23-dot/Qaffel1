"use client";

import { useMemo, useState, useTransition } from "react";
import { Pin, PinOff, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  addClientWorkspaceNoteAction,
  deleteClientWorkspaceNoteAction,
  togglePinClientWorkspaceNoteAction,
  updateClientWorkspaceNoteAction
} from "@/app/workspace-memory-actions";
import type { ClientNoteCategory, ClientWorkspaceNoteRow } from "@/lib/workspace-memory";
import { CLIENT_NOTE_CATEGORY_LABELS } from "@/lib/workspace-memory";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES: ClientNoteCategory[] = ["operational", "payment", "communication", "recovery", "general"];

export function ClientWorkspaceNotesPanel({
  clientId,
  initialNotes
}: {
  clientId: string;
  initialNotes: ClientWorkspaceNoteRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ClientNoteCategory>("operational");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editCategory, setEditCategory] = useState<ClientNoteCategory>("operational");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...initialNotes]
      .filter((n) => (pinnedOnly ? n.is_pinned : true))
      .filter((n) => {
        if (!q) return true;
        return n.body.toLowerCase().includes(q) || n.category.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [initialNotes, query, pinnedOnly]);

  const submitNew = () => {
    if (!body.trim()) {
      toast.error("Write something first.");
      return;
    }
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("body", body.trim());
    fd.set("category", category);
    startTransition(async () => {
      try {
        await addClientWorkspaceNoteAction(fd);
        setBody("");
        toast.success("Note saved");
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
        await deleteClientWorkspaceNoteAction(fd);
        toast.success("Note removed");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  const onTogglePin = (id: string) => {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      try {
        await togglePinClientWorkspaceNoteAction(fd);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update pin");
      }
    });
  };

  const startEdit = (n: ClientWorkspaceNoteRow) => {
    setEditingId(n.id);
    setEditBody(n.body);
    setEditCategory(n.category);
  };

  const saveEdit = () => {
    if (!editingId || !editBody.trim()) return;
    const fd = new FormData();
    fd.set("id", editingId);
    fd.set("body", editBody.trim());
    fd.set("category", editCategory);
    startTransition(async () => {
      try {
        await updateClientWorkspaceNoteAction(fd);
        setEditingId(null);
        toast.success("Note updated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      }
    });
  };

  return (
    <section className="q-panel overflow-hidden p-5 sm:p-6">
      <p className="q-section-label text-slate-500">Internal notes</p>
      <p className="q-body-muted mt-2 text-sm">Only your workspace can see these. Search by text or category.</p>

      <div className="mt-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="h-10 pl-9"
            aria-label="Search notes"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={pinnedOnly} onChange={(e) => setPinnedOnly(e.target.checked)} />
          Pinned only
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add note</p>
        <select
          className="field mt-2 w-full"
          value={category}
          onChange={(e) => setCategory(e.target.value as ClientNoteCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CLIENT_NOTE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <textarea
          className="field mt-2 min-h-[100px] w-full resize-y text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Operational context, payment agreements, call outcomes…"
          maxLength={8000}
        />
        <Button type="button" className="mt-3 w-full sm:w-auto" disabled={pending} onClick={submitNew}>
          Save note
        </Button>
      </div>

      <ul className="mt-6 max-h-[min(70vh,520px)] space-y-3 overflow-y-auto pr-1">
        {filtered.map((n) => (
          <li
            key={n.id}
            className={cn(
              "rounded-2xl border p-4 shadow-sm",
              n.is_pinned ? "border-cedar/25 bg-cedar/[0.04]" : "border-slate-200/70 bg-white/90"
            )}
          >
            {editingId === n.id ? (
              <div className="space-y-2">
                <select
                  className="field w-full text-sm"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as ClientNoteCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CLIENT_NOTE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <textarea
                  className="field min-h-[88px] w-full text-sm"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  maxLength={8000}
                />
                <div className="flex flex-wrap gap-2">
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
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {CLIENT_NOTE_CATEGORY_LABELS[n.category]}
                  </span>
                  <span className="text-[11px] text-slate-400">{shortDate(n.created_at)}</span>
                </div>
                <p className="q-body mt-2 whitespace-pre-wrap break-words text-ink">{n.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => onTogglePin(n.id)}
                    disabled={pending}
                  >
                    {n.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    {n.is_pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => startEdit(n)}
                    disabled={pending}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-200/80 bg-rose-50/80 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50"
                    onClick={() => onDelete(n.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
