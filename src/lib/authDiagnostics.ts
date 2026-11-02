/**
 * A small, privacy-safe log of what happened during sign-in, so a failed
 * login on a real device can be diagnosed instead of guessed at.
 *
 * Records auth events (SIGNED_IN, TOKEN_REFRESHED…), each Supabase auth
 * request's path, status code and duration, timeouts, and the error a user
 * saw. Never records passwords, tokens or email addresses: every entry is
 * passed through redact() first.
 *
 * Entries go to:
 *   - console.info("[auth-diag] …"), visible in Safari Web Inspector and the
 *     Xcode device console, and
 *   - this device's localStorage (last 100 entries), shown on the hidden
 *     /auth-diagnostics screen (tap the sparkle icon on the sign-in screen
 *     five times).
 */
export type AuthDiagnosticKind = "event" | "request" | "timeout" | "error" | "info";

export interface AuthDiagnosticEntry {
  t: string;
  kind: AuthDiagnosticKind;
  detail: string;
}

const STORAGE_KEY = "pom.authDiagnostics";
const MAX_ENTRIES = 100;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// JWTs, refresh tokens, API keys: long runs of token-ish characters.
const TOKENISH = /[A-Za-z0-9_-]{24,}(?:\.[A-Za-z0-9_-]+)*/g;

export function redact(text: string): string {
  return text.replace(EMAIL, "[email]").replace(TOKENISH, "[redacted]");
}

export function readAuthDiagnostics(): AuthDiagnosticEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AuthDiagnosticEntry[]) : [];
  } catch {
    return [];
  }
}

export function clearAuthDiagnostics(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export function recordAuthDiagnostic(kind: AuthDiagnosticKind, detail: string): void {
  const entry: AuthDiagnosticEntry = { t: new Date().toISOString(), kind, detail: redact(detail) };
  try {
    console.info(`[auth-diag] ${entry.kind}: ${entry.detail}`);
  } catch {
    /* no console */
  }
  try {
    const entries = readAuthDiagnostics();
    entries.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    /* storage unavailable or full: the console copy still stands */
  }
}

/** Best-effort message from any thrown value, for a diagnostic entry. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

let listening = false;

/** Logs every Supabase auth event (event name only, never the session). Call once on the client. */
export function startAuthEventDiagnostics(client: {
  auth: { onAuthStateChange: (cb: (event: string, session: unknown) => void) => unknown };
}): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  client.auth.onAuthStateChange((event, session) => {
    recordAuthDiagnostic("event", `${event}${session ? " (signed in)" : " (no session)"}`);
  });
}
