import { computeIsPro } from './isPro';

export type SubscriptionRow = {
  plan: string | null;
  status: string | null;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string | null;
  payment_provider: string | null;
};

type Row = SubscriptionRow & { environment: string };

/**
 * Chooses the subscription row the UI shows. Apple rows count in any
 * environment: App Review and TestFlight buy in Apple's sandbox even in
 * the production app, so a sandbox Apple row must unlock Pro there.
 * Stripe rows only count in the current Stripe environment. Rows are
 * expected newest first; a currently-Pro row wins over a newer lapsed one.
 */
export function pickSubscription(rows: Row[], stripeEnv: 'sandbox' | 'live' | null): SubscriptionRow | null {
  const eligible = rows.filter((r) => r.payment_provider === 'apple' || (stripeEnv !== null && r.environment === stripeEnv));
  const pro = eligible.find((r) => computeIsPro(r));
  const chosen = pro ?? eligible[0] ?? null;
  if (!chosen) return null;
  const { environment: _env, ...rest } = chosen;
  return rest;
}
