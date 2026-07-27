export const PREVIEW_DIAGNOSTIC_HEADING = "QAFFEL PREVIEW DIAGNOSTIC";

export type PreviewDiagnosticCode =
  | "SUPABASE_QUERY_FAILED"
  | "RELATIONSHIP_SHAPE_INVALID"
  | "WORKSPACE_CONTEXT_MISSING"
  | "ONBOARDING_EVIDENCE_INVALID"
  | "CANONICAL_INVOICE_FACTS_INVALID"
  | "SERIALIZATION_FAILED";

export type PreviewDiagnosticStage =
  | "DASHBOARD_AUTH"
  | "DASHBOARD_WORKSPACE"
  | "DASHBOARD_ONBOARDING"
  | "DASHBOARD_FINANCIAL_FACTS"
  | "DASHBOARD_RECENT_ACTIVITY"
  | "DASHBOARD_PRESENTATION"
  | "NOTIFICATIONS_AUTH"
  | "NOTIFICATIONS_WORKSPACE"
  | "NOTIFICATIONS_ONBOARDING"
  | "NOTIFICATIONS_FACTS"
  | "NOTIFICATIONS_PRESENTATION"
  | "ONBOARDING_EVIDENCE_QUERY"
  | "CANONICAL_INVOICE_LOADING"
  | "NOTIFICATION_DERIVATION";

export type PreviewRenderDiagnostic = {
  routePattern: "/dashboard" | "/notifications";
  stage: PreviewDiagnosticStage;
  code: PreviewDiagnosticCode;
  errorName: string;
  message: string;
  digest: string | null;
  applicationFrame: string | null;
  fromSupabaseQuery: boolean;
};

export type PreviewDiagnosticTracker = {
  set: (stage: PreviewDiagnosticStage, code?: PreviewDiagnosticCode, fromSupabaseQuery?: boolean) => void;
  current: () => { stage: PreviewDiagnosticStage; code: PreviewDiagnosticCode; fromSupabaseQuery: boolean };
};

const MAX_MESSAGE_LENGTH = 300;
const REDACTIONS: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]"],
  [/\b[0-9a-f]{8,}-[0-9a-f-]{27,}\b/gi, "[redacted-uuid]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]"],
  [/https?:\/\/[^\s)]+/gi, "[redacted-url]"],
  [/(?:storage\/v1\/object|payment-proofs)[^\s)"']*/gi, "[redacted-storage-path]"],
  [/\b(?:[A-Fa-f0-9]{32,}|[A-Za-z0-9+/_-]{48,}={0,2})\b/g, "[redacted-secret]"],
  [/(["'])[^"'\r\n]{2,}\1/g, "[redacted-quoted-value]"]
];

export function sanitizePreviewRenderDiagnostic(value: string, maxLength = MAX_MESSAGE_LENGTH) {
  const redacted = REDACTIONS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
  return redacted.length > maxLength ? redacted.slice(0, maxLength - 3) + "..." : redacted;
}

export function createPreviewDiagnosticTracker(initialStage: PreviewDiagnosticStage): PreviewDiagnosticTracker {
  let state = { stage: initialStage, code: "SERIALIZATION_FAILED" as PreviewDiagnosticCode, fromSupabaseQuery: false };
  return {
    set(stage, code = "SERIALIZATION_FAILED", fromSupabaseQuery = false) {
      state = { stage, code, fromSupabaseQuery };
    },
    current() {
      return state;
    }
  };
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    const digest = "digest" in error && typeof error.digest === "string" ? error.digest : null;
    return { errorName: error.name || "Error", message: error.message || "Unknown server error", digest, stack: error.stack || "" };
  }
  return { errorName: "UnknownError", message: "Unknown server error", digest: null, stack: "" };
}

function applicationFrame(stack: string) {
  const frame = stack.split("\n").find((line) => /(?:^|\W)src[\\/](?:app|components|lib)[\\/]/.test(line));
  return frame ? sanitizePreviewRenderDiagnostic(frame.trim(), 240) : null;
}

export function previewRenderDiagnostic(input: {
  environment?: string;
  routePattern: PreviewRenderDiagnostic["routePattern"];
  tracker: PreviewDiagnosticTracker;
  error: unknown;
}): PreviewRenderDiagnostic | null {
  if (input.environment !== "preview") return null;
  const current = input.tracker.current();
  const details = errorDetails(input.error);
  return {
    routePattern: input.routePattern,
    stage: current.stage,
    code: current.code,
    errorName: sanitizePreviewRenderDiagnostic(details.errorName, 120),
    message: sanitizePreviewRenderDiagnostic(details.message),
    digest: details.digest ? sanitizePreviewRenderDiagnostic(details.digest, 120) : null,
    applicationFrame: applicationFrame(details.stack),
    fromSupabaseQuery: current.fromSupabaseQuery
  };
}

export function throwSupabaseQueryFailure(tracker: PreviewDiagnosticTracker, stage: PreviewDiagnosticStage, error: unknown): never {
  tracker.set(stage, "SUPABASE_QUERY_FAILED", true);
  throw error;
}

export function throwInvalidFacts(tracker: PreviewDiagnosticTracker, stage: PreviewDiagnosticStage, code: Exclude<PreviewDiagnosticCode, "SUPABASE_QUERY_FAILED">, message: string): never {
  tracker.set(stage, code, false);
  throw new Error(message);
}
export function previewRenderDiagnosticOrThrow(input: {
  environment?: string;
  routePattern: PreviewRenderDiagnostic["routePattern"];
  tracker: PreviewDiagnosticTracker;
  error: unknown;
}): PreviewRenderDiagnostic {
  const diagnostic = previewRenderDiagnostic(input);
  if (diagnostic) return diagnostic;
  throw input.error;
}
