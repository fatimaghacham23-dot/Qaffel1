import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildIntelligenceBundle, buildMonthlyReportCsv } from "@/lib/intelligence-layer";
import type { OCInvoiceRow } from "@/lib/operations-center";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const m = request.nextUrl.searchParams.get("m");
    if (!m || !/^\d{4}-\d{2}$/.test(m)) {
      return new NextResponse("Invalid month. Use ?m=YYYY-MM", { status: 400 });
    }

    const [{ data: invoices }, { data: events }, { data: clients }] = await Promise.all([
      supabase
        .from("invoices")
        .select(
          "*, exchange_rate_lbp_per_usd, clients(id, name, phone, email), payment_proofs(id, status, amount_usd, amount_lbp, uploaded_at, confirmed_at, payment_date, method, voided_at)"
        )
        .eq("user_id", user.id),
      supabase
        .from("invoice_events")
        .select("id, invoice_id, event_type, message, created_at, metadata")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("clients").select("id, name, created_at").eq("user_id", user.id)
    ]);

    const bundle = buildIntelligenceBundle({
      invoices: (invoices || []) as OCInvoiceRow[],
      events: (events || []) as any,
      clients: (clients || []) as { id: string; name: string | null; created_at: string }[]
    });

    const csv = buildMonthlyReportCsv(m, bundle.monthlyReports);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="qaffel-report-${m}.csv"`
      }
    });
  } catch {
    return new NextResponse("Could not generate report export.", { status: 500 });
  }
}
