// Strips personally-identifiable information from errors before logging or
// sending to error-tracking services.  Only the error name, a sanitized
// message, and an optional numeric/string code are forwarded; stack frames
// and arbitrary object properties are discarded in production.

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // email
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // phone (US)
  /"?(password|token|secret|key|auth|bearer|api_?key)"?\s*[:=]\s*"?[^\s"',}]+/gi,
  // The rule above only catches "key: value"/"key=value" assignment
  // shapes. The common HTTP header shape "Authorization: Bearer <token>"
  // has a colon after "Authorization", but the actual secret sits one
  // word later after "Bearer " — no ':'/'=' directly follows either
  // "auth" or "bearer" in that phrasing, so it passed through unredacted
  // until this pattern was added (see sanitize-error.test.ts's "gap"
  // test, which caught this while writing coverage for the function).
  /\bbearer\s+[^\s"',}]+/gi,
];

function redactMessage(msg: string): string {
  let out = msg;
  for (const re of PII_PATTERNS) out = out.replace(re, "[redacted]");
  return out;
}

export type SafeError = {
  name: string;
  message: string;
  code?: string | number;
};

export function sanitizeError(err: unknown): SafeError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactMessage(err.message),
      // Supabase / HTTP errors often attach a `code` field
      code: (err as Error & { code?: string | number }).code,
    };
  }
  if (typeof err === "string") return { name: "Error", message: redactMessage(err) };
  // Supabase's PostgrestError is a plain object, not an Error instance — the
  // single most common error shape in this codebase. Returning the generic
  // "unexpected error" for it threw away every useful detail (message, code)
  // while sanitizing nothing, so unwrap it explicitly instead.
  if (err && typeof err === "object") {
    const obj = err as { message?: unknown; code?: unknown; name?: unknown };
    if (typeof obj.message === "string") {
      return {
        name: typeof obj.name === "string" ? obj.name : "Error",
        message: redactMessage(obj.message),
        code:
          typeof obj.code === "string" || typeof obj.code === "number"
            ? obj.code
            : undefined,
      };
    }
  }
  return { name: "UnknownError", message: "An unexpected error occurred" };
}

/**
 * Standard way to log an error in this app: always PII-redacted, never a
 * raw error object. Scattered `console.error("[x] failed", err)` calls
 * leaked whatever the underlying error happened to contain (emails in
 * auth/invite errors, tokens in request URLs) straight into the browser
 * console and any attached log collector.
 */
export function logError(label: string, err?: unknown): void {
  if (err === undefined) {
    console.error(label);
    return;
  }
  console.error(label, sanitizeError(err));
}

