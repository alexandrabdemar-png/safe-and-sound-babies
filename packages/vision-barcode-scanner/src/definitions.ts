import type { PluginListenerHandle } from "@capacitor/core";

export interface VisionBarcodeScannerPlugin {
  /**
   * True if this device can run VisionKit's live barcode scanner
   * (DataScannerViewController) — iOS 16+ on supported hardware. Always
   * false on web/Android; check this before offering the native scanner
   * as an option, and fall back to the existing web-based scanner
   * (BarcodeScannerView, html5-qrcode) when false.
   */
  isSupported(): Promise<{ supported: boolean }>;

  /**
   * Presents a full-screen native scanner over the app. Resolves once the
   * scanner is presented (not once a barcode is found) — listen for the
   * `barcodeDetected` / `scanCancelled` / `scanError` events for the actual
   * outcome. Rejects if the device doesn't support this, or a scan is
   * already in progress.
   */
  startScan(): Promise<void>;

  /** Dismisses the native scanner if one is currently presented. No-op otherwise. */
  stopScan(): Promise<void>;

  addListener(
    eventName: "barcodeDetected",
    listenerFunc: (data: { value: string }) => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: "scanCancelled",
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: "scanError",
    listenerFunc: (data: { message: string }) => void,
  ): Promise<PluginListenerHandle>;

  removeAllListeners(): Promise<void>;
}
