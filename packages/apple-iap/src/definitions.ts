import type { PluginListenerHandle } from "@capacitor/core";

/**
 * Must exactly match the auto-renewable subscription product ids created in
 * App Store Connect (Monetization → Subscriptions) — StoreKit looks products
 * up by these strings. Both are duration variants of the same Pro tier, so
 * in App Store Connect they belong in one subscription group at the same
 * level (see packages/apple-iap/README.md).
 */
export const APPLE_PRO_MONTHLY_PRODUCT_ID = "com.peaceofmine.baby.pro.monthly";
export const APPLE_PRO_ANNUAL_PRODUCT_ID = "com.peaceofmine.baby.pro.annual";
export const APPLE_PRO_PRODUCT_IDS = [
  APPLE_PRO_MONTHLY_PRODUCT_ID,
  APPLE_PRO_ANNUAL_PRODUCT_ID,
] as const;

export type AppleIAPEnvironment = "sandbox" | "live";

export type AppleProduct = {
  id: string;
  displayName: string;
  description: string;
  /** Numeric price, e.g. 3.33 — for display fallback only; prefer displayPrice. */
  price: number;
  /** Apple's own locale-formatted price string, e.g. "$3.33". */
  displayPrice: string;
};

export type AppleTransactionResult = {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  environment: AppleIAPEnvironment;
};

export interface AppleIAPPlugin {
  /** Fetches App Store Connect metadata (price, display name) for both Pro
   * subscription products (monthly and annual). Rejects if StoreKit can't
   * reach the App Store; resolves with whichever of the two products it
   * did find if one is missing/not yet "Ready to Submit" rather than
   * failing the whole call, so the pricing screen can still show the other
   * duration's real price. */
  getProducts(): Promise<{ products: AppleProduct[] }>;

  /**
   * Starts a StoreKit purchase sheet for the given Pro product id (one of
   * APPLE_PRO_PRODUCT_IDS). appAccountToken must be the signed-in Supabase
   * user's own id (a UUID) — StoreKit attaches it to the transaction and
   * Apple echoes it back on every future transaction/notification for this
   * subscription, which is how the server (verifyAppleTransaction,
   * apple-webhook) knows which account to credit without trusting anything
   * else the client reports. Resolves once StoreKit finishes the
   * transaction locally; the caller still needs to report
   * transactionId+environment to the server (verifyAppleTransaction) before
   * treating the purchase as confirmed, since server-side re-verification
   * against Apple is what actually grants the entitlement.
   */
  purchase(options: { appAccountToken: string; productId: string }): Promise<AppleTransactionResult>;

  /** Re-syncs with the App Store and returns every currently-entitled
   * transaction for the signed-in Apple ID — used by "Restore purchases"
   * and to recover a purchase that succeeded but never made it to the
   * server (e.g. the app was killed mid-purchase). */
  restorePurchases(): Promise<{ transactions: AppleTransactionResult[] }>;

  /** Fires for a transaction StoreKit becomes aware of outside a direct
   * purchase() call — most importantly renewals, but also a purchase
   * resolved after being pending (e.g. Ask to Buy approval) or one made on
   * another of the user's devices. The listener should report
   * transactionId+environment to verifyAppleTransaction the same way a
   * fresh purchase() result is reported. */
  addListener(
    eventName: "transactionUpdate",
    listenerFunc: (data: AppleTransactionResult) => void,
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}
