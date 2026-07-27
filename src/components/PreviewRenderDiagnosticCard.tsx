import { PREVIEW_DIAGNOSTIC_HEADING, type PreviewRenderDiagnostic } from "@/lib/preview-render-diagnostics";

export function PreviewRenderDiagnosticCard({ diagnostic }: { diagnostic: PreviewRenderDiagnostic }) {
  const text = [
    PREVIEW_DIAGNOSTIC_HEADING,
    `route=${diagnostic.routePattern}`,
    `stage=${diagnostic.stage}`,
    `code=${diagnostic.code}`,
    `error=${diagnostic.errorName}`,
    `message=${diagnostic.message}`,
    `digest=${diagnostic.digest || "none"}`,
    `application_frame=${diagnostic.applicationFrame || "none"}`,
    `supabase_query_result=${diagnostic.fromSupabaseQuery ? "yes" : "no"}`
  ].join("\n");

  return (
    <main className="mx-auto my-8 max-w-2xl px-4" data-preview-diagnostic="true">
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-slate-900 shadow-sm">
        <h1 className="text-base font-bold tracking-wide">{PREVIEW_DIAGNOSTIC_HEADING}</h1>
        <p className="mt-2 text-sm text-slate-700">Preview-only render diagnostic. Copy this safe summary for the engineering review.</p>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100" tabIndex={0} aria-label="Copyable preview diagnostic">
          {text}
        </pre>
      </section>
    </main>
  );
}
