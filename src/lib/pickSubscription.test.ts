import { describe, expect, it } from 'vitest';
import { pickSubscription } from './pickSubscription';

const future = new Date(Date.now() + 86_400_000).toISOString();
const base = { price_id: null, cancel_at_period_end: false, stripe_customer_id: null, current_period_end: future };

describe('pickSubscription', () => {
  it('unlocks Pro for an Apple sandbox purchase in the live app (App Review)', () => {
    const row = pickSubscription([{ ...base, plan: 'pro', status: 'active', payment_provider: 'apple', environment: 'sandbox' }], 'live');
    expect(row?.plan).toBe('pro');
  });
  it('unlocks Pro for an Apple purchase even when Stripe is not configured', () => {
    const row = pickSubscription([{ ...base, plan: 'pro', status: 'active', payment_provider: 'apple', environment: 'live' }], null);
    expect(row?.plan).toBe('pro');
  });
  it('ignores Stripe rows from the other environment', () => {
    expect(pickSubscription([{ ...base, plan: 'pro', status: 'active', payment_provider: 'stripe', environment: 'sandbox' }], 'live')).toBeNull();
  });
  it('prefers an active Pro row over a newer expired one', () => {
    const row = pickSubscription([
      { ...base, plan: 'free', status: 'expired', payment_provider: 'apple', environment: 'sandbox' },
      { ...base, plan: 'pro', status: 'active', payment_provider: 'apple', environment: 'sandbox' },
    ], 'live');
    expect(row?.plan).toBe('pro');
  });
});
