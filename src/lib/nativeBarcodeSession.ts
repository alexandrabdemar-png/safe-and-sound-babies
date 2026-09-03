// Extracted from BarcodeScannerView so the iOS scan session is unit-testable
// without a native device. See the long comment in BarcodeScannerView.tsx:
// on iOS only startScan() + the "barcodesScanned" listener work — scan()
// (Google's ready-made scanner Activity) is Android-only and rejects on iOS,
// which is what made scanning look broken in TestFlight.

export type PermissionState = "granted" | "denied" | "prompt" | "limited" | "prompt-with-rationale";

export type MlKitLike = {
  checkPermissions: () => Promise<{ camera: PermissionState }>;
  requestPermissions: () => Promise<{ camera: PermissionState }>;
  addListener: (
    event: "barcodesScanned",
    cb: (event: { barcodes: Array<{ rawValue?: string }> }) => void,
  ) => Promise<{ remove: () => Promise<void> }>;
  startScan: (options: { formats: unknown[] }) => Promise<void>;
  stopScan: () => Promise<void>;
};

/**
 * iOS sometimes reports UPC-A barcodes as EAN-13 with a leading "0" (13
 * digits). Most lookup databases index the 12-digit UPC-A form.
 */
export function normalizeBarcode(value: string): string {
  return /^0\d{12}$/.test(value) ? value.slice(1) : value;
}

export type BarcodeSessionCallbacks = {
  onDetected: (code: string) => void;
  onError?: (message: string) => void;
  /** Toggles the transparent-WebView class so the native preview is visible. */
  setTransparent: (transparent: boolean) => void;
};

export type BarcodeSession = { stop: () => Promise<void> };

export async function startBarcodeSession(
  scanner: MlKitLike,
  formats: unknown[],
  { onDetected, onError, setTransparent }: BarcodeSessionCallbacks,
): Promise<BarcodeSession | null> {
  let { camera } = await scanner.checkPermissions();
  if (camera !== "granted" && camera !== "limited") {
    ({ camera } = await scanner.requestPermissions());
  }
  if (camera !== "granted" && camera !== "limited") {
    onError?.("Camera access is needed to scan barcodes");
    return null;
  }

  let stopped = false;
  let detected = false;

  const listener = await scanner.addListener("barcodesScanned", ({ barcodes }) => {
    if (detected) return;
    const raw = barcodes?.[0]?.rawValue;
    if (!raw) return;
    detected = true;
    void stop().then(() => onDetected(normalizeBarcode(raw)));
  });

  async function stop() {
    if (stopped) return;
    stopped = true;
    setTransparent(false);
    try {
      await listener.remove();
    } catch {
      /* already removed */
    }
    try {
      await scanner.stopScan();
    } catch {
      /* already stopped */
    }
  }

  try {
    setTransparent(true);
    await scanner.startScan({ formats });
  } catch (e) {
    await stop();
    throw e;
  }

  return { stop };
}
