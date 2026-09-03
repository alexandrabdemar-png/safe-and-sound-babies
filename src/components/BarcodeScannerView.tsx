import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  WebBarcodeScannerView,
  type BarcodeScannerViewProps,
} from "@/components/WebBarcodeScannerView";
import { useIsNativeIOS } from "@/hooks/useIsNativeIOS";
import {
  startBarcodeSession,
  type BarcodeSession,
  type MlKitLike,
} from "@/lib/nativeBarcodeSession";

// Platform dispatcher: uses the native ML Kit barcode scanner
// (@capacitor-mlkit/barcode-scanning — Google's ML Kit on-device detector)
// when running as a native iOS build, falling back to the web-based scanner
// (html5-qrcode, see WebBarcodeScannerView.tsx) everywhere else.
//
// IMPORTANT (this was the TestFlight bug): the plugin exposes TWO scanning
// APIs and they are NOT both available on iOS.
//   • scan()      → Google's ready-made code-scanner *Activity*. Android only.
//                   On iOS it rejects ("not implemented"/"not available"), so
//                   the scanner appeared permanently broken in TestFlight
//                   while working fine in the browser preview.
//   • startScan() → starts the camera session behind the WebView and streams
//                   results through the `barcodeScanned` listener. This is
//                   the supported iOS path, and it requires the WebView to be
//                   made transparent so the native preview shows through
//                   (see `.barcode-scanner-active` in src/styles.css).
// We now use startScan() on iOS and keep scan() for other native platforms.
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

const SCANNER_ACTIVE_CLASS = "barcode-scanner-active";

function setPageTransparent(transparent: boolean) {
  const method = transparent ? "add" : "remove";
  document.documentElement.classList[method](SCANNER_ACTIVE_CLASS);
  document.body.classList[method](SCANNER_ACTIVE_CLASS);
}

function NativeMlKitBarcodeScannerView({
  onDetected,
  onError,
  onCancel,
  active = true,
  className,
}: BarcodeScannerViewProps) {
  const detectedRef = useRef(false);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const cancel = useCallback(() => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    void stopRef.current?.();
    onCancel?.();
  }, [onCancel]);

  useEffect(() => {
    if (!active) return;
    detectedRef.current = false;
    setPermissionDenied(false);
    let cancelled = false;
    let session: BarcodeSession | null = null;

    (async () => {
      const { BarcodeScanner, BarcodeFormat } = await import(
        "@capacitor-mlkit/barcode-scanning"
      );
      if (cancelled) return;

      const formats = [
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.Code128,
        BarcodeFormat.Code39,
        BarcodeFormat.QrCode,
      ];

      try {
        session = await startBarcodeSession(
          BarcodeScanner as unknown as MlKitLike,
          formats,
          {
            onDetected: (code) => {
              if (detectedRef.current) return;
              detectedRef.current = true;
              onDetected(code);
            },
            onError: (message) => {
              setPermissionDenied(true);
              onError?.(message);
            },
            setTransparent: setPageTransparent,
          },
        );
        stopRef.current = session?.stop ?? null;
        if (cancelled) await session?.stop();
      } catch (e) {
        if (cancelled || detectedRef.current) return;
        const message =
          e instanceof Error ? e.message : "Could not start scanner";
        if (/cancel/i.test(message)) {
          onCancel?.();
        } else {
          onError?.(message);
        }
      }
    })();


    return () => {
      cancelled = true;
      stopRef.current = null;
      void session?.stop();
      // Belt-and-braces: never leave the app invisible if we unmounted
      // before the session was even created.
      setPageTransparent(false);
    };
  }, [active, onDetected, onError, onCancel]);

  return (
    <div className={className}>
      {/* Stays visible while the rest of the page is transparent (see the
          .barcode-scanner-active rules in styles.css) so the user always has
          a way out of the native camera session. */}
      <div className="barcode-scanner-ui fixed inset-0 z-50 flex flex-col items-center justify-between p-6">
        <div className="flex w-full justify-end">
          <button
            type="button"
            onClick={cancel}
            aria-label="Close scanner"
            className="rounded-full bg-black/60 p-3 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-40 w-64 rounded-2xl border-2 border-white/70" />
        <p className="rounded-full bg-black/60 px-4 py-2 text-center text-sm text-white">
          {permissionDenied
            ? "Camera access is needed to scan barcodes"
            : "Point at the barcode — we'll capture it automatically"}
        </p>
      </div>
      {!permissionDenied && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}
