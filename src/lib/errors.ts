const FRIENDLY_MAP: [RegExp, string][] = [
  [/duplicate key|already exists/i, "Looks like that's already saved — no need to add it again."],
  [
    /foreign key|violates.*constraint/i,
    "Something doesn't line up on our end — please try again in a moment.",
  ],
  [
    /network|fetch|connection|offline/i,
    "Can't reach the internet right now. Check your connection and try again.",
  ],
  [
    /not authenticated|jwt expired|invalid.*token/i,
    "Your session expired — just sign in again and you'll be right back.",
  ],
  [
    /permission denied|row-level security/i,
    "You don't have permission for that action. If this seems wrong, try signing out and back in.",
  ],
  [/too many requests|rate limit/i, "You're moving fast — give it a second and try again."],
  [/timeout/i, "That's taking longer than expected. Check your connection and try again."],
  [
    /storage.*quota|quota exceeded/i,
    "Your device is almost out of space. Free up some storage and try again.",
  ],
];

/**
 * True when a Supabase/PostgREST error means a table (not just a column)
 * genuinely isn't reachable yet — either PostgREST's schema cache hasn't
 * picked it up ("Could not find the table 'public.x' in the schema
 * cache") or Postgres itself has no such relation (code 42P01 /
 * undefined_table, "relation ... does not exist"). Unlike a missing
 * column, there's no client-side fallback for a missing table — the
 * point of this check is purely to give a clearer, honest message
 * instead of the generic fallback, since "try again in a moment" is
 * misleading when the real fix is a deploy/migration issue on the server.
 */
export function isSchemaMissingTableError(error: {
  message: string;
  code?: string | null;
}): boolean {
  if (error.code === "42P01") return true; // Postgres: undefined_table
  return (
    /schema cache/i.test(error.message) &&
    (/could not find the table/i.test(error.message) ||
      /relation.*does not exist/i.test(error.message))
  );
}

/**
 * Convert a raw error message into something a parent would actually understand.
 * Falls back to a warm generic message rather than showing the raw error.
 */
export function friendlyError(raw: unknown): string {
  const msg =
    raw instanceof Error ? raw.message : typeof raw === "string" ? raw : String(raw ?? "");
  if (isSchemaMissingTableError({ message: msg })) {
    return "This feature isn't fully set up on your account yet — we're on it. Please try again in a little while.";
  }
  for (const [pattern, friendly] of FRIENDLY_MAP) {
    if (pattern.test(msg)) return friendly;
  }
  // Never expose raw technical errors — return a warm fallback
  return "Something went wrong on our end. Give it a moment and try again — your data is safe.";
}

const AUTH_FRIENDLY_MAP: [RegExp, string][] = [
  [
    /user already registered|already.*registered/i,
    "Looks like you already have an account with that email — try signing in instead.",
  ],
  [
    /invalid login credentials/i,
    "That email or password doesn't match our records. Double-check and try again, or reset your password.",
  ],
  [/email not confirmed/i, "Please confirm your email first — check your inbox for the confirmation link."],
  [
    /password should be at least|password.*at least \d+ characters/i,
    "Your password needs to be at least 6 characters.",
  ],
  [
    /unable to validate email address|invalid email/i,
    "That doesn't look like a valid email address.",
  ],
  [
    /signups? not allowed|signup.*disabled/i,
    "New sign-ups aren't available right now — please try again later.",
  ],
  [
    /email rate limit|over_email_send_rate_limit/i,
    "You've requested a few too many emails — please wait a bit before trying again.",
  ],
  [
    /too many requests|rate limit/i,
    "Too many attempts — please wait a minute and try again.",
  ],
  [
    /expired|invalid.*token|invalid.*link|token has expired/i,
    "That link has expired or already been used — request a new one.",
  ],
  [
    /database error saving new user|unexpected_failure/i,
    "We hit a snag creating your account. Please try again in a moment — if it keeps happening, let us know.",
  ],
];

/**
 * Convert a raw Supabase Auth (GoTrue) error into something a parent would
 * actually understand. Auth errors get their own map, separate from
 * friendlyError()'s data-save/load-tuned one, because GoTrue's message
 * strings ("User already registered", "Invalid login credentials", etc.)
 * don't match the read/write-error patterns that function looks for — and
 * because auth failures should never show a raw DB/constraint message to
 * someone trying to create an account.
 */
export function friendlyAuthError(raw: unknown): string {
  const msg =
    raw instanceof Error ? raw.message : typeof raw === "string" ? raw : String(raw ?? "");
  for (const [pattern, friendly] of AUTH_FRIENDLY_MAP) {
    if (pattern.test(msg)) return friendly;
  }
  // Never expose a raw GoTrue/Postgres error to someone trying to sign up —
  // fall back to a warm, actionable generic message instead.
  return "We couldn't complete that right now. Please try again in a moment.";
}

/** Use when saving data fails */
export function saveError(): string {
  return "We couldn't save that right now. Tap to try again.";
}

/** Use when loading data fails */
export function loadError(): string {
  return "Having trouble loading your data. Pull to refresh or try again in a moment.";
}

/**
 * Extracts the most actionable detail from a Supabase/PostgREST error for
 * diagnostic purposes — `hint` (e.g. the literal GRANT/migration fix)
 * when present, otherwise `message`. Pair with `console.error(err)` for
 * the full object; this is meant for a toast or log line, not to replace
 * friendlyError() for regular end-user-facing copy.
 */
export function diagnosticDetail(err: unknown): string {
  if (err && typeof err === "object" && "hint" in err && err.hint) {
    return String(err.hint);
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
