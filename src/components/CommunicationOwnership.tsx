import { MessageSquare, UserCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type CommunicationOwnershipProps = {
  handledBy?: string | null;
  channel?: string | null;
  lastContactAt?: string | null;
  compact?: boolean;
};

export function CommunicationOwnership({
  handledBy,
  channel,
  lastContactAt,
  compact = false,
}: CommunicationOwnershipProps) {
  if (!handledBy && !lastContactAt) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
        {channel === "whatsapp" ? (
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
        ) : (
          <UserCircle className="h-3 w-3" aria-hidden="true" />
        )}
        {handledBy ?? "Unknown"}
        {lastContactAt ? (
          <> · {formatDistanceToNow(new Date(lastContactAt), { addSuffix: true })}</>
        ) : null}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200/40 bg-slate-50/50 px-2.5 py-1.5">
      <div className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-slate-400">
        {channel === "whatsapp" ? (
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
        ) : (
          <UserCircle className="h-3 w-3" aria-hidden="true" />
        )}
      </div>
      <div className="text-[11px] text-slate-500">
        <span className="font-medium text-slate-600">{handledBy ?? "Unknown"}</span>
        {lastContactAt ? (
          <> · {formatDistanceToNow(new Date(lastContactAt), { addSuffix: true })}</>
        ) : null}
        {channel ? (
          <> via {channel}</>
        ) : null}
      </div>
    </div>
  );
}
