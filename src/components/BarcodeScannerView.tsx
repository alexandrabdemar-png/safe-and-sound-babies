import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  WebBarcodeScannerView,
  type BarcodeScannerViewProps,
} from "@/components/WebBarcodeScannerView";

// Platform dispatcher: uses Apple VisionKit's native live barcode scanner
// (DataScannerViewController, iOS 16+) when running as a native iOS build
// on a device that supports it, falling back to the web-based scanner
// (html5-qrcode, see WebBarcodeScannerView.tsx) everywhere else — web,
// Android, and iOS below version 16.
//
// Important UX difference from the web path: VisionKit's scanner is a
// full-screen NATIVE view presented on top of the WebView (like
// @capacitor/camera's photo picker) — it cannot be embedded inline inside
// this component's box the way the web scanner's live preview is. While
// it's active, this component just shows a loading placeholder; the actual
// scanning UI is a separate native screen that dismisses back to the app
// once a code is found (or the user cancels).
export function BarcodeScannerView(props: BarcodeScannerViewProps) {
  const [nativeAvailable, setNativeAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.getPlatform() !== "ios" || !Capacitor.isNativePlatform()) {
          if (!cancelled) setNativeAvailable(false);
          return;
        }
        const { VisionBarcodeScanner } = await import("vision-barcode-scanner");
        const { supported } = await VisionBarcodeScanner.isSupported();
        if (!cancelled) setNativeAvailable(supported);
      } catch {
        // Capacitor or the plugin isn't available (e.g. web preview build
        // that never bundled it) — that's expected on web, fall back.
        if (!cancelled) setNativeAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Still checking — render nothing rather than flashing the web camera
  // preview for a frame on a device that's about to use the native one.
  if (nativeAvailable === null) return null;

  if (nativeAvailable) {
    return <NativeVisionBarcodeScannerView {...props} />;
  }

  return <WebBarcodeScannerView {...props} />;
}

function NativeVisionBarcodeScannerView({
  onDetected,
  onError,
  onCancel,
  active = true,
  className,
}: BarcodeScannerViewProps) {
  const detectedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    detectedRef.current = false;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listenerHandles: any[] = [];

    (async () => {
      const { VisionBarcodeScanner } = await import("vision-barcode-scanner");
      if (cancelled) return;

      listenerHandles.push(
        await VisionBarcodeScanner.addListener("barcodeDetected", ({ value }) => {
          if (detectedRef.current) return;
          detectedRef.current = true;
          onDetected(value);
        }),
      );
      listenerHandles.push(
        await VisionBarcodeScanner.addListener("scanCancelled", () => {
          onCancel?.();
        }),
      );
      listenerHandles.push(
        await VisionBarcodeScanner.addListener("scanError", ({ message }) => {
          onError?.(message);
        }),
      );

      try {
        await VisionBarcodeScanner.startScan();
      } catch (e) {
        if (!cancelled) onError?.(e instanceof Error ? e.message : "Could not start scanner");
      }
    })();

    return () => {
      cancelled = true;
      listenerHandles.forEach((h) => h.remove());
      import("vision-barcode-scanner").then(({ VisionBarcodeScanner }) => {
        VisionBarcodeScanner.stopScan().catch(() => {});
      });
    };
  }, [active, onDetected, onError, onCancel]);

  return (
    <div className={className}>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    </div>
  );
}
