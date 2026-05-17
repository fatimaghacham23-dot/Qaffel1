"use client";

import { type KeyboardEvent, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Ellipsis, FileText, Keyboard, RotateCcw, Search, XCircle } from "lucide-react";
import { reviewProofAction, voidPaymentAction } from "@/app/actions";
import { assignOperationalWorkAction } from "@/app/assignment-actions";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPendingProofUrgency } from "@/lib/operations";
import { parseStoredAiReview } from "@/lib/ai-proof-verification";
import { aiQueueSortKey } from "@/lib/ai-proof-review-ui";
import { buildDuplicateProofMap } from "@/lib/workflow-assistant";
import {
  ASSIGNMENT_PRIORITY_LABELS,
  assignmentInitials,
  formatAssignee,
  isOpenAssignment,
  ownershipLine,
  sortAssignments,
  type AssignmentMemberOption,
  type OperationalAssignmentRow
} from "@/lib/assignments";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { shortDate, money, formatPaymentMethod } from "@/lib/format";

type PaymentProofStatus = "pending" | "accepted" | "rejected" | "voided" | string;
type ProofStatusFilter = "all" | "pending" | "accepted" | "rejected" | "voided";
type ReviewFocus = "all" | "aging" | "needs_attention" | "likely_valid" | "duplicates";

export type PaymentProofTableItem = {
  id: string;
  invoice_id?: string | null;
  image_url?: string | null;
  status: PaymentProofStatus;
  amount_usd?: number | string | null;
  amount_lbp?: number | string | null;
  method?: string | null;
  note?: string | null;
  payment_date?: string | null;
  uploaded_at?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
  receipt_token?: string | null;
  ai_review_json?: unknown;
  ai_review_summary?: string | null;
  reviewer_decision_note?: string | null;
  ai_analyzed_at?: string | null;
  invoices?: {
    id?: string | null;
    title?: string | null;
    invoice_number?: string | null;
    status?: string | null;
    amount_usd?: number | string | null;
    amount_lbp?: number | string | null;
    clients?: {
      name?: string | null;
    } | null;
  } | null;
  assignments?: OperationalAssignmentRow[];
};

interface PaymentProofsTableProps {
  initialProofs: PaymentProofTableItem[];
  assignmentMembers?: AssignmentMemberOption[];
  canManageAssignments?: boolean;
}

const statusOptions: Array<{ value: ProofStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "voided", label: "Voided" }
];

function proofStatusBadge(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  if (s === "pending") {
    return <StatusBadge status="awaiting_review" size="sm" />;
  }
  return <StatusBadge status={s} size="sm" />;
}

function ProofUrgencyBadge({ proof }: { proof: PaymentProofTableItem }) {
  if (proof.status !== "pending") return null;
  const tier = getPendingProofUrgency(proof.uploaded_at);
  if (tier === "fresh") return null;
  if (tier === "over24h") {
    return (
      <Badge variant="outline" className="mt-1 border-amber-300 bg-amber-50 text-[10px] font-semibold text-amber-900">
        Pending &gt; 24h
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="mt-1 border-red-300 bg-red-50 text-[10px] font-semibold text-red-900">
      Pending &gt; 3 days
    </Badge>
  );
}

function AiQueueTagBadge({ proof }: { proof: PaymentProofTableItem }) {
  if (proof.status !== "pending") return null;
  const stored = parseStoredAiReview(proof.ai_review_json);
  const tag = stored?.queue_tag;
  if (!tag) return null;
  const label =
    tag === "likely_valid"
      ? "AI: likely valid"
      : tag === "amount_mismatch"
        ? "AI: amount mismatch"
        : tag === "unclear_screenshot"
          ? "AI: unclear"
          : "AI: needs attention";
  const cls =
    tag === "likely_valid"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tag === "amount_mismatch"
        ? "border-red-200 bg-red-50 text-red-800"
        : tag === "unclear_screenshot"
          ? "border-slate-300 bg-slate-100 text-slate-700"
          : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <Badge variant="outline" className={`mt-1 text-[10px] font-semibold ${cls}`}>
      {label}
    </Badge>
  );
}

function storedQueueTag(proof: PaymentProofTableItem) {
  return parseStoredAiReview(proof.ai_review_json)?.queue_tag || null;
}

function isAgingPendingProof(proof: PaymentProofTableItem) {
  return proof.status === "pending" && getPendingProofUrgency(proof.uploaded_at) !== "fresh";
}

function proofAmountAboveInvoice(proof: PaymentProofTableItem) {
  const usd = Number(proof.amount_usd || 0);
  const lbp = Number(proof.amount_lbp || 0);
  const invUsd = Number(proof.invoices?.amount_usd || 0);
  const invLbp = Number(proof.invoices?.amount_lbp || 0);
  return (usd > 0 && invUsd > 0 && usd > invUsd + 0.01) || (lbp > 0 && invLbp > 0 && lbp > invLbp + 1);
}

function proofNeedsAttention(proof: PaymentProofTableItem, duplicateCount: number) {
  if (proof.status !== "pending") return false;
  const tag = storedQueueTag(proof);
  return duplicateCount > 1 || proofAmountAboveInvoice(proof) || tag === "amount_mismatch" || tag === "unclear_screenshot" || tag === "needs_attention";
}

function proofLikelyValid(proof: PaymentProofTableItem, duplicateCount: number) {
  return proof.status === "pending" && duplicateCount <= 1 && storedQueueTag(proof) === "likely_valid" && !proofAmountAboveInvoice(proof);
}

function DuplicateProofBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <Badge variant="outline" className="mt-1 border-amber-300 bg-amber-50 text-[10px] font-semibold text-amber-900">
      Possible duplicate ({count})
    </Badge>
  );
}

function AmountAttentionBadge({ proof }: { proof: PaymentProofTableItem }) {
  if (!proofAmountAboveInvoice(proof)) return null;
  return (
    <Badge variant="outline" className="mt-1 border-red-300 bg-red-50 text-[10px] font-semibold text-red-900">
      Amount above invoice
    </Badge>
  );
}

function proofAmount(proof: PaymentProofTableItem) {
  const parts = [];
  if (proof.amount_usd) parts.push(money(proof.amount_usd, "USD"));
  if (proof.amount_lbp) parts.push(money(proof.amount_lbp, "LBP"));
  return parts.length > 0 ? parts.join(" + ") : "-";
}

function proofSearchText(proof: PaymentProofTableItem) {
  return [
    proof.invoices?.invoice_number,
    proof.invoices?.title,
    proof.invoices?.clients?.name,
    proof.method,
    formatPaymentMethod(proof.method),
    proof.note,
    proof.void_reason,
    proof.status
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isPdfProof(url: string) {
  return url.toLowerCase().includes(".pdf");
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

function QueueKbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-500">
      {children}
    </kbd>
  );
}

function ProofAssignmentBadges({ assignments }: { assignments?: OperationalAssignmentRow[] }) {
  const open = (assignments || []).filter((assignment) => isOpenAssignment(assignment.status)).sort(sortAssignments);
  if (!open.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {open.slice(0, 2).map((assignment) => (
        <span
          key={assignment.id}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600"
          title={`${ownershipLine(assignment)} - ${ASSIGNMENT_PRIORITY_LABELS[assignment.priority]}`}
        >
          <span className="grid h-4 w-4 place-items-center rounded-full bg-slate-100 text-[8px] text-slate-600">
            {assignmentInitials(assignment)}
          </span>
          <span className="truncate">{formatAssignee(assignment)}</span>
        </span>
      ))}
      {open.length > 2 ? (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          +{open.length - 2}
        </span>
      ) : null}
    </div>
  );
}

function ProofAssignmentForm({
  proof,
  members,
  canManage
}: {
  proof: PaymentProofTableItem;
  members: AssignmentMemberOption[];
  canManage: boolean;
}) {
  if (!canManage || proof.status !== "pending") return null;
  return (
    <form action={assignOperationalWorkAction} className="mt-2 flex min-w-0 flex-wrap gap-1.5">
      <input name="target_type" type="hidden" value="proof" />
      <input name="target_id" type="hidden" value={proof.id} />
      <input name="assignment_type" type="hidden" value="reviewer" />
      <input name="priority" type="hidden" value="normal" />
      <select
        aria-label="Assign proof reviewer"
        className="h-8 max-w-[180px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 outline-none focus:border-cedar/50"
        name="assignee"
        defaultValue={members[0] ? `user:${members[0].userId}` : "role:reviewer"}
      >
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
          <option value="role:reviewer">Reviewer</option>
          <option value="role:finance">Finance</option>
          <option value="role:operations">Operations</option>
        </optgroup>
      </select>
      <button className="btn btn-secondary h-8 px-2 text-[11px]" type="submit">
        Assign
      </button>
    </form>
  );
}

function ProofPreview({ proof }: { proof: PaymentProofTableItem }) {
  if (!proof.image_url) {
    return (
      <div className="grid h-12 w-14 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
        <FileText className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }

  if (isPdfProof(proof.image_url)) {
    return (
      <a
        className="grid h-12 w-14 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-cedar/30 hover:bg-cedar/5"
        href={proof.image_url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <FileText className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Open PDF proof</span>
      </a>
    );
  }

  return (
    <a
      className="block h-12 w-14 overflow-hidden rounded-lg border border-slate-200 transition hover:border-cedar/30"
      href={proof.image_url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Image
        alt="Payment proof preview"
        className="h-full w-full object-cover"
        height={96}
        src={proof.image_url}
        unoptimized
        width={112}
      />
    </a>
  );
}

function ProofStatusMessage({ proof }: { proof: PaymentProofTableItem }) {
  if (proof.status === "voided") {
    return (
      <div className="mt-1 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Payment voided</span>
        {proof.void_reason ? <span className="italic">: {proof.void_reason}</span> : null}
      </div>
    );
  }

  if (proof.status === "rejected") {
    return <p className="mt-1 text-xs font-semibold text-red-700">Proof rejected</p>;
  }

  if (proof.status === "accepted") {
    return <p className="mt-1 text-xs font-semibold text-emerald-700">Payment accepted</p>;
  }

  return null;
}

function isWhishOrOmtMethod(method?: string | null) {
  const value = (method || "").toLowerCase();
  return value.includes("whish") || value.includes("omt");
}

function ProofActions({ proof }: { proof: PaymentProofTableItem }) {
  const [isPending, startTransition] = useTransition();
  const invoiceId = proof.invoices?.id || proof.invoice_id || "";

  const reviewProof = (proofStatus: "accepted" | "rejected", invoiceStatus?: string) => {
    const formData = new FormData();
    formData.append("proof_id", proof.id);
    formData.append("invoice_id", invoiceId);
    formData.append("proof_status", proofStatus);
    formData.append("invoice_status", invoiceStatus ?? (proofStatus === "accepted" ? "paid" : proof.invoices?.status || "unpaid"));

    startTransition(async () => {
      try {
        await reviewProofAction(formData);
        if (proofStatus === "accepted") {
          toast.success("Payment proof accepted; invoice balance was reconciled.");
        } else {
          toast.success("Payment proof rejected.");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update proof status.");
      }
    });
  };

  const voidProof = () => {
    const reason = window.prompt("Why are you voiding this payment? (Optional)");
    if (reason === null) return;

    if (!window.confirm("Are you sure you want to void this payment? This will update the invoice balance.")) {
      return;
    }

    const formData = new FormData();
    formData.append("proof_id", proof.id);
    if (reason) formData.append("reason", reason);

    startTransition(async () => {
      try {
        await voidPaymentAction(formData);
        toast.success("Payment voided successfully.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to void payment.");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Open proof actions" className="rounded-full shadow-none" disabled={isPending} size="icon" variant="ghost">
          <Ellipsis className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-slate-200 bg-white">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        {proof.status === "pending" ? (
          <>
            <DropdownMenuItem onSelect={() => reviewProof("accepted", "paid")}>Accept full</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => reviewProof("accepted", "partial")}>Accept partial</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => reviewProof("rejected")} variant="destructive">
              Reject
            </DropdownMenuItem>
            {proof.image_url ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={proof.image_url} rel="noopener noreferrer" target="_blank">
                    Open proof
                  </a>
                </DropdownMenuItem>
              </>
            ) : null}
          </>
        ) : proof.status === "accepted" ? (
          <>
            {proof.image_url ? (
              <DropdownMenuItem asChild>
                <a href={proof.image_url} rel="noopener noreferrer" target="_blank">
                  Open proof
                </a>
              </DropdownMenuItem>
            ) : null}
            {proof.receipt_token && (
              <DropdownMenuItem asChild>
                <Link href={`/receipt/${proof.receipt_token}`} target="_blank">
                  Open receipt
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={voidProof} variant="destructive">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Void payment
            </DropdownMenuItem>
          </>
        ) : proof.status === "voided" ? (
          <DropdownMenuItem disabled>Payment voided</DropdownMenuItem>
        ) : proof.status === "rejected" ? (
          <DropdownMenuItem disabled>Proof rejected</DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>No actions</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProofMobileCard({
  proof,
  active,
  selected,
  duplicateCount,
  onSelectedChange,
  assignmentMembers,
  canManageAssignments
}: {
  proof: PaymentProofTableItem;
  active: boolean;
  selected: boolean;
  duplicateCount: number;
  onSelectedChange: (checked: boolean) => void;
  assignmentMembers: AssignmentMemberOption[];
  canManageAssignments: boolean;
}) {
  const invoiceHref = proof.invoices?.id ? `/invoices/${proof.invoices.id}` : "#";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <article className={cn("q-mobile-card", selected && "border-cedar/40 bg-cedar/5", active && "outline outline-2 outline-cedar/25")}>
      <div className="flex items-start gap-3">
        <Checkbox
          aria-label={`Select proof ${proof.id}`}
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(checked === true)}
        />
        <ProofPreview proof={proof} />
        <div className="min-w-0 flex-1">
          <Link className="block font-semibold text-ink" href={invoiceHref}>
            <span className="block truncate">{proof.invoices?.invoice_number || "Invoice"}</span>
            <span className="block truncate text-xs font-normal text-slate-500">{proof.invoices?.title || "Untitled invoice"}</span>
          </Link>
          <p className="mt-1 truncate text-xs text-slate-500">{proof.invoices?.clients?.name || "No client"}</p>
          <ProofAssignmentBadges assignments={proof.assignments} />
        </div>
        <ProofActions proof={proof} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</p>
          <p className="mt-1 text-sm font-bold text-ink">{proofAmount(proof)}</p>
          {proof.payment_date ? <p className="mt-1 text-xs text-slate-500">Paid {shortDate(proof.payment_date)}</p> : null}
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
          <div className="mt-1">
            {proofStatusBadge(proof.status)}
            <ProofUrgencyBadge proof={proof} />
            <AiQueueTagBadge proof={proof} />
            <DuplicateProofBadge count={duplicateCount} />
            <AmountAttentionBadge proof={proof} />
            <ProofStatusMessage proof={proof} />
            <ProofAssignmentForm proof={proof} members={assignmentMembers} canManage={canManageAssignments} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Method</p>
          <p className="mt-1 text-sm font-semibold text-ink">{formatPaymentMethod(proof.method) || "-"}</p>
          {isWhishOrOmtMethod(proof.method) && (
            <ul className="mt-2 space-y-0.5 text-[10px] text-slate-600">
              <li className="font-semibold text-slate-700">Checklist before accepting:</li>
              <li>• Amount equals deposit or remaining balance.</li>
              <li>• Date matches expected payment date.</li>
              <li>• Receiver name / phone matches your Whish or OMT details.</li>
              <li>• Screenshot text is clearly readable.</li>
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Uploaded</p>
          <p className="mt-1 text-sm font-semibold text-ink">{shortDate(proof.uploaded_at)}</p>
        </div>
      </div>

      {proof.receipt_token ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
          <Link className="btn btn-secondary text-xs" href={`/receipt/${proof.receipt_token}`} target="_blank">
            Open receipt
          </Link>
          <CopyLinkButton
            value={`${appUrl}/receipt/${proof.receipt_token}`}
            label="Copy receipt link"
            className="btn btn-secondary text-xs"
          />
        </div>
      ) : null}
    </article>
  );
}

export function PaymentProofsTable({
  initialProofs,
  assignmentMembers = [],
  canManageAssignments = false
}: PaymentProofsTableProps) {
  const router = useRouter();
  const queueRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProofStatusFilter>("all");
  const [reviewFocus, setReviewFocus] = useState<ReviewFocus>("all");
  const [selectedProofIds, setSelectedProofIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isQuickReviewPending, startQuickReviewTransition] = useTransition();

  const counts = useMemo(() => {
    return initialProofs.reduce(
      (acc, proof) => {
        if (proof.status === "pending") acc.pending += 1;
        if (proof.status === "accepted") acc.accepted += 1;
        if (proof.status === "voided") acc.voided += 1;
        return acc;
      },
      { pending: 0, accepted: 0, voided: 0 }
    );
  }, [initialProofs]);

  const duplicateProofCounts = useMemo(() => buildDuplicateProofMap(initialProofs), [initialProofs]);

  const reviewGroups = useMemo(() => {
    return initialProofs.reduce(
      (acc, proof) => {
        const duplicateCount = duplicateProofCounts.get(proof.id) || 0;
        if (isAgingPendingProof(proof)) acc.aging += 1;
        if (proofNeedsAttention(proof, duplicateCount)) acc.needsAttention += 1;
        if (proofLikelyValid(proof, duplicateCount)) acc.likelyValid += 1;
        if (duplicateCount > 1 && proof.status === "pending") acc.duplicates += 1;
        return acc;
      },
      { aging: 0, needsAttention: 0, likelyValid: 0, duplicates: 0 }
    );
  }, [duplicateProofCounts, initialProofs]);

  const filteredProofs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = initialProofs.filter((proof) => {
      const duplicateCount = duplicateProofCounts.get(proof.id) || 0;
      const matchesStatus = statusFilter === "all" || proof.status === statusFilter;
      const matchesSearch = query.length === 0 || proofSearchText(proof).includes(query);
      const matchesFocus =
        reviewFocus === "all" ||
        (reviewFocus === "aging" && isAgingPendingProof(proof)) ||
        (reviewFocus === "needs_attention" && proofNeedsAttention(proof, duplicateCount)) ||
        (reviewFocus === "likely_valid" && proofLikelyValid(proof, duplicateCount)) ||
        (reviewFocus === "duplicates" && duplicateCount > 1 && proof.status === "pending");
      return matchesStatus && matchesSearch && matchesFocus;
    });

    return [...filtered].sort((a, b) => {
      const pendingRank = (p: PaymentProofTableItem) => (p.status === "pending" ? 0 : 1);
      const pr = pendingRank(a) - pendingRank(b);
      if (pr !== 0) return pr;
      if (a.status === "pending" && b.status === "pending") {
        const reviewRank = (p: PaymentProofTableItem) => {
          const duplicateCount = duplicateProofCounts.get(p.id) || 0;
          if (proofNeedsAttention(p, duplicateCount)) return 0;
          if (isAgingPendingProof(p)) return 1;
          if (proofLikelyValid(p, duplicateCount)) return 2;
          return 3;
        };
        const rr = reviewRank(a) - reviewRank(b);
        if (rr !== 0) return rr;
        const d = aiQueueSortKey(a) - aiQueueSortKey(b);
        if (d !== 0) return d;
        return new Date(a.uploaded_at || 0).getTime() - new Date(b.uploaded_at || 0).getTime();
      }
      return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
    });
  }, [duplicateProofCounts, initialProofs, reviewFocus, searchQuery, statusFilter]);

  const visibleIds = filteredProofs.map((proof) => proof.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedProofIds.includes(id));
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, filteredProofs.length - 1));
  const activeProof = filteredProofs[safeActiveIndex] || null;

  const toggleSelectAll = (checked: boolean) => {
    setSelectedProofIds((current) =>
      checked ? Array.from(new Set([...current, ...visibleIds])) : current.filter((id) => !visibleIds.includes(id))
    );
  };

  const toggleSelected = (proofId: string, checked: boolean) => {
    setSelectedProofIds((current) =>
      checked ? Array.from(new Set([...current, proofId])) : current.filter((id) => id !== proofId)
    );
  };

  const moveActiveProof = (direction: 1 | -1) => {
    setActiveIndex((current) => {
      if (filteredProofs.length === 0) return 0;
      return Math.min(filteredProofs.length - 1, Math.max(0, current + direction));
    });
  };

  const quickReviewActiveProof = (proofStatus: "accepted" | "rejected", invoiceStatus?: string) => {
    if (!activeProof || activeProof.status !== "pending") {
      toast.message("Select a pending proof first.");
      return;
    }

    const invoiceId = activeProof.invoices?.id || activeProof.invoice_id || "";
    if (!invoiceId) {
      toast.error("This proof is missing an invoice reference.");
      return;
    }

    const confirmed = window.confirm(
      proofStatus === "accepted"
        ? "Accept this proof as full payment? You remain responsible for manual verification."
        : "Reject this proof? You remain responsible for manual verification."
    );
    if (!confirmed) return;

    const formData = new FormData();
    formData.append("proof_id", activeProof.id);
    formData.append("invoice_id", invoiceId);
    formData.append("proof_status", proofStatus);
    formData.append("invoice_status", invoiceStatus ?? (proofStatus === "accepted" ? "paid" : activeProof.invoices?.status || "unpaid"));

    startQuickReviewTransition(async () => {
      try {
        await reviewProofAction(formData);
        toast.success(proofStatus === "accepted" ? "Payment proof accepted." : "Payment proof rejected.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update proof status.");
      }
    });
  };

  const handleQueueKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (
      event.target !== event.currentTarget &&
      event.target instanceof HTMLElement &&
      event.target.closest("button,a,[role='button']")
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "arrowdown" || key === "j") {
      event.preventDefault();
      moveActiveProof(1);
      return;
    }

    if (key === "arrowup" || key === "k") {
      event.preventDefault();
      moveActiveProof(-1);
      return;
    }

    if (key === "a") {
      event.preventDefault();
      quickReviewActiveProof("accepted", "paid");
      return;
    }

    if (key === "x") {
      event.preventDefault();
      quickReviewActiveProof("rejected");
      return;
    }

    if (key === "enter" && activeProof?.invoices?.id) {
      event.preventDefault();
      router.push(`/invoices/${activeProof.invoices.id}#proofs-review`);
    }
  };

  const focusOptions: Array<{ id: ReviewFocus; label: string; count: number; detail: string; tone: string }> = [
    { id: "all", label: "All proofs", count: initialProofs.length, detail: "Full audit list", tone: "border-slate-200 bg-white" },
    { id: "aging", label: "Aging review", count: reviewGroups.aging, detail: "Pending over 24h", tone: "border-amber-200 bg-amber-50" },
    { id: "needs_attention", label: "Needs attention", count: reviewGroups.needsAttention, detail: "Mismatch, unclear, duplicate, or over amount", tone: "border-red-200 bg-red-50" },
    { id: "likely_valid", label: "Likely valid", count: reviewGroups.likelyValid, detail: "Stored advisory tag and no duplicate", tone: "border-emerald-200 bg-emerald-50" },
    { id: "duplicates", label: "Duplicates", count: reviewGroups.duplicates, detail: "Same date, method, and amount", tone: "border-sky-200 bg-sky-50" }
  ];

  const applyReviewFocus = (focus: ReviewFocus) => {
    setReviewFocus(focus);
    if (focus !== "all") setStatusFilter("pending");
  };

  return (
    <div
      ref={queueRef}
      aria-label="Payment proof review queue"
      className="min-w-0 w-full rounded-3xl focus:outline-none focus:ring-4 focus:ring-cedar/10"
      onKeyDown={handleQueueKeyDown}
      onMouseDown={() => queueRef.current?.focus()}
      tabIndex={0}
    >
      <div className="mb-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 pl-9"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search invoice, client, method, note..."
              value={searchQuery}
            />
          </div>
          <Select onValueChange={(value) => setStatusFilter(value as ProofStatusFilter)} value={statusFilter}>
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="border-slate-200 bg-white">
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-amber-50 text-amber-700">
            Pending {counts.pending.toLocaleString()}
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
            Accepted {counts.accepted.toLocaleString()}
          </Badge>
          <Badge variant="outline" className="bg-slate-100 text-slate-700">
            Voided {counts.voided.toLocaleString()}
          </Badge>
        </div>
      </div>

      {initialProofs.length > 0 ? (
        <div className="mb-4 rounded-3xl border border-slate-200/80 bg-white/90 p-3 shadow-soft sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-ink">Review assistant</p>
              <p className="mt-0.5 text-xs text-slate-500">Grouped by real proof data. Final approval stays manual.</p>
            </div>
            {reviewFocus !== "all" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => applyReviewFocus("all")}>
                Clear focus
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {focusOptions.map((option) => {
              const selected = reviewFocus === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => applyReviewFocus(option.id)}
                  className={cn(
                    "touch-manipulation rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-card",
                    option.tone,
                    selected && "ring-2 ring-cedar/25"
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-ink">{option.label}</span>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">{option.count}</span>
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-slate-600">{option.detail}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {filteredProofs.length > 0 ? (
        <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
              <Keyboard className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Proof queue shortcuts</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                Active {safeActiveIndex + 1} of {filteredProofs.length}: {activeProof?.invoices?.invoice_number || activeProof?.invoices?.title || "Proof"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
                <QueueKbd>Up</QueueKbd>
                <QueueKbd>Down</QueueKbd>
                <span>navigate</span>
                <QueueKbd>A</QueueKbd>
                <span>accept</span>
                <QueueKbd>X</QueueKbd>
                <span>reject</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button aria-label="Previous proof" onClick={() => moveActiveProof(-1)} size="sm" variant="outline">
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button aria-label="Next proof" onClick={() => moveActiveProof(1)} size="sm" variant="outline">
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
              Next
            </Button>
            <Button
              aria-keyshortcuts="A"
              disabled={!activeProof || activeProof.status !== "pending" || isQuickReviewPending}
              onClick={() => quickReviewActiveProof("accepted", "paid")}
              size="sm"
              variant="outline"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Accept full
            </Button>
            <Button
              aria-keyshortcuts="X"
              className="text-red-700 hover:text-red-800"
              disabled={!activeProof || activeProof.status !== "pending" || isQuickReviewPending}
              onClick={() => quickReviewActiveProof("rejected")}
              size="sm"
              variant="outline"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Reject
            </Button>
          </div>
        </div>
      ) : null}

      <section className="q-table-shell">
        <div className="grid gap-3 bg-slate-50/60 p-3 lg:hidden">
          {filteredProofs.length === 0 ? (
            initialProofs.length === 0 ? (
              <PremiumEmptyState
                title="No payment proofs yet."
                description="Proofs appear here after a client uploads a screenshot or receipt from a public invoice page."
                guidance={[
                  "Share an invoice public page only after payment methods are clear.",
                  "Clients upload proof there; Qaffel queues it without approving it.",
                  "Review amount, date, receiver details, and readability before accepting."
                ]}
                example="Proofs are never auto-accepted. You stay in control of reconciliation."
                action={
                  <Link className="btn btn-primary text-xs" href="/invoices">
                    Go to invoices
                  </Link>
                }
              />
            ) : (
              <PremiumEmptyState
                title="No payment proofs match your filters."
                description="Try a different search term or status filter."
                example="Switch status to “Pending” to focus the review queue."
                action={
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => setStatusFilter("all")}>
                    Show all statuses
                  </button>
                }
              />
            )
          ) : (
            filteredProofs.map((proof) => (
              <ProofMobileCard
                key={proof.id}
                proof={proof}
                active={activeProof?.id === proof.id}
                selected={selectedProofIds.includes(proof.id)}
                duplicateCount={duplicateProofCounts.get(proof.id) || 0}
                onSelectedChange={(checked) => toggleSelected(proof.id, checked)}
                assignmentMembers={assignmentMembers}
                canManageAssignments={canManageAssignments}
              />
            ))
          )}
        </div>

        <div className="hidden w-full min-w-0 lg:block">
          <Table className="w-full table-auto border-separate border-spacing-0 max-lg:min-w-[760px]">
            <TableHeader className="q-table-head">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-9 px-3">
                  <Checkbox
                    aria-label="Select all visible proofs"
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                  />
                </TableHead>
                <TableHead className="w-[72px] px-3">Proof</TableHead>
                <TableHead className="w-[28%]">Invoice</TableHead>
                <TableHead className="w-[16%]">Client</TableHead>
                <TableHead className="w-[13%]">Amount</TableHead>
                <TableHead className="hidden w-[10%] xl:table-cell">Method</TableHead>
                <TableHead className="w-[12%]">Status</TableHead>
                <TableHead className="hidden w-[12%] lg:table-cell">Invoice status</TableHead>
                <TableHead className="w-[10%]">Uploaded</TableHead>
                <TableHead className="w-20 px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-slate-700">
              {filteredProofs.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell className="py-10 text-center" colSpan={10}>
                    {initialProofs.length === 0 ? (
                      <PremiumEmptyState
                        title="No payment proofs yet."
                        description="Proofs appear here after a client uploads a screenshot or receipt from a public invoice page."
                        guidance={[
                          "Share an invoice public page only after payment methods are clear.",
                          "Clients upload proof there; Qaffel queues it without approving it.",
                          "Review amount, date, receiver details, and readability before accepting."
                        ]}
                        example="Proofs are never auto-accepted. You stay in control of reconciliation."
                        action={
                          <Link className="btn btn-primary text-xs" href="/invoices">
                            Go to invoices
                          </Link>
                        }
                      />
                    ) : (
                      <PremiumEmptyState
                        title="No payment proofs match your filters."
                        description="Try a different search term or status filter."
                        action={
                          <button type="button" className="btn btn-secondary text-xs" onClick={() => setStatusFilter("all")}>
                            Show all statuses
                          </button>
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredProofs.map((proof) => {
                  const invoiceHref = proof.invoices?.id ? `/invoices/${proof.invoices.id}` : "#";
                  const selected = selectedProofIds.includes(proof.id);
                  const active = activeProof?.id === proof.id;
                  const duplicateCount = duplicateProofCounts.get(proof.id) || 0;

                  return (
                    <TableRow key={proof.id} className={cn(selected && "bg-cedar/5", active && "bg-cedar/[0.07] outline outline-2 outline-cedar/20 outline-offset-[-2px]")}>
                      <TableCell className="px-3">
                        <Checkbox
                          aria-label={`Select proof ${proof.id}`}
                          checked={selected}
                          onCheckedChange={(checked) => toggleSelected(proof.id, checked === true)}
                        />
                      </TableCell>
                      <TableCell className="px-3">
                        <ProofPreview proof={proof} />
                      </TableCell>
                      <TableCell className="max-w-0">
                        <Link className="block min-w-0 font-semibold text-ink transition hover:text-cedar" href={invoiceHref}>
                          <span className="block truncate">{proof.invoices?.invoice_number || "Invoice"}</span>
                          <span className="block truncate text-xs font-normal text-slate-500">{proof.invoices?.title || "Untitled invoice"}</span>
                        </Link>
                        <ProofAssignmentBadges assignments={proof.assignments} />
                      </TableCell>
                      <TableCell className="max-w-0">
                        <span className="block truncate text-sm font-medium text-slate-700">
                          {proof.invoices?.clients?.name || "No client"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="block truncate text-sm font-semibold text-ink">{proofAmount(proof)}</span>
                        {proof.payment_date ? (
                          <span className="block truncate text-xs text-slate-500">Paid {shortDate(proof.payment_date)}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="max-w-xs">
                          <span className="block truncate text-sm">{formatPaymentMethod(proof.method) || "-"}</span>
                          {isWhishOrOmtMethod(proof.method) && (
                            <p className="mt-1 text-[10px] text-slate-500">
                              Verify amount, date, receiver name/phone, and that the screenshot is readable before accepting.
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {proofStatusBadge(proof.status)}
                          <ProofUrgencyBadge proof={proof} />
                          <AiQueueTagBadge proof={proof} />
                          <DuplicateProofBadge count={duplicateCount} />
                          <AmountAttentionBadge proof={proof} />
                        </div>
                        <ProofStatusMessage proof={proof} />
                        <ProofAssignmentForm proof={proof} members={assignmentMembers} canManage={canManageAssignments} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <StatusBadge status={proof.invoices?.status || "unknown"} size="sm" />
                      </TableCell>
                      <TableCell>
                        <span className="block truncate text-sm text-slate-600">{shortDate(proof.uploaded_at)}</span>
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <div className="flex justify-end">
                          <ProofActions proof={proof} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <span>
          Showing {filteredProofs.length.toLocaleString()} of {initialProofs.length.toLocaleString()} proofs
        </span>
        {selectedProofIds.length > 0 ? <span>{selectedProofIds.length.toLocaleString()} selected</span> : null}
      </div>
    </div>
  );
}
