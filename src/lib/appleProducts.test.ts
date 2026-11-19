import { describe, expect, it, vi } from 'vitest';
import { appleProductIdForPeriod, appleTrialLabel, loadAppleProduct } from './appleProducts';

describe('Apple subscription discovery', () => {
  it('requests monthlyplan for monthly billing', () => {
    expect(appleProductIdForPeriod('monthly')).toBe('monthlyplan');
  });
  it('requests annualplan for annual billing', () => {
    expect(appleProductIdForPeriod('yearly')).toBe('annualplan');
  });
  it('does not attempt a purchase lookup without the native plugin', async () => {
    const lookup = vi.fn();
    await expect(loadAppleProduct('monthlyplan', false, lookup)).rejects.toThrow('missing');
    expect(lookup).not.toHaveBeenCalled();
  });
  it('returns the actual selected StoreKit product and price', async () => {
    const product = { id: 'annualplan', displayName: 'Annual', description: '', price: 34.99, displayPrice: '$34.99' };
    const lookup = vi.fn().mockResolvedValue(product);
    expect(await loadAppleProduct('annualplan', true, lookup)).toEqual(product);
    expect(lookup).toHaveBeenCalledWith({ productId: 'annualplan' });
  });
  it('surfaces App Store failures instead of fabricating a purchasable plan', async () => {
    await expect(loadAppleProduct('monthlyplan', true, vi.fn().mockRejectedValue(new Error('Product not found')))).rejects.toThrow('Product not found');
  });
  it('rejects a product belonging to another plan', async () => {
    await expect(loadAppleProduct('annualplan', true, vi.fn().mockResolvedValue({ id: 'monthlyplan', displayPrice: '$3.39' }))).rejects.toThrow('selected subscription');
  });
});
describe('Apple free-trial label (Guideline 3.1.2: paywall must match the App Store sheet)', () => {
  const base = { id: 'monthlyplan', displayName: 'Monthly', description: '', price: 3.39, displayPrice: '$3.39' };
  const trial = { paymentMode: 'freeTrial' as const, periodValue: 7, periodUnit: 'day' as const, periodCount: 1, displayPrice: '$0.00', eligible: true };
  it('advertises no trial when StoreKit reports no introductory offer (or an older build)', () => {
    expect(appleTrialLabel(base)).toBeNull();
    expect(appleTrialLabel(null)).toBeNull();
  });
  it('shows the configured trial length for an eligible Apple ID', () => {
    expect(appleTrialLabel({ ...base, introOffer: trial })).toBe('7-day');
    expect(appleTrialLabel({ ...base, introOffer: { ...trial, periodValue: 1, periodUnit: 'week' } })).toBe('1-week');
  });
  it('advertises no trial once the Apple ID has already used it', () => {
    expect(appleTrialLabel({ ...base, introOffer: { ...trial, eligible: false } })).toBeNull();
  });
  it('does not call a paid introductory price a free trial', () => {
    expect(appleTrialLabel({ ...base, introOffer: { ...trial, paymentMode: 'payAsYouGo', displayPrice: '$0.99' } })).toBeNull();
  });
});
