// Strips personally-identifiable information from errors before logging or
// sending to error-tracking services.  Only the error name, a sanitized
// message, and an optional numeric/string code are forwarded; stack frames
// and arbitrary object properties are discarded in production.

const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // email
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,           // phone (US)
  /"?(password|token|secret|key|auth|bearer|api_?key)"?\s*[:=]\s*"?[^\s"',}]+/gi,
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
  return { name: "UnknownError", message: "An unexpected error occurred" };
}
