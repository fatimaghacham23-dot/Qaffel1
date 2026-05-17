import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileText,
  Link2,
  Mail,
  MessageSquare,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Ban,
  UserCircle,
  UserPlus,
} from "lucide-react";
import type { ReactNode } from "react";

type AuditEvent = {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  actor_name?: string | null;
  actor_role?: string | null;
  metadata?: Record<string, unknown> | null;
};

const EVENT_ICONS: Record<string, ReactNode> = {
  invoice_created: <FileText className="h-3.5 w-3.5" />,
  quote_created: <FileText className="h-3.5 w-3.5" />,
  quote_converted: <CheckCircle2 className="h-3.5 w-3.5" />,
  invoice_sent: <Mail className="h-3.5 w-3.5" />,
  invoice_edited: <Edit3 className="h-3.5 w-3.5" />,
  status_changed: <AlertTriangle className="h-3.5 w-3.5" />,
  proof_uploaded: <ShieldCheck className="h-3.5 w-3.5" />,
  proof_accepted: <CheckCircle2 className="h-3.5 w-3.5" />,
  proof_rejected: <XCircle className="h-3.5 w-3.5" />,
  payment_voided: <Ban className="h-3.5 w-3.5" />,
  manual_payment: <CheckCircle2 className="h-3.5 w-3.5" />,
  reminder_copied: <MessageSquare className="h-3.5 w-3.5" />,
  link_regenerated: <Link2 className="h-3.5 w-3.5" />,
  receipt_viewed: <Eye className="h-3.5 w-3.5" />,
  client_portal_viewed: <Eye className="h-3.5 w-3.5" />,
  client_approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  client_rejected: <XCircle className="h-3.5 w-3.5" />,
  invoice_validity_extended: <Clock className="h-3.5 w-3.5" />,
  assignment_created: <UserPlus className="h-3.5 w-3.5" />,
  assignment_reassigned: <UserPlus className="h-3.5 w-3.5" />,
  assignment_status_changed: <Clock className="h-3.5 w-3.5" />,
  assignment_completed: <CheckCircle2 className="h-3.5 w-3.5" />,
  assignment_note_added: <MessageSquare className="h-3.5 w-3.5" />,
  handoff_completed: <CheckCircle2 className="h-3.5 w-3.5" />,
};

const EVENT_COLORS: Record<string, string> = {
  proof_accepted: "text-emerald-600 bg-emerald-50",
  manual_payment: "text-emerald-600 bg-emerald-50",
  client_approved: "text-emerald-600 bg-emerald-50",
  proof_rejected: "text-red-600 bg-red-50",
  client_rejected: "text-red-600 bg-red-50",
  payment_voided: "text-red-600 bg-red-50",
  proof_uploaded: "text-indigo-600 bg-indigo-50",
};

function getEventIcon(type: string): ReactNode {
  return EVENT_ICONS[type] ?? <Clock className="h-3.5 w-3.5" />;
}

function getEventColor(type: string): string {
  return EVENT_COLORS[type] ?? "text-slate-500 bg-slate-50";
}

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-400">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical connector line */}
      <div
        className="pointer-events-none absolute bottom-4 left-[17px] top-4 w-px bg-slate-200/60"
        aria-hidden="true"
      />

      {events.map((event, i) => (
        <div
          key={event.id}
          className="relative flex gap-3 py-2.5"
          style={{
            animationDelay: `${i * 30}ms`,
          }}
        >
          {/* Icon dot */}
          <div
            className={`relative z-10 grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full border border-white/80 ${getEventColor(event.event_type)}`}
            style={{ boxShadow: "var(--q-shadow-xs)" }}
          >
            {getEventIcon(event.event_type)}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-1">
            <p className="text-sm leading-snug text-ink">{event.message}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
              <time dateTime={event.created_at} title={new Date(event.created_at).toLocaleString()}>
                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
              </time>
              {event.actor_name ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <UserCircle className="h-3 w-3" aria-hidden="true" />
                    {event.actor_name}
                    {event.actor_role ? (
                      <span className="rounded bg-slate-100 px-1 py-px text-[10px] font-medium text-slate-500">
                        {event.actor_role}
                      </span>
                    ) : null}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
