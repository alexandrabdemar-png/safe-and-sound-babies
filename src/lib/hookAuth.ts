// Shared auth for the pg_cron-invoked /api/public/hooks/* routes.
//
// Only HOOK_SECRET is accepted. This used to also accept the Supabase
// anon/publishable key (the value pg_cron sent before HOOK_SECRET was
// configured in Vault) as a fallback so the cron jobs wouldn't 401 — but
// the anon key is, by design, embedded in every client bundle and sent on
// every browser request. Accepting it here meant anyone who opened
// devtools once could call these hooks directly (security review
// finding). private.call_recall_hook (see
// supabase/migrations/20260702000000_apns_push_and_cron.sql) already
// sends the real hook_secret from Supabase Vault, so removing the
// fallback is safe now that that secret is actually configured — verify
// cron.job_run_details shows successful runs before relying on this.
//
// Compared with a length-safe constant-time comparison so the routes
// don't leak credential material through timing.

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Pulls the presented credential out of `apikey` or `Authorization: Bearer`. */
export function extractHookCredential(headers: {
  get(name: string): string | null;
}): string | null {
  const raw =
    headers.get("apikey") ?? headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Returns true when `presented` matches any configured accepted credential.
 * With no credentials configured at all, this returns false (fail closed).
 */
export function isAuthorizedHookCredential(
  presented: string | null | undefined,
  accepted: (string | null | undefined)[],
): boolean {
  if (!presented) return false;
  return accepted.some((candidate) => {
    const value = candidate?.trim();
    if (!value) return false;
    return timingSafeEqual(presented, value);
  });
}

/** Reads the accepted credentials from the server environment. */
export function acceptedHookCredentials(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string[] {
  return [env["HOOK_SECRET"]].filter((v): v is string => Boolean(v?.trim()));
}

/** One-call guard for a hook handler. Returns a 401 Response, or null when OK. */
export function hookUnauthorizedResponse(request: Request): Response | null {
  const presented = extractHookCredential(request.headers);
  if (isAuthorizedHookCredential(presented, acceptedHookCredentials())) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
