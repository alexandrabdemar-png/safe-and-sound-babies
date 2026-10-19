import { describe, expect, it, vi } from 'vitest';
import { appleProductIdForPeriod, loadAppleProduct } from './appleProducts';

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