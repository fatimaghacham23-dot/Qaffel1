import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logStructured } from "@/lib/structured-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requiredEnvironment = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

export async function GET() {
  const environmentReady = requiredEnvironment.every((name) => Boolean(process.env[name]?.trim()));
  let databaseReady = false;

  if (environmentReady) {
    try {
      const { error } = await createAdminClient()
        .from("workspaces")
        .select("id", { head: true, count: "exact" })
        .limit(1);
      databaseReady = !error;
      if (error) {
        logStructured("error", "readiness.database_failed", { code: error.code });
      }
    } catch (error) {
      logStructured("error", "readiness.database_failed", {
        errorType: error instanceof Error ? error.name : "unknown"
      });
    }
  }

  const ready = environmentReady && databaseReady;
  return NextResponse.json(
    {
      service: "qaffel",
      status: ready ? "ready" : "not_ready",
      checks: {
        environment: environmentReady,
        database: databaseReady
      }
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
