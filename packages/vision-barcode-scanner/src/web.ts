import { WebPlugin } from "@capacitor/core";
import type { VisionBarcodeScannerPlugin } from "./definitions";

/**
 * Web/non-iOS fallback — VisionKit doesn't exist outside iOS 16+. Always
 * reports unsupported; callers should already be checking isSupported()
 * and using the existing html5-qrcode-based scanner (BarcodeScannerView)
 * everywhere this returns false, so startScan() here should never actually
 * be called in practice.
 */
export class VisionBarcodeScannerWeb extends WebPlugin implements VisionBarcodeScannerPlugin {
  async isSupported(): Promise<{ supported: boolean }> {
    return { supported: false };
  }

  async startScan(): Promise<void> {
    throw new Error("VisionBarcodeScanner is only available on iOS 16+ native builds");
  }

  async stopScan(): Promise<void> {
    // No-op — nothing to dismiss on web.
  }
}
