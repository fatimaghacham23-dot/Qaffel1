"use client";

import { useState, useTransition } from "react";
import { Copy, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  deleteWorkspaceMessageTemplateAction,
  recordWorkspaceTemplateUsedAction,
  saveWorkspaceMessageTemplateAction,
  toggleFavoriteWorkspaceTemplateAction
} from "@/app/workspace-memory-actions";
import type { WorkspaceMessageTemplateRow } from "@/lib/workspace-memory";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TEMPLATE_LABELS: Record<WorkspaceMessageTemplateRow["category"], string> = {
  reminder: "Reminder",
  recovery: "Recovery",
  thank_you: "Thank you",
  follow_up: "Follow-up",
  other: "Other"
};

export function WorkspaceMessageTemplatesCard({ initialTemplates }: { initialTemplates: WorkspaceMessageTemplateRow[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<WorkspaceMessageTemplateRow["category"]>("reminder");
  const [pending, startTransition] = useTransition();

  const copyBody = async (t: WorkspaceMessageTemplateRow) => {
    try {
      await navigator.clipboard.writeText(t.body);
      const fd = new FormData();
      fd.set("id", t.id);
      await recordWorkspaceTemplateUsedAction(fd);
      toast.success("Copied to clipboard");
      router.refresh();
    } catch {
      toast.error("Could not copy");
    }
  };

  const saveNew = () => {
    if (!label.trim() || !body.trim()) {
      toast.error("Label and message are required.");
      return;
    }
    const fd = new FormData();
    fd.set("label", label.trim());
    fd.set("body", body.trim());
    fd.set("category", category);
    startTransition(async () => {
      try {
        await saveWorkspaceMessageTemplateAction(fd);
        setLabel("");
        setBody("");
        toast.success("Template saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  return (
    <section className="q-panel overflow-hidden p-5 sm:p-6">
      <p className="q-section-label text-slate-500">Message templates</p>
      <p className="q-body-muted mt-2 text-sm">
        Reusable reminder and follow-up text. Copy when you need it — nothing sends automatically.
      </p>

      <div className="mt-4 space-y-2 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-4">
        <Input placeholder="Short label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={160} />
        <select className="field w-full text-sm" value={category} onChange={(e) => setCategory(e.target.value as WorkspaceMessageTemplateRow["category"])}>
          {(Object.keys(TEMPLATE_LABELS) as WorkspaceMessageTemplateRow["category"][]).map((c) => (
            <option key={c} value={c}>
              {TEMPLATE_LABELS[c]}
            </option>
          ))}
        </select>
        <textarea
          className="field min-h-[100px] w-full resize-y text-sm"
          placeholder="Paste or write a message you reuse often…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={12000}
        />
        <Button type="button" size="sm" disabled={pending} onClick={saveNew}>
          Save template
        </Button>
      </div>

      <ul className="mt-5 max-h-[min(50vh,400px)] space-y-2 overflow-y-auto">
        {initialTemplates.map((t) => (
          <li key={t.id} className="rounded-2xl border border-slate-200/70 bg-white/90 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{t.label}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {TEMPLATE_LABELS[t.category]} · used {t.use_count}x
                  {t.last_used_at ? ` · last ${shortDate(t.last_used_at)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title="Favorite"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", t.id);
                    startTransition(async () => {
                      try {
                        await toggleFavoriteWorkspaceTemplateAction(fd);
                        router.refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Update failed");
                      }
                    });
                  }}
                >
                  <Star className={cn("h-4 w-4", t.is_favorite ? "fill-amber-400 text-amber-500" : "")} />
                </button>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  title="Copy body"
                  onClick={() => copyBody(t)}
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200/70 text-rose-700 hover:bg-rose-50"
                  title="Delete"
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("id", t.id);
                    startTransition(async () => {
                      try {
                        await deleteWorkspaceMessageTemplateAction(fd);
                        toast.success("Removed");
                        router.refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Delete failed");
                      }
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="q-caption mt-2 line-clamp-3 whitespace-pre-wrap text-slate-600">{t.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
