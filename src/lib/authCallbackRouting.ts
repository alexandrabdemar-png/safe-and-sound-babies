export type CallbackRoute = { to: "/auth"; search: { mode: "reset" } } | { to: string } | { to: "/onboarding" } | { to: "/home" };

/**
 * Validates the ?next= redirect target on /auth/callback. Must be a
 * same-origin, in-app path — this is the guard against turning the OAuth/
 * magic-link callback into an open redirect.
 *
 * Rejects anything that isn't a single leading "/" (blocks absolute URLs
 * like "https://evil.com" and protocol-relative ones like "//evil.com"),
 * and separately rejects any backslash: browsers normalize "\" to "/" when
 * resolving a URL, so "/\evil.com" passes a naive "starts with / but not
 * //" check while still behaving like "//evil.com" (i.e. external) once a
 * browser gets hold of it. Also rejects embedded control/whitespace
 * characters (tabs, newlines, etc.), another documented bypass technique
 * for this exact validation pattern.
 */
export function parseNextParam(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.includes("\\")) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * Decides where /auth/callback sends the user once a session exists.
 *
 * isRecovery must come from the callback URL's own `type=recovery` param
 * (set by us in handleForgotPassword's redirectTo) rather than from
 * racing supabase.auth.getSession() against the onAuthStateChange
 * PASSWORD_RECOVERY event — those two can resolve in either order, and if
 * getSession() wins, a recovery link silently routes like a normal sign-in
 * instead of to the reset-password screen.
 */
export function decidePostCallbackRoute(params: {
  isRecovery: boolean;
  next: string | null;
  hasDisplayName: boolean;
}): CallbackRoute {
  if (params.isRecovery) return { to: "/auth", search: { mode: "reset" } };
  if (params.next) return { to: params.next };
  return params.hasDisplayName ? { to: "/home" } : { to: "/onboarding" };
}
