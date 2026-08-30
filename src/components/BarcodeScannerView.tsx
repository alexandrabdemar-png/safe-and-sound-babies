import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  WebBarcodeScannerView,
  type BarcodeScannerViewProps,
} from "@/components/WebBarcodeScannerView";
import { useIsNativeIOS } from "@/hooks/useIsNativeIOS";

// Platform dispatcher: uses the native ML Kit barcode scanner
// (@capacitor-mlkit/barcode-scanning — Google's ML Kit on-device detector,
// presented as a full-screen native view) when running as a native iOS
// build, falling back to the web-based scanner (html5-qrcode, see
// WebBarcodeScannerView.tsx) everywhere else — web, Android, and any
// device where the native module reports itself unsupported.
//
// Why ML Kit over the raw camera/web path: much faster lock-on, tolerant
// of angled and glossy packaging, and works in low light. All detection
// happens on-device — no camera frames leave the phone.
//
// Important UX difference from the web path: the native scanner is a
// full-screen NATIVE view presented on top of the WebView — it cannot be
// embedded inline inside this component's box the way the web scanner's
// live preview is. While it's active, this component just shows a loading
// placeholder; the actual scanning UI is a separate native screen that
// dismisses back to the app once a code is found (or the user cancels).
export function BarcodeScannerView(props: BarcodeScannerViewProps) {
  const isNativeIOS = useIsNativeIOS();
  const [nativeAvailable, setNativeAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (isNativeIOS === null) return;
    if (!isNativeIOS) {
      setNativeAvailable(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { BarcodeScanner } = await import(
          "@capacitor-mlkit/barcode-scanning"
        );
        const { supported } = await BarcodeScanner.isSupported();
        if (!cancelled) setNativeAvailable(supported);
      } catch {
        // The plugin isn't available (e.g. a web preview build that never
        // bundled it) — that's expected on web, fall back.
        if (!cancelled) setNativeAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNativeIOS]);

  // Still checking — render nothing rather than flashing the web camera
  // preview for a frame on a device that's about to use the native one.
  if (nativeAvailable === null) return null;

  if (nativeAvailable) {
    return <NativeMlKitBarcodeScannerView {...props} />;
  }

  return <WebBarcodeScannerView {...props} />;
}

/**
 * iOS sometimes reports UPC-A barcodes as EAN-13 with a leading "0" (13
 * digits). Most baby-product lookup databases index the 12-digit UPC-A
 * form, so strip a single leading zero from 13-digit numeric codes.
 */
function normalizeBarcode(value: string): string {
  return /^0\d{12}$/.test(value) ? value.slice(1) : value;
}

function NativeMlKitBarcodeScannerView({
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

    (async () => {
      const { BarcodeScanner, BarcodeFormat } = await import(
        "@capacitor-mlkit/barcode-scanning"
      );
      if (cancelled) return;

      try {
        // Camera permission — check first, then request. On denial the
        // web fallback needs the same permission anyway, so surface the
        // error rather than silently swapping scanners mid-flow.
        let { camera } = await BarcodeScanner.checkPermissions();
        if (camera !== "granted") {
          ({ camera } = await BarcodeScanner.requestPermissions());
        }
        if (camera !== "granted") {
          onError?.("Camera access is needed to scan barcodes");
          return;
        }
        if (cancelled) return;

        const { barcodes } = await BarcodeScanner.scan({
          formats: [
            BarcodeFormat.UpcA,
            BarcodeFormat.UpcE,
            BarcodeFormat.Ean13,
            BarcodeFormat.Ean8,
            BarcodeFormat.Code128,
            BarcodeFormat.Code39,
            BarcodeFormat.QrCode,
          ],
        });
        if (cancelled || detectedRef.current) return;

        const raw = barcodes[0]?.rawValue;
        if (!raw) {
          // User closed the scanner without detecting anything.
          onCancel?.();
          return;
        }
        detectedRef.current = true;
        onDetected(normalizeBarcode(raw));
      } catch (e) {
        if (cancelled || detectedRef.current) return;
        const message = e instanceof Error ? e.message : "Could not start scanner";
        // The plugin rejects when the user dismisses the native sheet.
        if (/cancel/i.test(message)) {
          onCancel?.();
        } else {
          onError?.(message);
        }
      }
    })();

    return () => {
      cancelled = true;
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
