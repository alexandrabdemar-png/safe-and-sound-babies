/**
 * Single source of truth for "is this subscription row currently Pro?".
 *
 * This logic used to exist in three places with two different meanings:
 * useSubscription.ts (plan==='pro' + status + end-of-period grace),
 * serverProGate.ts (any active/trialing/past_due row, ignoring `plan`, no
 * grace window) and supabase/functions/_shared/subscription.ts. The server
 * gate was therefore both more permissive (a non-Pro plan row with an
 * active status unlocked paid features) and less permissive (a canceled
 * user inside their paid period was rejected) than the UI. Both the client
 * hook and the server gate now import from here; the edge-function copy in
 * supabase/functions/_shared/subscription.ts stays separate only because
 * edge functions are a different deploy target that cannot import src/.
 */
export type ProSubscriptionRow = {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
};

export function computeIsPro(sub: ProSubscriptionRow | null): boolean {
  if (!sub || sub.plan !== "pro") return false;
  const stillInPeriod = !sub.current_period_end || new Date(sub.current_period_end) > new Date();
  const okStatus =
    sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  // End-of-period access: canceled but period not over yet
  const inGracePeriod = sub.status === "canceled" && stillInPeriod;
  return (okStatus && stillInPeriod) || inGracePeriod;
}

export function hasAnyProSubscription(subs: ProSubscriptionRow[]): boolean {
  return subs.some((sub) => computeIsPro(sub));
}
