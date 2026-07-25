type LogLevel = "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const sensitiveKey = /(authorization|cookie|secret|token|password|service.?role|signature|email|phone|storage|proof|url)/i;

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, key, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 40)
        .map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey, depth + 1)])
    );
  }
  return String(value);
}

export function buildStructuredLog(
  level: LogLevel,
  event: string,
  fields: LogFields = {}
): LogFields & { timestamp: string; level: LogLevel; event: string } {
  const safeFields = sanitize(fields) as LogFields;
  return {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeFields
  };
}

export function logStructured(
  level: LogLevel,
  event: string,
  fields: LogFields = {}
) {
  const line = JSON.stringify(buildStructuredLog(level, event, fields));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
