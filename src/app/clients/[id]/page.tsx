import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FilePlus2, Mail, MessageCircle, Phone, ReceiptText, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PrintButton } from "@/components/PrintButton";
import { ClientStatementCsvExport } from "@/components/ClientStatementCsvExport";
import { CopyButton } from "@/components/CopyButton";
import { documentNounTitle, documentStatus, isQuoteDocument } from "@/lib/documents";
import { money, shortDate } from "@/lib/format";
import { getClientHealth } from "@/lib/operations";
import { getRemainingBalance, getDisplayInvoiceStatus } from "@/lib/status";
import { requireUser } from "@/lib/supabase/server";
import { regenerateClientPortalTokenAction } from "@/app/actions";
import { ClientIntelligenceCard } from "@/components/ClientIntelligenceCard";
import { QuickActionGrid, type ProductivityAction } from "@/components/ProductivityQuickActions";
import { buildClientIntelligence } from "@/lib/intelligence-layer";
import type { OCInvoiceRow } from "@/lib/operations-center";
import {
  buildClientMemoryTimeline,
  deriveClientContextBullets,
  deriveRelationshipSignals,
  groupMemoryTimelineByDay
} from "@/lib/workspace-memory";
import { ClientContextRelationshipPanel, ClientMemoryTimeline } from "@/components/workspace/ClientContextTimeline";
import { ClientWorkspaceNotesPanel } from "@/components/workspace/ClientWorkspaceNotesPanel";
import { WorkspaceMessageTemplatesCard } from "@/components/workspace/WorkspaceMessageTemplatesCard";
import { buildEligibleClientPortalUrl } from "@/lib/urls";

function ClientFlag({ tone, label }: { tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }) {
  const tones = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700"
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</span>;
}

function whatsappHref(phone?: string | null) {
  const clean = (phone || "").replace(/\D/g, "");
  return clean ? `https://wa.me/${clean}` : null;
}

export default async function ClientDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(
      "*, invoices(*, payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, payment_date, method, voided_at))"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (clientError || !client) {
    return notFound();
  }

  const documents = client.invoices || [];
  const invoiceIds = documents.map((d: { id: string }) => d.id);

  const [{ data: profile }, { data: clientEvents }, { data: clientNotes }, { data: invoiceMemNotes }, { data: workspaceTemplates }] =
    await Promise.all([
      supabase.from("profiles").select("business_name, full_name, phone").eq("id", user.id).maybeSingle(),
      supabase
        .from("invoice_events")
        .select("id, invoice_id, event_type, message, created_at, metadata")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("client_workspace_notes")
        .select("id, client_id, category, body, is_pinned, created_at, updated_at")
        .eq("client_id", id)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      invoiceIds.length
        ? supabase
            .from("invoice_workspace_notes")
            .select("id, invoice_id, category, body, is_pinned, created_at, updated_at")
            .in("invoice_id", invoiceIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .from("workspace_message_templates")
        .select("id, category, label, body, is_favorite, use_count, last_used_at, created_at")
        .eq("user_id", user.id)
        .order("is_favorite", { ascending: false })
        .order("last_used_at", { ascending: false })
        .limit(40)
    ]);
  const invoices = documents.filter((inv: any) => !isQuoteDocument(inv));
  const quotes = documents.filter((inv: any) => isQuoteDocument(inv));
  const overdueInvoices = invoices.filter((inv: any) => getDisplayInvoiceStatus(inv) === "overdue");
  const hasBalanceDue = invoices.some((inv: any) => {
    const displayStatus = getDisplayInvoiceStatus(inv);
    return ["sent", "unpaid", "partial", "overdue"].includes(displayStatus);
  });

  const lastPaymentDateIso = (() => {
    const accepted = invoices
      .flatMap((inv: any) => (inv.payment_proofs || []).map((p: any) => ({ ...p, invoice_id: inv.id })))
      .filter((p: any) => p.status === "accepted");

    const dates = accepted
      .map((p: any) => p.payment_date || p.confirmed_at || p.uploaded_at)
      .filter(Boolean)
      .map((value: any) => new Date(value));

    const latest = dates.reduce((acc: Date | null, d: Date) => {
      if (Number.isNaN(d.getTime())) return acc;
      if (!acc) return d;
      return d > acc ? d : acc;
    }, null as Date | null);

    return latest ? latest.toISOString() : null;
  })();
  
  // Calculate totals grouped by currency
  const totalsByCurrency = invoices.reduce((acc: any, inv: any) => {
    const balance = getRemainingBalance(inv, inv.payment_proofs || []);
    const curr = balance.primaryCurrency;
    
    if (!acc[curr]) {
      acc[curr] = { billed: 0, paid: 0, balance: 0, overpaid: 0 };
    }
    
    acc[curr].billed += Number(inv[`amount_${curr.toLowerCase()}` as keyof typeof inv] || 0);
    acc[curr].paid += balance.primaryTotalPaid;
    acc[curr].balance += balance.primaryBalance;
    acc[curr].overpaid += balance.primaryOverpaid;
    
    return acc;
  }, {} as Record<string, { billed: number, paid: number, balance: number, overpaid: number }>);

  const currencies = Object.keys(totalsByCurrency).sort();

  // Data for CSV export
  const csvData = invoices.map((inv: any) => {
    const balance = getRemainingBalance(inv, inv.payment_proofs || []);
    return {
      invoice_number: inv.invoice_number,
      title: inv.title,
      status: getDisplayInvoiceStatus(inv),
      currency: inv.currency,
      amount_usd: inv.amount_usd || 0,
      amount_lbp: inv.amount_lbp || 0,
      paid_usd: balance.totalPaidUsd,
      paid_lbp: balance.totalPaidLbp,
      remaining_usd: balance.usd,
      remaining_lbp: balance.lbp,
      overpaid_usd: balance.overpaidUsd,
      overpaid_lbp: balance.overpaidLbp,
      due_date: inv.due_date || "",
      created_at: inv.created_at
    };
  });

  const portalUrl = buildEligibleClientPortalUrl(client.client_portal_token);
  const clientWhatsAppUrl = whatsappHref(client.phone);
  const acceptedPaymentCount = invoices.reduce(
    (count: number, inv: any) => count + (inv.payment_proofs || []).filter((proof: any) => proof.status === "accepted").length,
    0
  );
  const clientHealth = getClientHealth({
    hasOverdueInvoice: overdueInvoices.length > 0,
    hasOpenBalance: hasBalanceDue
  });
  const healthCopy =
    clientHealth === "risk"
      ? "Risk: at least one overdue invoice — prioritize collection or confirm payment."
      : clientHealth === "attention"
        ? "Attention: open balance without overdue yet — good time to follow up."
        : "Good standing: no overdue invoices right now.";

  const clientFlags = [
    !client.phone ? { tone: "warn" as const, label: "Missing client phone" } : { tone: "good" as const, label: "Phone saved" },
    !client.email ? { tone: "warn" as const, label: "Missing client email" } : { tone: "good" as const, label: "Email saved" },
    overdueInvoices.length > 0 ? { tone: "danger" as const, label: "Overdue invoice" } : null,
    hasBalanceDue ? { tone: "warn" as const, label: "Balance attention" } : { tone: "good" as const, label: "No open balance" },
    acceptedPaymentCount === 0 ? { tone: "warn" as const, label: "No accepted payments" } : { tone: "good" as const, label: "Accepted payments" },
    portalUrl ? { tone: "good" as const, label: "Portal link active" } : { tone: "neutral" as const, label: "Portal link inactive" }
  ].filter(Boolean) as Array<{ tone: "good" | "warn" | "danger" | "info" | "neutral"; label: string }>;

  const invoiceIdSet = new Set(documents.map((d: { id: string }) => d.id));
  const eventsForClient = (clientEvents || []).filter((e: { invoice_id: string }) => invoiceIdSet.has(e.invoice_id));
  const clientIntel =
    invoices.length > 0
      ? buildClientIntelligence({
          clientId: id,
          invoices: invoices as unknown as OCInvoiceRow[],
          events: eventsForClient as any
        })
      : null;
  const clientActionCandidates: Array<ProductivityAction | null> = [
    {
      label: "Create invoice",
      description: "Start from this client",
      href: `/invoices/new?client_id=${client.id}`,
      icon: FilePlus2,
      shortcut: "C"
    },
    clientWhatsAppUrl
      ? {
          label: "WhatsApp",
          description: "Open client chat",
          href: clientWhatsAppUrl,
          icon: MessageCircle,
          external: true
        }
      : null,
    client.email
      ? {
          label: "Email",
          description: "Open mail composer",
          href: `mailto:${client.email}`,
          icon: Mail,
          external: true
        }
      : null,
    portalUrl
      ? {
          label: "Open portal",
          description: "Client statement link",
          href: portalUrl,
          icon: ExternalLink,
          external: true,
          tone: "positive"
        }
      : null,
    {
      label: "Statement",
      description: "Jump to documents",
      href: "#document-statement",
      icon: ReceiptText
    }
  ];
  const clientActions = clientActionCandidates.filter((action): action is ProductivityAction => Boolean(action));

  const memoryInvoices = documents.map((inv: any) => ({
    id: inv.id,
    title: inv.title,
    invoice_number: inv.invoice_number,
    document_type: inv.document_type,
    status: inv.status,
    currency: inv.currency,
    amount_usd: inv.amount_usd,
    amount_lbp: inv.amount_lbp,
    due_date: inv.due_date,
    created_at: inv.created_at,
    deposit_enabled: inv.deposit_enabled,
    payment_plan: inv.payment_plan,
    payment_proofs: inv.payment_proofs
  }));

  const timelineItems = buildClientMemoryTimeline({
    invoices: memoryInvoices as any,
    events: eventsForClient as any,
    clientNotes: (clientNotes || []) as any,
    invoiceNotes: (invoiceMemNotes || []) as any
  }).slice(0, 120);
  const timelineGroups = groupMemoryTimelineByDay(timelineItems);
  const contextBullets = deriveClientContextBullets({
    invoices: memoryInvoices as any,
    events: eventsForClient as any
  });
  const relationshipSignals = deriveRelationshipSignals({
    invoices: memoryInvoices as any,
    events: eventsForClient as any
  });

  return (
    <AppShell>
      <PageContainer width="wide">
        <PageHeader title={client.name || "Client"} eyebrow="Client profile" backHref="/clients" breadcrumbs={[{ label: "Clients", href: "/clients" }, { label: "Client details" }]} />
      <div className="mb-6 grid gap-4 print:hidden">
        <div
          className={`rounded-2xl border p-4 shadow-card ${
            clientHealth === "risk"
              ? "border-red-200 bg-red-50"
              : clientHealth === "attention"
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Client health</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {clientHealth === "risk" ? "Risk" : clientHealth === "attention" ? "Attention" : "Good"}
          </p>
          <p className="mt-1 text-sm text-slate-700">{healthCopy}</p>
        </div>

        <section className="q-panel overflow-hidden">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cedar/10 text-cedar">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Client profile</p>
                  <h2 className="truncate text-3xl font-bold tracking-normal text-ink lg:text-4xl">{client.name}</h2>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {clientFlags.map((flag) => (
                  <ClientFlag key={flag.label} tone={flag.tone} label={flag.label} />
                ))}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Phone
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-ink">{client.phone || "Not added"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Email
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-ink">{client.email || "Not added"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Client actions</p>
              <div className="mt-4 grid gap-2">
                <Link className="btn btn-primary w-full text-xs" href={`/invoices/new?client_id=${client.id}`}>
                  Create invoice
                </Link>
                {portalUrl ? (
                  <>
                    <Link className="btn btn-secondary w-full text-xs" href={portalUrl} target="_blank">
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      Open portal
                    </Link>
                    <CopyButton value={portalUrl} label="Copy portal link" className="btn btn-secondary w-full text-xs" />
                  </>
                ) : null}
                <form action={regenerateClientPortalTokenAction}>
                  <input type="hidden" name="client_id" value={client.id} />
                  <button className="btn btn-secondary w-full text-xs" type="submit">
                    Regenerate portal token
                  </button>
                </form>
                <PrintButton className="btn btn-secondary w-full text-xs" label="Print statement" showIcon />
                <ClientStatementCsvExport clientName={client.name} data={csvData} />
              </div>
            </div>
          </div>
        </section>

        <QuickActionGrid
          title="Client quick actions"
          subtitle="Communication and payment actions stay close to the client context."
          actions={clientActions}
          compact
        />

        {clientIntel ? (
          <div className="print:hidden">
            <ClientIntelligenceCard intel={clientIntel} />
          </div>
        ) : null}

        <div className="print:hidden">
          <ClientContextRelationshipPanel bullets={contextBullets} signals={relationshipSignals} />
        </div>

        {(overdueInvoices.length > 0 || hasBalanceDue) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Balance attention</p>
                <p className="mt-1 text-sm text-amber-800">
                  {overdueInvoices.length > 0
                    ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"} needs follow-up.`
                    : "Client has an outstanding balance."}
                  {quotes.length > 0 ? ` ${quotes.length} quote${quotes.length === 1 ? "" : "s"} excluded from balance.` : ""}
                </p>
              </div>
              {lastPaymentDateIso ? (
                <div className="text-xs text-amber-800">
                  <span className="font-semibold">Last payment:</span> {shortDate(lastPaymentDateIso)}
                </div>
              ) : null}
            </div>
            {currencies.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {currencies.map((curr) => (
                  <div key={curr} className="rounded-xl bg-white/70 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total balance due ({curr})</p>
                    <p className="mt-1 text-sm font-bold text-amber-800">{money(totalsByCurrency[curr].balance, curr as any)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
          <div>
            <h1 className="text-3xl font-black text-ink">
              {profile?.business_name || profile?.full_name || "Client Statement"}
            </h1>
            {profile?.phone && <p className="text-sm font-semibold text-slate-700 mt-1">{profile.phone}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Statement</h2>
            <p className="text-sm font-medium text-slate-600">Date: {shortDate(new Date().toISOString())}</p>
          </div>
        </div>
        
        <div className="mt-6">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Statement For</h3>
          <p className="text-xl font-bold text-ink">{client.name}</p>
          {(client.phone || client.email) && (
            <div className="mt-1 flex gap-4 text-sm text-slate-600">
              {client.phone && <span>{client.phone}</span>}
              {client.email && <span>{client.email}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] print:block">
        <div className="space-y-6">
          <div className="panel divide-y divide-slate-50 print:border-none print:p-0 print:mb-8">
            {currencies.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-2">No financial data recorded yet.</p>
            ) : (
              currencies.map((curr) => {
                const t = totalsByCurrency[curr];
                return (
                  <div key={curr} className="grid gap-6 sm:grid-cols-3 py-4 first:pt-0 last:pb-0 print:py-2 print:border-b print:border-slate-100 last:print:border-0">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{curr} Billed</p>
                      <p className="mt-1 text-xl font-bold text-ink print:text-lg">{money(t.billed, curr as any)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">{curr} Paid</p>
                      <p className="mt-1 text-xl font-bold text-emerald-700 print:text-lg">{money(t.paid, curr as any)}</p>
                    </div>
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-wider ${ t.overpaid > 0 ? "text-emerald-600" : "text-amber-600" }`}>
                        { t.overpaid > 0 ? `${curr} Overpaid` : `${curr} Balance` }
                      </p>
                      <p className={`text-xl font-bold ${ t.overpaid > 0 ? "text-emerald-700" : "text-amber-700" } print:text-lg`}>
                        { t.overpaid > 0 ? money(t.overpaid, curr as any) : money(t.balance, curr as any) }
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <section id="document-statement" className="panel scroll-mt-24 print:border-none print:p-0 print:shadow-none">
            <h2 className="mb-4 text-lg font-bold text-ink print:text-base print:mb-2 print:border-b print:border-slate-200 print:pb-1">Document Statement</h2>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No invoices or quotes for this client.</p>
            ) : (
              <>
              <div className="grid gap-3 md:hidden">
                {documents.map((inv: any) => {
                  const invIsQuote = isQuoteDocument(inv);
                  const invBalance = getRemainingBalance(inv, inv.payment_proofs || []);
                  const invDisplayStatus = invIsQuote ? documentStatus(inv) : getDisplayInvoiceStatus(inv);
                  const nounTitle = documentNounTitle(inv);
                  const currency = (inv.currency || "USD").toUpperCase();
                  const primaryAmount = currency === "USD" ? inv.amount_usd : inv.amount_lbp;

                  return (
                    <Link key={inv.id} href={`/invoices/${inv.id}`} className="q-mobile-card block">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{nounTitle} #{inv.invoice_number || "-"}</p>
                          <p className="mt-1 break-words text-sm font-bold text-ink">{inv.title}</p>
                        </div>
                        <StatusBadge status={invDisplayStatus} />
                      </div>
                      <div className="mt-4 grid gap-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-500">Total</span>
                          <span className="font-semibold text-ink">{money(primaryAmount, currency as any)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-500">Paid</span>
                          <span className="font-semibold text-emerald-700">{invIsQuote ? "Not invoiced" : money(invBalance.primaryTotalPaid, invBalance.primaryCurrency)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-500">Balance</span>
                          <span className={invBalance.primaryBalance > 0 ? "font-bold text-amber-700" : "font-bold text-emerald-700"}>
                            {invIsQuote ? "Quote only" : invBalance.primaryBalance > 0 ? money(invBalance.primaryBalance, invBalance.primaryCurrency) : "Paid in full"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-500">Due date</span>
                          <span className="font-medium text-slate-700">{shortDate(inv.due_date)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="q-table-head">
                      <th className="pb-3 pr-4">Document</th>
                      <th className="pb-3 pr-4">Status</th>
                      <th className="pb-3 pr-4 text-right">Total</th>
                      <th className="pb-3 pr-4 text-right">Paid</th>
                      <th className="pb-3 pr-4 text-right text-amber-600">Balance</th>
                      <th className="pb-3">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {documents.map((inv: any) => {
                      const invIsQuote = isQuoteDocument(inv);
                      const invBalance = getRemainingBalance(inv, inv.payment_proofs || []);
                      const invDisplayStatus = invIsQuote ? documentStatus(inv) : getDisplayInvoiceStatus(inv);
                      const nounTitle = documentNounTitle(inv);
                      const currency = (inv.currency || "USD").toUpperCase();
                      const primaryAmount = currency === "USD" ? inv.amount_usd : inv.amount_lbp;
                      const secondaryAmount = currency === "USD" ? inv.amount_lbp : inv.amount_usd;
                      const secondaryCurrency = currency === "USD" ? "LBP" : "USD";

                      return (
                        <tr key={inv.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 pr-4">
                            <Link 
                              href={`/invoices/${inv.id}`}
                              className="block font-bold text-ink hover:text-cedar transition-colors"
                            >
                              <span className="block text-xs text-slate-500">{nounTitle} #{inv.invoice_number}</span>
                              {inv.title}
                            </Link>
                          </td>
                          <td className="py-4 pr-4">
                            <StatusBadge status={invDisplayStatus} />
                          </td>
                          <td className="py-4 pr-4 text-right text-sm">
                            <span className="block font-medium">{money(primaryAmount, currency as any)}</span>
                            {secondaryAmount && <span className="block text-[10px] text-slate-500">Ref: {money(secondaryAmount, secondaryCurrency)}</span>}
                          </td>
                          <td className="py-4 pr-4 text-right text-sm">
                            <span className="block font-medium text-emerald-600">
                              {invIsQuote ? "Not invoiced" : money(invBalance.primaryTotalPaid, invBalance.primaryCurrency)}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-right text-sm">
                            {invIsQuote ? (
                              <span className="block font-semibold text-slate-500">Quote only</span>
                            ) : invBalance.primaryOverpaid > 0 ? (
                              <span className="block font-bold text-emerald-700">Overpaid {money(invBalance.primaryOverpaid, invBalance.primaryCurrency)}</span>
                            ) : invBalance.primaryBalance > 0 ? (
                              <span className="block font-bold text-amber-700">Due {money(invBalance.primaryBalance, invBalance.primaryCurrency)}</span>
                            ) : (
                              <span className="block font-bold text-emerald-600">Paid in full</span>
                            )}
                          </td>
                          <td className="py-4 text-sm text-slate-600">
                            {shortDate(inv.due_date)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </section>

          <div className="print:hidden">
            <ClientMemoryTimeline groups={timelineGroups} />
          </div>
        </div>

        <aside className="space-y-6 print:hidden">
          <ClientWorkspaceNotesPanel clientId={client.id} initialNotes={(clientNotes || []) as any} />
          <WorkspaceMessageTemplatesCard initialTemplates={(workspaceTemplates || []) as any} />
          <section className="panel">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">Contact Details</h2>
            <div className="space-y-4">
              {client.phone && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Phone</p>
                  <p className="text-sm font-medium text-ink">{client.phone}</p>
                </div>
              )}
              {client.email && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</p>
                  <p className="text-sm font-medium text-ink">{client.email}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Member Since</p>
                <p className="text-sm font-medium text-ink">{shortDate(client.created_at)}</p>
              </div>
            </div>
          </section>

          {client.notes && (
            <section className="panel">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">Profile notes (legacy)</h2>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</p>
            </section>
          )}
        </aside>
      </div>
      </PageContainer>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; color: black !important; }
          .panel { border: 1px solid #e2e8f0 !important; box-shadow: none !important; }
          .page-shell-main { padding: 0 !important; margin: 0 !important; }
          @page { margin: 1cm; }
        }
      `}} />
    </AppShell>
  );
}
