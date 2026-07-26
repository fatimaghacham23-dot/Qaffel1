import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIntelligenceBundle, buildMonthlyReportCsv } from "@/lib/intelligence-layer";
import {
  buildFinanceClosingModel,
  buildFinanceExportCsv,
  type FinanceApprovalRow,
  type FinanceClosePeriodState,
  type FinanceCloseTaskState,
  type FinanceEventRow,
  type FinanceExportRunRow,
  type FinanceInvoiceRow
} from "@/lib/finance-closing";
import type { OCInvoiceRow } from "@/lib/operations-center";
import { hasPermission } from "@/lib/permissions";
import { toCsv } from "@/lib/csv";
import { workspaceContextFromMembership } from "@/lib/workspace-authorization";
import { buildWorkspaceMonthlyReportCsv, buildWorkspaceMonthlyReports, type WorkspaceReportInvoice } from "@/lib/workspace-monthly-report";

const FINANCE_PRESET_ALIASES: Record<string, string> = {
  "monthly-pack": "finance_close_snapshot",
  "reconciliation-summary": "proof_review_logs",
  "void-history": "void_history",
  "payment-review": "reviewer_activity"
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function getRouteWorkspaceContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; user_metadata?: { full_name?: string | null } | null }
) {
  const { data: membership, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces!inner(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Workspace membership could not be verified.");
  return workspaceContextFromMembership(user, membership);
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const ctx = await getRouteWorkspaceContext(supabase, user);
    const m = request.nextUrl.searchParams.get("m");
    const presetRaw = request.nextUrl.searchParams.get("preset");
    const preset = presetRaw ? FINANCE_PRESET_ALIASES[presetRaw] || presetRaw : null;

    if (preset) {
      if (!hasPermission(ctx.role, "exports.finance")) {
        return new NextResponse("Forbidden", { status: 403 });
      }

      const periodMonth = /^\d{4}-\d{2}$/.test(m || "") ? m! : currentMonth();
      const [
        { data: invoices },
        { data: events },
        { data: approvals },
        { data: closePeriod },
        { data: closeTasks },
        { data: exportRuns }
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            "id, invoice_number, title, status, document_type, client_id, amount_usd, amount_lbp, currency, due_date, valid_until, created_at, exchange_rate_lbp_per_usd, deposit_enabled, deposit_type, deposit_percent, deposit_amount_usd, deposit_amount_lbp, deposit_note, payment_plan, approval_status, clients(id, name, phone, email), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, reviewed_at, reviewed_by, reviewer_name, reviewer_role, payment_date, method, voided_at, void_reason, note, reviewer_decision_note)"
          )
          .eq("workspace_id", ctx.workspaceId)
          .order("created_at", { ascending: false })
          .limit(1500),
        supabase
          .from("invoice_events")
          .select("id, invoice_id, event_type, message, created_at, actor_id, actor_name, actor_role, metadata")
          .eq("workspace_id", ctx.workspaceId)
          .order("created_at", { ascending: false })
          .limit(4000),
        supabase
          .from("workspace_approvals")
          .select("id, type, reference_id, reference_type, requested_by, approved_by, status, note, threshold_usd, created_at, resolved_at")
          .eq("workspace_id", ctx.workspaceId)
          .order("created_at", { ascending: false })
          .limit(800),
        supabase
          .from("finance_close_periods")
          .select("period_month, status, notes, signed_off_by_name, signed_off_at")
          .eq("workspace_id", ctx.workspaceId)
          .eq("period_month", periodMonth)
          .maybeSingle(),
        supabase
          .from("finance_close_tasks")
          .select("task_key, status, note, completed_by_name, completed_at, updated_at")
          .eq("workspace_id", ctx.workspaceId)
          .eq("period_month", periodMonth),
        supabase
          .from("finance_export_runs")
          .select("id, period_month, export_type, title, row_count, generated_by_name, generated_at")
          .eq("workspace_id", ctx.workspaceId)
          .eq("period_month", periodMonth)
          .order("generated_at", { ascending: false })
          .limit(40)
      ]);

      const normalizedInvoices = ((invoices || []) as unknown as FinanceInvoiceRow[]).map((invoice) => ({
        ...invoice,
        clients: one(invoice.clients)
      }));
      const model = buildFinanceClosingModel({
        periodMonth,
        invoices: normalizedInvoices,
        events: (events || []) as FinanceEventRow[],
        approvals: (approvals || []) as FinanceApprovalRow[],
        closeState: (closePeriod || null) as FinanceClosePeriodState | null,
        taskStates: (closeTasks || []) as FinanceCloseTaskState[],
        exportRuns: (exportRuns || []) as FinanceExportRunRow[]
      });
      const dataset = buildFinanceExportCsv({ datasetKey: preset, model });
      if (!dataset) {
        return new NextResponse("Unknown finance export preset.", { status: 400 });
      }

      await supabase.from("finance_export_runs").insert({
        workspace_id: ctx.workspaceId,
        period_month: periodMonth,
        export_type: dataset.key,
        title: dataset.title,
        row_count: dataset.rows.length,
        generated_by: user.id,
        generated_by_name: user.user_metadata?.full_name || user.email || "Finance user"
      });

      const csv = toCsv(dataset.rows);
      return csvResponse(`\uFEFF${csv}`, `${dataset.filename}.csv`);
    }

    if (!m || !/^\d{4}-\d{2}$/.test(m)) {
      return new NextResponse("Invalid month. Use ?m=YYYY-MM", { status: 400 });
    }

    if (!hasPermission(ctx.role, "reports.view")) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const [{ data: invoices }, { data: clients }] = await Promise.all([
      supabase
        .from("invoices")
        .select("id,status,document_type,currency,amount_usd,amount_lbp,due_date,created_at,payment_proofs(status,amount_usd,amount_lbp,uploaded_at,confirmed_at,reviewed_at,method,voided_at)")
        .eq("workspace_id", ctx.workspaceId)
        .limit(1500),
      supabase.from("clients").select("created_at").eq("workspace_id", ctx.workspaceId).limit(1500)
    ]);

    const rows = buildWorkspaceMonthlyReports({ invoices: (invoices || []) as WorkspaceReportInvoice[], clients: clients || [] });
    const csv = buildWorkspaceMonthlyReportCsv(m, rows);

    return csvResponse(csv, `qaffel-report-${m}.csv`);
  } catch {
    return new NextResponse("Could not generate report export.", { status: 500 });
  }
}
