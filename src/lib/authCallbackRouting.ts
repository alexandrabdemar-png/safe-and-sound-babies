export type CallbackRoute = { to: "/auth"; search: { mode: "reset" } } | { to: string } | { to: "/onboarding" } | { to: "/home" };

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
