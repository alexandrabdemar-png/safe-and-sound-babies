import type { PluginListenerHandle } from "@capacitor/core";

/**
 * Must exactly match the auto-renewable subscription product id created in
 * App Store Connect (Monetization → Subscriptions) — StoreKit looks products
 * up by this string. Only one paid tier exists in this app (Pro monthly),
 * so this plugin's API is deliberately built around a single, known
 * product rather than taking a product id as a parameter everywhere.
 */
export const APPLE_PRO_MONTHLY_PRODUCT_ID = "com.peaceofmine.baby.pro.monthly";

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
  /** Fetches App Store Connect metadata (price, display name) for the one
   * Pro subscription product. Rejects if StoreKit can't reach the App
   * Store or the product isn't found (e.g. it hasn't been created yet, or
   * isn't in the "Ready to Submit"/approved state App Store Connect requires
   * before it's purchasable, even in sandbox). */
  getProduct(): Promise<AppleProduct>;

  /**
   * Starts a StoreKit purchase sheet for the Pro subscription.
   * appAccountToken must be the signed-in Supabase user's own id (a UUID) —
   * StoreKit attaches it to the transaction and Apple echoes it back on
   * every future transaction/notification for this subscription, which is
   * how the server (verifyAppleTransaction, apple-webhook) knows which
   * account to credit without trusting anything else the client reports.
   * Resolves once StoreKit finishes the transaction locally; the caller
   * still needs to report transactionId+environment to the server
   * (verifyAppleTransaction) before treating the purchase as confirmed,
   * since server-side re-verification against Apple is what actually
   * grants the entitlement.
   */
  purchase(options: { appAccountToken: string }): Promise<AppleTransactionResult>;

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
