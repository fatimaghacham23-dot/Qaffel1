"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Ellipsis, FileText, RotateCcw, Search } from "lucide-react";
import { reviewProofAction, voidPaymentAction } from "@/app/actions";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumEmptyState } from "@/components/PremiumEmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPendingProofUrgency } from "@/lib/operations";
import { parseStoredAiReview } from "@/lib/ai-proof-verification";
import { aiQueueSortKey } from "@/lib/ai-proof-review-ui";
import { cn } from "@/lib/utils";
import { shortDate, money, formatPaymentMethod } from "@/lib/format";

type PaymentProofStatus = "pending" | "accepted" | "rejected" | "voided" | string;
type ProofStatusFilter = "all" | "pending" | "accepted" | "rejected" | "voided";

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
};

interface PaymentProofsTableProps {
  initialProofs: PaymentProofTableItem[];
}

const statusOptions: Array<{ value: ProofStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "voided", label: "Voided" }
];

function statusBadgeClass(status: string) {
  if (status === "pending") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "accepted") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "voided") return "bg-slate-100 text-slate-700 border-slate-200";
  if (status === "rejected") return "bg-red-50 text-red-700 border-red-200";
  if (status === "paid") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "partial") return "bg-sky-50 text-sky-700 border-sky-200";
  if (status === "overdue") return "bg-red-50 text-red-700 border-red-200";
  if (status === "sent") return "bg-indigo-50 text-indigo-700 border-indigo-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function StatusPill({ status, label }: { status?: string | null; label?: string }) {
  const value = status || "unknown";

  return (
    <Badge variant="outline" className={cn("capitalize", statusBadgeClass(value))}>
      {label || value}
    </Badge>
  );
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
  selected,
  onSelectedChange
}: {
  proof: PaymentProofTableItem;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
}) {
  const invoiceHref = proof.invoices?.id ? `/invoices/${proof.invoices.id}` : "#";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  return (
    <article className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-soft", selected && "border-cedar/40 bg-cedar/5")}>
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
        </div>
        <ProofActions proof={proof} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</p>
          <p className="mt-1 text-sm font-bold text-ink">{proofAmount(proof)}</p>
          {proof.payment_date ? <p className="mt-1 text-xs text-slate-500">Paid {shortDate(proof.payment_date)}</p> : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
          <div className="mt-1">
            <StatusPill status={proof.status} />
            <ProofUrgencyBadge proof={proof} />
            <AiQueueTagBadge proof={proof} />
            <ProofStatusMessage proof={proof} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
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
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
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

export function PaymentProofsTable({ initialProofs }: PaymentProofsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProofStatusFilter>("all");
  const [selectedProofIds, setSelectedProofIds] = useState<string[]>([]);

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

  const filteredProofs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = initialProofs.filter((proof) => {
      const matchesStatus = statusFilter === "all" || proof.status === statusFilter;
      const matchesSearch = query.length === 0 || proofSearchText(proof).includes(query);
      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      const pendingRank = (p: PaymentProofTableItem) => (p.status === "pending" ? 0 : 1);
      const pr = pendingRank(a) - pendingRank(b);
      if (pr !== 0) return pr;
      if (a.status === "pending" && b.status === "pending") {
        const d = aiQueueSortKey(a) - aiQueueSortKey(b);
        if (d !== 0) return d;
        return new Date(a.uploaded_at || 0).getTime() - new Date(b.uploaded_at || 0).getTime();
      }
      return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
    });
  }, [initialProofs, searchQuery, statusFilter]);

  const visibleIds = filteredProofs.map((proof) => proof.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedProofIds.includes(id));

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

  return (
    <div className="min-w-0 w-full">
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

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="grid gap-3 bg-slate-50/60 p-3 lg:hidden">
          {filteredProofs.length === 0 ? (
            initialProofs.length === 0 ? (
              <PremiumEmptyState
                title="No payment proofs yet."
                description="When clients upload Whish, OMT, or bank screenshots from the public invoice page, they appear here for your review."
                example="Share your /pay/… link after publishing an invoice — proofs queue automatically."
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
                selected={selectedProofIds.includes(proof.id)}
                onSelectedChange={(checked) => toggleSelected(proof.id, checked)}
              />
            ))
          )}
        </div>

        <div className="hidden w-full min-w-0 lg:block">
          <Table className="w-full table-auto border-separate border-spacing-0 max-lg:min-w-[760px]">
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
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
                        description="When clients upload Whish, OMT, or bank screenshots from the public invoice page, they appear here for your review."
                        example="Proofs are never auto-accepted — you stay in control of reconciliation."
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

                  return (
                    <TableRow key={proof.id} className={cn(selected && "bg-cedar/5")}>
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
                          <StatusPill status={proof.status} />
                          <ProofUrgencyBadge proof={proof} />
                          <AiQueueTagBadge proof={proof} />
                        </div>
                        <ProofStatusMessage proof={proof} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <StatusPill status={proof.invoices?.status || "unknown"} />
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
