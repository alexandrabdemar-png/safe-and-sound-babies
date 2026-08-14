// Mirrors src/hooks/useSubscription.ts's computeIsPro — kept here as a
// small, framework-agnostic, independently-testable copy since edge
// functions can't import from src/ (separate deploy target / runtime).
export type SubscriptionRow = {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
};

export function computeIsPro(sub: SubscriptionRow | null): boolean {
  if (!sub || sub.plan !== "pro") return false;
  const stillInPeriod = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
  const okStatus =
    sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  const inGracePeriod = sub.status === "canceled" && stillInPeriod;
  return (okStatus && stillInPeriod) || inGracePeriod;
}

/**
 * useSubscription.ts's client-side query filters subscriptions by Stripe
 * `environment` ('sandbox' | 'live', from the publishable key prefix) in
 * addition to user_id — but edge functions have no equivalent client-key
 * signal to derive that filter from server-side. lookup-product/index.ts
 * previously took `ORDER BY created_at DESC LIMIT 1` with no environment
 * filter at all: for a user with subscription rows in more than one
 * environment (e.g. a leftover sandbox-mode row from testing before a live
 * Stripe go-live), whichever row happened to be newest decided Pro access —
 * happily unlocking the client-side scanner UI (which checked the correct,
 * environment-matched row) while this function, checking a different row,
 * silently treated them as non-Pro and skipped every paid barcode source.
 *
 * Rather than guess at replicating environment detection server-side with
 * no existing precedent for it in this codebase, this checks every row for
 * the user and grants Pro if ANY of them currently qualifies — strictly
 * more permissive than the single-row check, and immune to environment-row
 * ordering entirely, at the cost of (correctly) treating a user as Pro if
 * they have a still-valid Pro row in either environment.
 */
export function hasAnyProSubscription(subs: SubscriptionRow[]): boolean {
  return subs.some((sub) => computeIsPro(sub));
}
