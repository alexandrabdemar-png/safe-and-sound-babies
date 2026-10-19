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