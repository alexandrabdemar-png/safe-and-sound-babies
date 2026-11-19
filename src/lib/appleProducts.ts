import type { AppleProduct } from 'apple-iap';
import { APPLE_PRO_ANNUAL_PRODUCT_ID, APPLE_PRO_MONTHLY_PRODUCT_ID } from 'apple-iap';

export function appleProductIdForPeriod(period: 'monthly' | 'yearly'): string {
  return period === 'yearly' ? APPLE_PRO_ANNUAL_PRODUCT_ID : APPLE_PRO_MONTHLY_PRODUCT_ID;
}

export async function loadAppleProduct(
  productId: string,
  available: boolean,
  getProduct: (options: { productId: string }) => Promise<AppleProduct>,
): Promise<AppleProduct> {
  if (!available) {
    throw new Error('Apple purchases are missing from this version of the app. Please update the app to purchase a subscription.');
  }
  const product = await getProduct({ productId });
  if (product.id !== productId || !product.displayPrice) {
    throw new Error('The App Store did not return the selected subscription. Please try again.');
  }
  return product;
}
/**
 * "7-day", "1-month" … when StoreKit reports a free-trial introductory
 * offer the current Apple ID can still redeem; null otherwise (no offer
 * configured, already used, or an older app build that doesn't report it).
 */
export function appleTrialLabel(product: AppleProduct | null | undefined): string | null {
  const offer = product?.introOffer;
  if (!offer || !offer.eligible || offer.paymentMode !== 'freeTrial') return null;
  const total = offer.periodValue * Math.max(1, offer.periodCount || 1);
  if (!Number.isFinite(total) || total <= 0) return null;
  return `${total}-${offer.periodUnit}`;
}
