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
