import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock3, FileText, MessageSquareText, UserRound } from "lucide-react";
import {
  addAssignmentNoteAction,
  assignOperationalWorkAction,
  updateAssignmentStatusAction
} from "@/app/assignment-actions";
import {
  ASSIGNMENT_NOTE_TYPE_LABELS,
  ASSIGNMENT_NOTE_TYPES,
  ASSIGNMENT_PRIORITIES,
  ASSIGNMENT_PRIORITY_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_TYPE_LABELS,
  ASSIGNMENT_TYPES,
  assignmentAgeDays,
  assignmentInitials,
  formatAssignee,
  isOpenAssignment,
  isOverdueAssignment,
  ownershipLine,
  sortAssignments,
  type AssignmentMemberOption,
  type AssignmentTargetType,
  type AssignmentType,
  type OperationalAssignmentRow
} from "@/lib/assignments";
import { ROLE_LABELS, type WorkspaceRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type OperationalAssignmentPanelProps = {
  targetType: AssignmentTargetType;
  targetId: string;
  assignments: OperationalAssignmentRow[];
  members: AssignmentMemberOption[];
  canManage: boolean;
  canWork: boolean;
  title?: string;
  description?: string;
  allowedTypes?: AssignmentType[];
  compact?: boolean;
};

const ROLE_OPTIONS: WorkspaceRole[] = ["finance", "operations", "reviewer", "admin"];

function timeLabel(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return formatDistanceToNow(parsed, { addSuffix: true });
}

function priorityClass(priority: string) {
  if (priority === "urgent") return "border-red-200 bg-red-50 text-red-800";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-800";
  if (priority === "low") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function statusClass(status: string) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "waiting") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "cancelled") return "border-slate-200 bg-slate-100 text-slate-500";
  return "border-slate-200 bg-white text-slate-700";
}

export function OwnershipAvatar({ assignment, className }: { assignment: OperationalAssignmentRow; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 shadow-xs",
        className
      )}
      title={formatAssignee(assignment)}
    >
      {assignmentInitials(assignment)}
    </span>
  );
}

export function AssignmentBadge({ assignment, compact = false }: { assignment: OperationalAssignmentRow; compact?: boolean }) {
  const overdue = isOverdueAssignment(assignment);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600",
        overdue && "border-red-200 bg-red-50 text-red-800",
        compact && "px-2 py-0.5 text-[10px]"
      )}
      title={ownershipLine(assignment)}
    >
      <span className="grid h-4 w-4 place-items-center rounded-full bg-slate-100 text-[8px] text-slate-600">
        {assignmentInitials(assignment)}
      </span>
      <span className="truncate">{ownershipLine(assignment)}</span>
    </span>
  );
}

export function AssignmentInlineBadges({ assignments, limit = 2 }: { assignments: OperationalAssignmentRow[]; limit?: number }) {
  const open = assignments.filter((assignment) => isOpenAssignment(assignment.status)).sort(sortAssignments);
  if (!open.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {open.slice(0, limit).map((assignment) => (
        <AssignmentBadge key={assignment.id} assignment={assignment} compact />
      ))}
      {open.length > limit ? (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          +{open.length - limit} more
        </span>
      ) : null}
    </div>
  );
}

function AssignmentStatusActions({ assignment, canWork }: { assignment: OperationalAssignmentRow; canWork: boolean }) {
  if (!canWork || !isOpenAssignment(assignment.status)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {assignment.status !== "in_progress" ? (
        <form action={updateAssignmentStatusAction}>
          <input name="assignment_id" type="hidden" value={assignment.id} />
          <input name="status" type="hidden" value="in_progress" />
          <button className="btn btn-secondary px-2.5 py-1 text-[11px]" type="submit">
            Start
          </button>
        </form>
      ) : null}
      {assignment.status !== "waiting" ? (
        <form action={updateAssignmentStatusAction}>
          <input name="assignment_id" type="hidden" value={assignment.id} />
          <input name="status" type="hidden" value="waiting" />
          <button className="btn btn-secondary px-2.5 py-1 text-[11px]" type="submit">
            Waiting
          </button>
        </form>
      ) : null}
      <form action={updateAssignmentStatusAction}>
        <input name="assignment_id" type="hidden" value={assignment.id} />
        <input name="status" type="hidden" value="completed" />
        <button className="btn btn-primary px-2.5 py-1 text-[11px]" type="submit">
          Complete
        </button>
      </form>
    </div>
  );
}

function AssignmentNoteForm({ assignmentId }: { assignmentId: string }) {
  return (
    <form action={addAssignmentNoteAction} className="mt-3 grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
      <input name="assignment_id" type="hidden" value={assignmentId} />
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
        <select className="field h-10 text-xs" name="note_type" defaultValue="assignment">
          {ASSIGNMENT_NOTE_TYPES.map((type) => (
            <option key={type} value={type}>
              {ASSIGNMENT_NOTE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <input className="field h-10 text-xs" name="body" placeholder="Add handoff, finance, recovery, or assignment context" required />
        <button className="btn btn-secondary h-10 px-3 text-xs" type="submit">
          Add note
        </button>
      </div>
    </form>
  );
}

export function OperationalAssignmentPanel({
  targetType,
  targetId,
  assignments,
  members,
  canManage,
  canWork,
  title = "Ownership",
  description = "Assign responsibility, record handoffs, and keep the operational owner visible.",
  allowedTypes,
  compact = false
}: OperationalAssignmentPanelProps) {
  const sortedAssignments = [...assignments].sort(sortAssignments);
  const activeAssignments = sortedAssignments.filter((assignment) => isOpenAssignment(assignment.status));
  const types = (allowedTypes && allowedTypes.length > 0 ? allowedTypes : ASSIGNMENT_TYPES).filter((type) => ASSIGNMENT_TYPES.includes(type));

  return (
    <section className={cn("panel", compact && "p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="q-section-label">Operational ownership</p>
          <h2 className="mt-2 text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            {activeAssignments.length} active
          </span>
        </div>
      </div>

      {activeAssignments.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {activeAssignments.map((assignment) => {
            const overdue = isOverdueAssignment(assignment);
            const age = assignmentAgeDays(assignment);
            return (
              <article key={assignment.id} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <OwnershipAvatar assignment={assignment} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusClass(assignment.status))}>
                          {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                        </span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", priorityClass(assignment.priority))}>
                          {ASSIGNMENT_PRIORITY_LABELS[assignment.priority]}
                        </span>
                        {overdue ? (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                            Overdue
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 font-semibold text-ink">{ownershipLine(assignment)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]} - updated {timeLabel(assignment.last_action_at) || "recently"}
                        {age >= 3 ? ` - stale ${age}d` : ""}
                        {assignment.due_at ? ` - due ${timeLabel(assignment.due_at) || "soon"}` : ""}
                      </p>
                      {assignment.context ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{assignment.context}</p> : null}
                    </div>
                  </div>
                  <AssignmentStatusActions assignment={assignment} canWork={canWork} />
                </div>

                {assignment.notes && assignment.notes.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    {assignment.notes.slice(0, 3).map((note) => (
                      <div key={note.id} className="flex gap-2 text-xs text-slate-600">
                        <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <p className="min-w-0">
                          <span className="font-semibold text-slate-700">{ASSIGNMENT_NOTE_TYPE_LABELS[note.note_type]}:</span>{" "}
                          {note.body}
                          <span className="ml-1 text-slate-400">{timeLabel(note.created_at)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {canWork ? <AssignmentNoteForm assignmentId={assignment.id} /> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm text-slate-600">
          No active owner is assigned yet.
        </div>
      )}

      {canManage ? (
        <form action={assignOperationalWorkAction} className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
          <input name="target_type" type="hidden" value={targetType} />
          <input name="target_id" type="hidden" value={targetId} />
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Assignment</label>
              <select className="field" name="assignment_type" defaultValue={types[0] || "operations_owner"}>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {ASSIGNMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Owner</label>
              <select className="field" name="assignee" required defaultValue={members[0] ? `user:${members[0].userId}` : "role:operations"}>
                {members.length > 0 ? (
                  <optgroup label="People">
                    {members.map((member) => (
                      <option key={member.userId} value={`user:${member.userId}`}>
                        {member.name} ({ROLE_LABELS[member.role]})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Roles">
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={`role:${role}`}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="field" name="priority" defaultValue="normal">
                {ASSIGNMENT_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {ASSIGNMENT_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Due</label>
              <input className="field" name="due_at" type="datetime-local" />
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Context</label>
            <textarea className="field min-h-20" name="context" placeholder="Short operational context, handoff detail, or review expectation." />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              One active assignment per work type keeps ownership clear.
            </p>
            <button className="btn btn-primary text-xs" type="submit">
              Assign owner
            </button>
          </div>
        </form>
      ) : null}

      {sortedAssignments.some((assignment) => assignment.status === "completed") ? (
        <details className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Completed ownership history</summary>
          <div className="mt-3 grid gap-2">
            {sortedAssignments
              .filter((assignment) => assignment.status === "completed")
              .slice(0, 8)
              .map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <span className="flex items-center gap-2 text-slate-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    {ownershipLine(assignment)}
                  </span>
                  {assignment.target_href ? (
                    <Link className="font-semibold text-cedar" href={assignment.target_href}>
                      <FileText className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                      Open
                    </Link>
                  ) : null}
                </div>
              ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
