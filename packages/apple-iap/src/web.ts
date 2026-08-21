import { WebPlugin } from "@capacitor/core";
import type { AppleIAPPlugin, AppleProduct, AppleTransactionResult } from "./definitions";

/**
 * Web/non-iOS fallback — StoreKit doesn't exist outside a native iOS
 * build. The web app keeps using Stripe checkout (see
 * StripeEmbeddedCheckout.tsx); callers should check
 * Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform() before
 * calling anything here, mirroring how BarcodeScannerView picks between
 * the native and web scanners.
 */
export class AppleIAPWeb extends WebPlugin implements AppleIAPPlugin {
  async getProduct(): Promise<AppleProduct> {
    throw new Error("Apple In-App Purchase is only available on iOS native builds");
  }

  async purchase(): Promise<AppleTransactionResult> {
    throw new Error("Apple In-App Purchase is only available on iOS native builds");
  }

  async restorePurchases(): Promise<{ transactions: AppleTransactionResult[] }> {
    throw new Error("Apple In-App Purchase is only available on iOS native builds");
  }
}
