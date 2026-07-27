export type PreviewRscErrorContext = {
  routePath: string;
  routeType: "render" | "route" | "action" | "proxy";
  renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering";
};

export type PreviewRscDiagnostic = {
  digest: string | null;
  name: string;
  message: string;
  routePath: string;
  routeType: PreviewRscErrorContext["routeType"];
  renderSource: PreviewRscErrorContext["renderSource"] | null;
  method: string;
  applicationFrame: string | null;
};

const MAX_MESSAGE_LENGTH = 320;
const REDACTIONS: Array<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[redacted-uuid]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-jwt]"],
  [/https?:\/\/[^\s)]+/gi, "[redacted-url]"],
  [/\b(?:[A-Fa-f0-9]{32,}|[A-Za-z0-9+/_-]{48,}={0,2})\b/g, "[redacted-secret]"],
  [/(["'])[A-Za-z0-9_./=-]{20,}\1/g, "[redacted-token]"]
];

export function sanitizePreviewDiagnosticValue(value: string, maxLength = MAX_MESSAGE_LENGTH) {
  const redacted = REDACTIONS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value);
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength - 1)}…` : redacted;
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    const digest = typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;
    return { digest, name: error.name || "Error", message: error.message || "Unknown error", stack: error.stack || "" };
  }
  return { digest: null, name: "UnknownError", message: "Unknown server error", stack: "" };
}

function applicationFrame(stack: string) {
  const frame = stack.split("\n").find((line) => /(?:^|\W)src[\\/](?:app|components|lib)[\\/]/.test(line));
  return frame ? sanitizePreviewDiagnosticValue(frame.trim(), 240) : null;
}

export function previewRscDiagnostic(input: { environment?: string; error: unknown; context: PreviewRscErrorContext; method: string }): PreviewRscDiagnostic | null {
  if (input.environment !== "preview") return null;
  const details = errorDetails(input.error);
  return {
    digest: details.digest ? sanitizePreviewDiagnosticValue(details.digest, 120) : null,
    name: sanitizePreviewDiagnosticValue(details.name, 120),
    message: sanitizePreviewDiagnosticValue(details.message),
    routePath: sanitizePreviewDiagnosticValue(input.context.routePath, 160),
    routeType: input.context.routeType,
    renderSource: input.context.renderSource || null,
    method: sanitizePreviewDiagnosticValue(input.method.toUpperCase(), 16),
    applicationFrame: applicationFrame(details.stack)
  };
}
