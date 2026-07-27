type TeamSummaryProps = { additionalMemberCount: number; pendingInvitationCount: number };

export function TeamSummary({ additionalMemberCount, pendingInvitationCount }: TeamSummaryProps) {
  return (
    <span className="ms-3 inline-flex flex-wrap gap-x-3 gap-y-1 text-xs font-normal text-slate-500" dir="auto">
      <span>Additional members: {additionalMemberCount}</span>
      <span>Pending invitations: {pendingInvitationCount}</span>
    </span>
  );
}
