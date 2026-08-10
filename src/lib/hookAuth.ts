// Shared auth for the pg_cron-invoked /api/public/hooks/* routes.
//
// Background: these hooks were originally gated on a bespoke `HOOK_SECRET`,
// but the pg_cron jobs that call them send the Supabase anon/publishable key
// in an `apikey` header (the canonical scheduled-job pattern). HOOK_SECRET was
// never set, so every scheduled run came back 401 Unauthorized and no product
// alerts were ever generated.
//
// We accept either credential:
//   • the project's anon/publishable key (what pg_cron sends), or
//   • HOOK_SECRET, when a project explicitly configures one.
//
// Both are compared with a length-safe constant-time comparison so the routes
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
  return [env["HOOK_SECRET"], env["SUPABASE_PUBLISHABLE_KEY"], env["SUPABASE_ANON_KEY"]].filter(
    (v): v is string => Boolean(v?.trim()),
  );
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
